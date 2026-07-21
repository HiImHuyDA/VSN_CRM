-- Migration 70: Fix usp_GetGuestCalendar
-- Bug: đơn của Partner/Supplier/Khách vãng lai/Ứng viên phỏng vấn (không bắt buộc có Task)
-- bị loại hoàn toàn khỏi màn hình "Theo dõi lịch tiếp khách" do dùng INNER JOIN CSR_Tasks.
-- Fix: với các đơn KHÔNG có task nào, lấy ngày/địa điểm trực tiếp từ cột AgendaJsonData
-- (cấu trúc: [{"date":"yyyy-MM-dd","agenda":{"TÊN_ĐỊA_ĐIỂM":[...]}}]).
USE CSR_DB;
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_GetGuestCalendar]
    @StartDate NVARCHAR(10),
    @EndDate   NVARCHAR(10)
AS
BEGIN
    SET NOCOUNT ON;

    -- Tự động cập nhật trạng thái Hoàn thành trước khi truy vấn (chỉ áp dụng cho đơn có Task)
    UPDATE p
    SET p.[StatusId] = 7, p.[UpdatedAt] = GETDATE() -- 7 is Hoàn thành
    FROM [dbo].[CSR_Projects] p
    WHERE p.[StatusId] = 5 -- 5 is BOD đã duyệt
        AND p.[RecordType] = 1
        AND NOT EXISTS (
          SELECT 1
        FROM [dbo].[CSR_Tasks] t
        WHERE t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1
            AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)
      )
        AND EXISTS (
          SELECT 1
        FROM [dbo].[CSR_Tasks] t
        WHERE t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1
      );

    -- Gộp 2 nguồn ngày/địa điểm:
    -- (1) Đơn có Task: lấy từ CSR_Tasks như trước
    -- (2) Đơn KHÔNG có Task nào (Partner/Supplier/Khách vãng lai/Ứng viên phỏng vấn):
    --     lấy từ AgendaJsonData qua OPENJSON
    ;WITH
        DateDest
        AS
        (
                            SELECT
                    p.[Project_id],
                    t.[OnboardDate] AS [VisitDate],
                    t.[Destination] COLLATE DATABASE_DEFAULT AS [Destination]
                FROM [dbo].[CSR_Projects] p
                    INNER JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1
                WHERE p.[RecordType] = 1

            UNION ALL

                SELECT
                    p.[Project_id],
                    TRY_CAST(j.[VisitDateStr] AS DATE) AS [VisitDate],
                    d.[key] COLLATE DATABASE_DEFAULT AS [Destination]
                FROM [dbo].[CSR_Projects] p
        CROSS APPLY OPENJSON(p.[AgendaJsonData])
            WITH ([VisitDateStr] NVARCHAR(20) '$.date', [agenda] NVARCHAR(MAX) '$.agenda' AS JSON) j
        CROSS APPLY OPENJSON(j.[agenda]) d
                WHERE p.[RecordType] = 1
                    AND p.[AgendaJsonData] IS NOT NULL
                    AND NOT EXISTS (SELECT 1
                    FROM [dbo].[CSR_Tasks] t2
                    WHERE t2.[Project_id] = p.[Project_id])
        )
    SELECT DISTINCT
        p.[Project_id],
        p.[CustomerName],
        p.[CustomerType],
        p.[MeetingTopic],
        p.[SubmitterName],
        s.TenTrangThai AS [Status],
        p.[CreatedAt],
        CONVERT(NVARCHAR(10), dd.[VisitDate], 23) AS OnboardDate,
        dd.[Destination]
    FROM [dbo].[CSR_Projects] p
        INNER JOIN [dbo].[CSR_Statuses] s ON p.[StatusId] = s.[Id]
        INNER JOIN DateDest dd ON dd.[Project_id] = p.[Project_id]
    WHERE p.[StatusId] IN (8, 4, 5, 7) -- Chờ phản hồi (8), PRD đã duyệt (4), BOD đã duyệt (5), Hoàn thành (7)
        AND p.[RecordType] = 1
        AND dd.[VisitDate] IS NOT NULL
        AND CONVERT(NVARCHAR(10), dd.[VisitDate], 23) >= @StartDate
        AND CONVERT(NVARCHAR(10), dd.[VisitDate], 23) <= @EndDate
    ORDER BY CONVERT(NVARCHAR(10), dd.[VisitDate], 23) ASC, p.[Project_id] ASC;
END
GO

PRINT 'Migration 70: usp_GetGuestCalendar now shows submissions without CSR_Tasks rows (Partner/Supplier/Khách vãng lai/Ứng viên phỏng vấn) using AgendaJsonData as date/destination source.';
GO