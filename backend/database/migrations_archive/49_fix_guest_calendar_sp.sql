USE CSR_DB;
GO

-- 4. guest-calendar.js — 1 inline query
CREATE OR ALTER PROCEDURE [dbo].[usp_GetGuestCalendar]
    @StartDate NVARCHAR(10),
    @EndDate   NVARCHAR(10)
AS
BEGIN
    SET NOCOUNT ON;

    -- Tự động cập nhật trạng thái Hoàn thành trước khi truy vấn
    UPDATE p
    SET p.[StatusId] = 7, p.[UpdatedAt] = GETDATE() -- 7 is Hoàn thành
    FROM [dbo].[CSR_Projects] p
    WHERE p.[StatusId] = 5 -- 5 is BOD đã duyệt
      AND p.[RecordType] = 1
      AND NOT EXISTS (
          SELECT 1 FROM [dbo].[CSR_Tasks] t
          WHERE t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1
            AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)
      )
      AND EXISTS (
          SELECT 1 FROM [dbo].[CSR_Tasks] t
          WHERE t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1
      );

    -- Lấy các đơn ACTIVE trong tháng, trả chuỗi yyyy-MM-dd để tránh timezone shift
    SELECT DISTINCT
      p.[Project_id],
      p.[CustomerName],
      p.[CustomerType],
      p.[MeetingTopic],
      p.[SubmitterName],
      s.TenTrangThai AS [Status],
      p.[CreatedAt],
      CONVERT(NVARCHAR(10), t.[OnboardDate], 23) AS OnboardDate,
      t.[Destination]
    FROM [dbo].[CSR_Projects] p
    INNER JOIN [dbo].[CSR_Statuses] s ON p.[StatusId] = s.[Id]
    INNER JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1
    WHERE p.[StatusId] IN (8, 4, 5, 7) -- Chờ phản hồi (8), PRD đã duyệt (4), BOD đã duyệt (5), Hoàn thành (7)
      AND p.[RecordType] = 1
      AND CONVERT(NVARCHAR(10), t.[OnboardDate], 23) >= @StartDate
      AND CONVERT(NVARCHAR(10), t.[OnboardDate], 23) <= @EndDate
    ORDER BY CONVERT(NVARCHAR(10), t.[OnboardDate], 23) ASC, p.[Project_id] ASC;
END
GO

PRINT 'Fix for usp_GetGuestCalendar migration applied successfully!';
GO
