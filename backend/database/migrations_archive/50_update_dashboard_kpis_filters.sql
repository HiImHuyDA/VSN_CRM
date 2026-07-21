USE CSR_DB;
GO

-- A. usp_Dashboard_GetStats
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

    -- 1. Stats KPI (Tổng đơn tháng, Đang chờ, Lịch tuần này, Task gần deadline)
    DECLARE @TotalSubmissionsMonth INT;
    SELECT @TotalSubmissionsMonth = COUNT(DISTINCT p.[Project_id]) 
    FROM [dbo].[CSR_Projects] p
    INNER JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1
    WHERE p.[RecordType] = 1 
      AND p.[StatusId] NOT IN (6, 9) -- Loại bỏ BOD từ chối (6) và Đã hủy (9)
      AND YEAR(t.[OnboardDate]) = YEAR(GETDATE()) 
      AND MONTH(t.[OnboardDate]) = MONTH(GETDATE())
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR p.[SubmitterMNV] = @ActorMNV
      );

    -- Đơn tháng trước (MoM) để so sánh
    DECLARE @PrevMonthCount INT;
    SELECT @PrevMonthCount = COUNT(DISTINCT p.[Project_id])
    FROM [dbo].[CSR_Projects] p
    INNER JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1
    WHERE p.[RecordType] = 1 
      AND p.[StatusId] NOT IN (6, 9) -- Loại bỏ BOD từ chối (6) và Đã hủy (9)
      AND YEAR(t.[OnboardDate]) = YEAR(DATEADD(month, -1, GETDATE()))
      AND MONTH(t.[OnboardDate]) = MONTH(DATEADD(month, -1, GETDATE()))
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
    FROM [dbo].[CSR_Projects] p
    INNER JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1
    WHERE p.[RecordType] = 1 
      AND p.[StatusId] NOT IN (6, 9) -- Loại bỏ BOD từ chối (6) và Đã hủy (9)
      AND t.[OnboardDate] > CAST(GETDATE() AS DATE)
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR p.[SubmitterMNV] = @ActorMNV
          OR t.[AssigneeEmail] = @ActorEmail
          OR t.[SupervisorEmail] = @ActorEmail
      );

    -- Thẻ 3: Lịch hẹn tuần này
    DECLARE @WeeklyScheduleCount INT;
    SELECT @WeeklyScheduleCount = COUNT(DISTINCT p.[Project_id])
    FROM [dbo].[CSR_Projects] p
    INNER JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1
    WHERE p.[RecordType] = 1 
      AND p.[StatusId] NOT IN (6, 9) -- Loại bỏ BOD từ chối (6) và Đã hủy (9)
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR p.[SubmitterMNV] = @ActorMNV
          OR t.[AssigneeEmail] = @ActorEmail
          OR t.[SupervisorEmail] = @ActorEmail
      )
      AND t.[OnboardDate] >= DATEADD(wk, DATEDIFF(wk, 0, GETDATE()), 0)
      AND t.[OnboardDate] <= DATEADD(wk, DATEDIFF(wk, 0, GETDATE()), 6);

    -- Thẻ 4: Các task gần tới deadline
    DECLARE @TasksNearDeadlineCount INT;
    SELECT @TasksNearDeadlineCount = COUNT(*)
    FROM [dbo].[CSR_Tasks] t
    INNER JOIN [dbo].[CSR_Projects] p ON p.[Project_id] = t.[Project_id]
    WHERE t.[StatusId] = 1
      AND t.[TaskStatus] != N'Hoàn thành'
      AND p.[StatusId] NOT IN (6, 9) -- Loại bỏ BOD từ chối (6) và Đã hủy (9)
      AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR t.[AssigneeEmail] = @ActorEmail
          OR t.[SupervisorEmail] = @ActorEmail
      )
      AND t.[DeadlineDate] >= CAST(GETDATE() AS DATE)
      AND t.[DeadlineDate] <= DATEADD(DAY, 3, CAST(GETDATE() AS DATE));

    SELECT 
        ISNULL(@TotalSubmissionsMonth, 0) AS [TotalSubmissionsMonth],
        @SubmissionsMonthMoM AS [SubmissionsMonthMoM],
        ISNULL(@FutureReceptionsCount, 0) AS [FutureReceptionsCount],
        ISNULL(@WeeklyScheduleCount, 0) AS [WeeklyScheduleCount],
        ISNULL(@TasksNearDeadlineCount, 0) AS [TasksNearDeadlineCount];

    -- 2. Thống kê theo tháng (Dataset 1)
    SELECT
        m.[Month],
        COUNT(DISTINCT p.[Project_id]) AS [Total]
    FROM (
        SELECT 1 AS [Month] UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION 
        SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12
    ) m
    LEFT JOIN [dbo].[CSR_Projects] p ON p.[RecordType] = 1 AND p.[StatusId] NOT IN (6, 9) -- Loại bỏ BOD từ chối (6) và Đã hủy (9)
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR p.[SubmitterMNV] = @ActorMNV
      )
      AND EXISTS (
          SELECT 1 FROM [dbo].[CSR_Tasks] t 
          WHERE t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1 
            AND YEAR(t.[OnboardDate]) = YEAR(GETDATE()) 
            AND MONTH(t.[OnboardDate]) = m.[Month]
      )
    GROUP BY m.[Month]
    ORDER BY m.[Month] ASC;

    -- 3. Lịch tiếp đón trong tháng hiện tại (Dataset 2 - Lịch nhỏ)
    SELECT DISTINCT
        CONVERT(NVARCHAR(10), t.[OnboardDate], 23) AS [OnboardDate],
        CASE WHEN t.[OnboardDate] >= CAST(GETDATE() AS DATE) THEN 'green' ELSE 'gray' END AS [DotColor]
    FROM [dbo].[CSR_Projects] p
    INNER JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1
    WHERE p.[RecordType] = 1 
      AND p.[StatusId] NOT IN (6, 9) -- Loại bỏ BOD từ chối (6) và Đã hủy (9)
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR p.[SubmitterMNV] = @ActorMNV
      )
      AND YEAR(t.[OnboardDate]) = YEAR(GETDATE()) 
      AND MONTH(t.[OnboardDate]) = MONTH(GETDATE());

    -- 4. Thông báo chờ phê duyệt (Dataset 3)
    SELECT DISTINCT TOP 20
        p.[Project_id] AS [ProjectId],
        p.[CustomerName],
        s.TenTrangThai AS [Status],
        p.[CreatedAt],
        [OnboardDates] = STUFF((
            SELECT DISTINCT ', ' + CONVERT(NVARCHAR(10), t2.[OnboardDate], 103)
            FROM [dbo].[CSR_Tasks] t2
            WHERE t2.[Project_id] = p.[Project_id] AND t2.[StatusId] = 1
            FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'), 1, 2, '')
    FROM [dbo].[CSR_Projects] p
    INNER JOIN [dbo].[CSR_Statuses] s ON p.[StatusId] = s.[Id]
    WHERE p.[RecordType] = 1 
      AND p.[StatusId] IN (8, 4) -- Chờ phản hồi, PRD đã duyệt
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR p.[SubmitterMNV] = @ActorMNV
      )
    ORDER BY p.[CreatedAt] DESC;

    -- 5. Danh sách khách trong tháng hiện tại (Dataset 4)
    SELECT DISTINCT
        p.[Project_id] AS [ProjectId],
        p.[CustomerName],
        p.[CustomerType],
        p.[SubmitterName],
        s.TenTrangThai AS [Status],
        CONVERT(NVARCHAR(10), p.[CreatedAt], 23) AS [CreatedAt],
        (SELECT TOP 1 [MeetingTopic] FROM [dbo].[CSR_Projects] WHERE [Project_id] = p.[Project_id]) AS [MeetingTopic],
        STUFF((
            SELECT DISTINCT ', ' + CONVERT(NVARCHAR(10), t2.[OnboardDate], 103)
            FROM [dbo].[CSR_Tasks] t2
            WHERE t2.[Project_id] = p.[Project_id] AND t2.[StatusId] = 1
            FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS [OnboardDates]
    FROM [dbo].[CSR_Projects] p
    INNER JOIN [dbo].[CSR_Statuses] s ON p.[StatusId] = s.[Id]
    INNER JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1
    WHERE p.[RecordType] = 1 
      AND p.[StatusId] NOT IN (6, 9) -- Loại bỏ BOD từ chối (6) và Đã hủy (9)
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR p.[SubmitterMNV] = @ActorMNV
          OR t.[AssigneeEmail] = @ActorEmail
          OR t.[SupervisorEmail] = @ActorEmail
      )
      AND YEAR(t.[OnboardDate]) = YEAR(GETDATE())
      AND MONTH(t.[OnboardDate]) = MONTH(GETDATE())
    ORDER BY [ProjectId] DESC;

    -- 6. Lịch hoàn thành công việc chuẩn bị (Dataset 5)
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
    INNER JOIN [dbo].[CSR_Projects] p ON t.[Project_id] = p.[Project_id]
    WHERE t.[StatusId] = 1
      AND p.[StatusId] NOT IN (6, 9) -- Loại bỏ BOD từ chối (6) và Đã hủy (9)
      AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR t.[AssigneeEmail] = @ActorEmail
          OR t.[SupervisorEmail] = @ActorEmail
      )
      AND YEAR(t.[DeadlineDate]) = YEAR(GETDATE())
      AND MONTH(t.[DeadlineDate]) = MONTH(GETDATE())
    ORDER BY t.[DeadlineDate] ASC;
END;
GO

PRINT 'Fix for usp_Dashboard_GetStats (excl 6 and 9) migration applied successfully!';
GO
