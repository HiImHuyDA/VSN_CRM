-- Migration 72: Fix usp_Dashboard_GetStats for taskless submissions (such as Candidate Interviews) and restrict to specific statuses
-- Bug: Dashboard statistics and customer lists missing submissions that do not require tasks (e.g. Candidate Interviews, Suppliers, Partners, Casual guests) due to INNER JOIN CSR_Tasks.
-- Additionally, filters status dynamically: only includes Chờ phản hồi (8), PRD đã duyệt (4), BOD đã duyệt (5), and Hoàn thành (7).
-- Also supports edited submissions (RecordType = 2) by using latest versions instead of hardcoded RecordType = 1.

USE CSR_DB;
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_Dashboard_GetStats]
    @ActorRole NVARCHAR(50) = '',
    @ActorMNV  NVARCHAR(50) = ''
AS
BEGIN
    SET NOCOUNT ON;

    -- Lấy Email của Actor
    DECLARE @ActorEmail NVARCHAR(200) = '';
    IF @ActorMNV IS NOT NULL AND @ActorMNV != ''
    BEGIN
        SELECT TOP 1 @ActorEmail = [Email] FROM [dbo].[CSR_Employees] WHERE [MNV] = @ActorMNV;
    END

    -- 1. Tạo bảng tạm lưu các đơn bản ghi phiên bản mới nhất
    SELECT p.*
    INTO #LatestProjects
    FROM [dbo].[CSR_Projects] p
    INNER JOIN (
        SELECT [Project_id], ROW_NUMBER() OVER (PARTITION BY [ParentId] ORDER BY [Version] DESC) as rn
        FROM [dbo].[CSR_Projects]
    ) lv ON p.[Project_id] = lv.[Project_id] AND lv.rn = 1;

    -- 2. Tạo bảng tạm lưu thông tin ngày đi và địa điểm gộp từ cả đơn có Task và đơn không có Task
    SELECT
        p.[Project_id],
        t.[OnboardDate] AS [VisitDate],
        t.[Destination] COLLATE DATABASE_DEFAULT AS [Destination],
        t.[AssigneeEmail],
        t.[SupervisorEmail]
    INTO #DateDest
    FROM #LatestProjects p
    INNER JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1

    UNION ALL

    SELECT
        p.[Project_id],
        TRY_CAST(j.[VisitDateStr] AS DATE) AS [VisitDate],
        d.[key] COLLATE DATABASE_DEFAULT AS [Destination],
        NULL AS [AssigneeEmail],
        NULL AS [SupervisorEmail]
    FROM #LatestProjects p
    CROSS APPLY OPENJSON(p.[AgendaJsonData])
        WITH ([VisitDateStr] NVARCHAR(20) '$.date', [agenda] NVARCHAR(MAX) '$.agenda' AS JSON) j
    CROSS APPLY OPENJSON(j.[agenda]) d
    WHERE p.[AgendaJsonData] IS NOT NULL
        AND NOT EXISTS (
            SELECT 1
            FROM [dbo].[CSR_Tasks] t2
            WHERE t2.[Project_id] = p.[Project_id]
        );

    -- 3. Tính toán các Stats KPI (Tổng đơn tháng, Đang chờ, Lịch tuần này, Task gần deadline)
    -- Thẻ 1: Tổng đơn tháng
    DECLARE @TotalSubmissionsMonth INT;
    SELECT @TotalSubmissionsMonth = COUNT(DISTINCT p.[Project_id]) 
    FROM #LatestProjects p
    INNER JOIN #DateDest dd ON dd.[Project_id] = p.[Project_id]
    WHERE p.[StatusId] IN (8, 4, 5, 7) -- Chờ phản hồi (8), PRD đã duyệt (4), BOD đã duyệt (5), Hoàn thành (7)
      AND YEAR(dd.[VisitDate]) = YEAR(GETDATE()) 
      AND MONTH(dd.[VisitDate]) = MONTH(GETDATE())
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR p.[SubmitterMNV] = @ActorMNV
      );

    -- Đơn tháng trước (MoM) để so sánh
    DECLARE @PrevMonthCount INT;
    SELECT @PrevMonthCount = COUNT(DISTINCT p.[Project_id])
    FROM #LatestProjects p
    INNER JOIN #DateDest dd ON dd.[Project_id] = p.[Project_id]
    WHERE p.[StatusId] IN (8, 4, 5, 7) -- Chờ phản hồi (8), PRD đã duyệt (4), BOD đã duyệt (5), Hoàn thành (7)
      AND YEAR(dd.[VisitDate]) = YEAR(DATEADD(month, -1, GETDATE()))
      AND MONTH(dd.[VisitDate]) = MONTH(DATEADD(month, -1, GETDATE()))
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR p.[SubmitterMNV] = @ActorMNV
      );

    DECLARE @SubmissionsMonthMoM FLOAT = NULL;
    IF @PrevMonthCount > 0
        SET @SubmissionsMonthMoM = ROUND((CAST(@TotalSubmissionsMonth - @PrevMonthCount AS FLOAT) / @PrevMonthCount) * 100.0, 1);

    -- Thẻ 2: Đang chờ tiếp đón
    DECLARE @FutureReceptionsCount INT;
    SELECT @FutureReceptionsCount = COUNT(DISTINCT p.[Project_id])
    FROM #LatestProjects p
    INNER JOIN #DateDest dd ON dd.[Project_id] = p.[Project_id]
    WHERE p.[StatusId] IN (8, 4, 5, 7) -- Chờ phản hồi (8), PRD đã duyệt (4), BOD đã duyệt (5), Hoàn thành (7)
      AND dd.[VisitDate] > CAST(GETDATE() AS DATE)
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR p.[SubmitterMNV] = @ActorMNV
          OR dd.[AssigneeEmail] = @ActorEmail
          OR dd.[SupervisorEmail] = @ActorEmail
      );

    -- Thẻ 3: Lịch hẹn tuần này
    DECLARE @WeeklyScheduleCount INT;
    SELECT @WeeklyScheduleCount = COUNT(DISTINCT p.[Project_id])
    FROM #LatestProjects p
    INNER JOIN #DateDest dd ON dd.[Project_id] = p.[Project_id]
    WHERE p.[StatusId] IN (8, 4, 5, 7) -- Chờ phản hồi (8), PRD đã duyệt (4), BOD đã duyệt (5), Hoàn thành (7)
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR p.[SubmitterMNV] = @ActorMNV
          OR dd.[AssigneeEmail] = @ActorEmail
          OR dd.[SupervisorEmail] = @ActorEmail
      )
      AND dd.[VisitDate] >= DATEADD(wk, DATEDIFF(wk, 0, GETDATE()), 0)
      AND dd.[VisitDate] <= DATEADD(wk, DATEDIFF(wk, 0, GETDATE()), 6);

    -- Thẻ 4: Các task gần tới deadline
    DECLARE @TasksNearDeadlineCount INT;
    SELECT @TasksNearDeadlineCount = COUNT(*)
    FROM [dbo].[CSR_Tasks] t
    INNER JOIN #LatestProjects p ON p.[Project_id] = t.[Project_id]
    WHERE t.[StatusId] = 1
      AND t.[TaskStatus] != N'Hoàn thành'
      AND p.[StatusId] IN (8, 4, 5, 7) -- Chờ phản hồi (8), PRD đã duyệt (4), BOD đã duyệt (5), Hoàn thành (7)
      AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR t.[AssigneeEmail] = @ActorEmail
          OR t.[SupervisorEmail] = @ActorEmail
      )
      AND t.[DeadlineDate] >= CAST(GETDATE() AS DATE)
      AND t.[DeadlineDate] <= DATEADD(DAY, 3, CAST(GETDATE() AS DATE));

    -- OUTPUT 1: Stats KPI
    SELECT 
        ISNULL(@TotalSubmissionsMonth, 0) AS [TotalSubmissionsMonth],
        @SubmissionsMonthMoM AS [SubmissionsMonthMoM],
        ISNULL(@FutureReceptionsCount, 0) AS [FutureReceptionsCount],
        ISNULL(@WeeklyScheduleCount, 0) AS [WeeklyScheduleCount],
        ISNULL(@TasksNearDeadlineCount, 0) AS [TasksNearDeadlineCount];

    -- OUTPUT 2: Thống kê theo tháng (Dataset 1)
    SELECT
        m.[Month],
        COUNT(DISTINCT p.[Project_id]) AS [Total]
    FROM (
        SELECT 1 AS [Month] UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION 
        SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12
    ) m
    LEFT JOIN #LatestProjects p ON p.[StatusId] IN (8, 4, 5, 7) -- Chờ phản hồi (8), PRD đã duyệt (4), BOD đã duyệt (5), Hoàn thành (7)
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR p.[SubmitterMNV] = @ActorMNV
      )
      AND EXISTS (
          SELECT 1 FROM #DateDest dd 
          WHERE dd.[Project_id] = p.[Project_id]
            AND YEAR(dd.[VisitDate]) = YEAR(GETDATE()) 
            AND MONTH(dd.[VisitDate]) = m.[Month]
      )
    GROUP BY m.[Month]
    ORDER BY m.[Month] ASC;

    -- OUTPUT 3: Lịch tiếp đón trong tháng hiện tại (Dataset 2 - Lịch nhỏ)
    SELECT DISTINCT
        CONVERT(NVARCHAR(10), dd.[VisitDate], 23) AS [OnboardDate],
        CASE WHEN dd.[VisitDate] >= CAST(GETDATE() AS DATE) THEN 'green' ELSE 'gray' END AS [DotColor]
    FROM #LatestProjects p
    INNER JOIN #DateDest dd ON dd.[Project_id] = p.[Project_id]
    WHERE p.[StatusId] IN (8, 4, 5, 7) -- Chờ phản hồi (8), PRD đã duyệt (4), BOD đã duyệt (5), Hoàn thành (7)
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR p.[SubmitterMNV] = @ActorMNV
      )
      AND YEAR(dd.[VisitDate]) = YEAR(GETDATE()) 
      AND MONTH(dd.[VisitDate]) = MONTH(GETDATE());

    -- OUTPUT 4: Thông báo chờ phê duyệt (Dataset 3)
    SELECT DISTINCT TOP 20
        p.[Project_id] AS [ProjectId],
        p.[CustomerName],
        s.TenTrangThai AS [Status],
        p.[CreatedAt],
        [OnboardDates] = STUFF((
            SELECT DISTINCT ', ' + CONVERT(NVARCHAR(10), dd2.[VisitDate], 103)
            FROM #DateDest dd2
            WHERE dd2.[Project_id] = p.[Project_id]
            FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'), 1, 2, '')
    FROM #LatestProjects p
    INNER JOIN [dbo].[CSR_Statuses] s ON p.[StatusId] = s.[Id]
    WHERE p.[StatusId] IN (8, 4) -- Chờ phản hồi (8), PRD đã duyệt (4)
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR p.[SubmitterMNV] = @ActorMNV
      )
    ORDER BY p.[CreatedAt] DESC;

    -- OUTPUT 5: Danh sách khách trong tháng hiện tại (Dataset 4)
    SELECT DISTINCT
        p.[Project_id] AS [ProjectId],
        p.[CustomerName],
        p.[CustomerType],
        p.[SubmitterName],
        s.TenTrangThai AS [Status],
        CONVERT(NVARCHAR(10), p.[CreatedAt], 23) AS [CreatedAt],
        p.[MeetingTopic] AS [MeetingTopic],
        STUFF((
            SELECT DISTINCT ', ' + CONVERT(NVARCHAR(10), dd2.[VisitDate], 103)
            FROM #DateDest dd2
            WHERE dd2.[Project_id] = p.[Project_id]
            FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS [OnboardDates]
    FROM #LatestProjects p
    INNER JOIN [dbo].[CSR_Statuses] s ON p.[StatusId] = s.[Id]
    INNER JOIN #DateDest dd ON dd.[Project_id] = p.[Project_id]
    WHERE p.[StatusId] IN (8, 4, 5, 7) -- Chờ phản hồi (8), PRD đã duyệt (4), BOD đã duyệt (5), Hoàn thành (7)
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR p.[SubmitterMNV] = @ActorMNV
          OR dd.[AssigneeEmail] = @ActorEmail
          OR dd.[SupervisorEmail] = @ActorEmail
      )
      AND YEAR(dd.[VisitDate]) = YEAR(GETDATE())
      AND MONTH(dd.[VisitDate]) = MONTH(GETDATE())
    ORDER BY [ProjectId] DESC;

    -- OUTPUT 6: Lịch hoàn thành công việc chuẩn bị (Dataset 5)
    SELECT 
        t.[Task_id] AS [TaskId],
        t.[Project_id] AS [ProjectId],
        p.[CustomerName],
        t.[TaskName],
        t.[Destination],
        t.[Assignee],
        CONVERT(NVARCHAR(10), t.[DeadlineDate], 23) AS [DeadlineDate],
        t.[TaskStatus],
        CASE 
            WHEN t.[TaskStatus] = N'Hoàn thành' OR t.[OnboardDate] < CAST(GETDATE() AS DATE) THEN N'Hoàn thành'
            WHEN t.[DeadlineDate] < CAST(GETDATE() AS DATE) THEN N'Delay'
            WHEN t.[TaskStatus] = N'Chưa bắt đầu' THEN N'Chưa bắt đầu'
            ELSE N'Đang xử lý'
        END AS [ComputedStatus]
    FROM [dbo].[CSR_Tasks] t
    INNER JOIN #LatestProjects p ON t.[Project_id] = p.[Project_id]
    WHERE t.[StatusId] = 1
      AND p.[StatusId] IN (8, 4, 5, 7) -- Chờ phản hồi (8), PRD đã duyệt (4), BOD đã duyệt (5), Hoàn thành (7)
      AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR t.[AssigneeEmail] = @ActorEmail
          OR t.[SupervisorEmail] = @ActorEmail
      )
      AND YEAR(t.[DeadlineDate]) = YEAR(GETDATE())
      AND MONTH(t.[DeadlineDate]) = MONTH(GETDATE())
    ORDER BY t.[DeadlineDate] ASC;

    -- Dọn dẹp bảng tạm
    DROP TABLE #LatestProjects;
    DROP TABLE #DateDest;
END;
GO

PRINT 'Migration 72: Updated usp_Dashboard_GetStats using temp tables to support taskless submissions (such as Candidate Interviews) and filter by specific status IDs.';
GO
