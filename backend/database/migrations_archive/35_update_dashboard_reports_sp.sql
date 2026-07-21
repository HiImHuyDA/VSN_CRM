USE CSR_DB;
GO

-- ============================================================
-- 1. usp_GetDashboardV2
-- Cập nhật cấu trúc trả về phục vụ màn hình Tổng quan mới
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_GetDashboardV2]
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
    -- Thẻ 1: Tổng số đơn tiếp đón tháng hiện tại (không bao gồm đơn huỷ)
    DECLARE @TotalSubmissionsMonth INT;
    SELECT @TotalSubmissionsMonth = COUNT(*) 
    FROM [dbo].[CSR_Projects] 
    WHERE [RecordType] = 1 
      AND [Status] != N'Đã huỷ' 
      AND YEAR([CreatedAt]) = YEAR(GETDATE()) 
      AND MONTH([CreatedAt]) = MONTH(GETDATE())
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR [SubmitterMNV] = @ActorMNV
      );

    -- Thẻ 2: Đang chờ (những đơn tiếp đón chưa tới ngày tiếp đón)
    DECLARE @FutureReceptionsCount INT;
    SELECT @FutureReceptionsCount = COUNT(DISTINCT p.[Project_id])
    FROM [dbo].[CSR_Projects] p
    INNER JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[IsActive] = 1
    WHERE p.[RecordType] = 1 
      AND p.[Status] != N'Đã huỷ'
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR p.[SubmitterMNV] = @ActorMNV
          OR t.[AssigneeEmail] = @ActorEmail
          OR t.[SupervisorEmail] = @ActorEmail
      )
      AND NOT EXISTS (
          SELECT 1 FROM [dbo].[CSR_Tasks] t2 
          WHERE t2.[Project_id] = p.[Project_id] AND t2.[IsActive] = 1 
            AND t2.[OnboardDate] <= CAST(GETDATE() AS DATE)
      );

    -- Thẻ 3: Lịch hẹn tuần này (từ thứ 2 đến chủ nhật tuần hiện tại)
    DECLARE @WeeklyScheduleCount INT;
    SELECT @WeeklyScheduleCount = COUNT(DISTINCT p.[Project_id])
    FROM [dbo].[CSR_Projects] p
    INNER JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[IsActive] = 1
    WHERE p.[RecordType] = 1 
      AND p.[Status] != N'Đã huỷ'
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR p.[SubmitterMNV] = @ActorMNV
          OR t.[AssigneeEmail] = @ActorEmail
          OR t.[SupervisorEmail] = @ActorEmail
      )
      AND t.[OnboardDate] >= DATEADD(wk, DATEDIFF(wk, 0, GETDATE()), 0)
      AND t.[OnboardDate] <= DATEADD(wk, DATEDIFF(wk, 0, GETDATE()), 6);

    -- Thẻ 4: Các task gần tới deadline (khoảng 3 ngày so với deadline, chưa hoàn thành)
    DECLARE @TasksNearDeadlineCount INT;
    SELECT @TasksNearDeadlineCount = COUNT(*)
    FROM [dbo].[CSR_Tasks] t
    INNER JOIN [dbo].[CSR_Projects] p ON p.[Project_id] = t.[Project_id]
    WHERE t.[IsActive] = 1
      AND t.[TaskStatus] != N'Hoàn thành'
      AND p.[Status] != N'Đã huỷ'
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR t.[AssigneeEmail] = @ActorEmail
          OR t.[SupervisorEmail] = @ActorEmail
      )
      AND t.[DeadlineDate] >= CAST(GETDATE() AS DATE)
      AND t.[DeadlineDate] <= DATEADD(DAY, 3, CAST(GETDATE() AS DATE));

    -- Trả về bảng Stats (Dataset 0)
    SELECT 
        ISNULL(@TotalSubmissionsMonth, 0) AS [TotalSubmissionsMonth],
        ISNULL(@FutureReceptionsCount, 0) AS [FutureReceptionsCount],
        ISNULL(@WeeklyScheduleCount, 0) AS [WeeklyScheduleCount],
        ISNULL(@TasksNearDeadlineCount, 0) AS [TasksNearDeadlineCount];

    -- 2. Thống kê số lượng đơn tiếp đón theo từng tháng trong năm hiện tại (Dataset 1)
    SELECT
        m.[Month],
        COUNT(DISTINCT p.[Project_id]) AS [Total]
    FROM (
        SELECT 1 AS [Month] UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION 
        SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12
    ) m
    LEFT JOIN [dbo].[CSR_Projects] p ON p.[RecordType] = 1 AND p.[Status] != N'Đã huỷ'
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR p.[SubmitterMNV] = @ActorMNV
      )
      AND EXISTS (
          SELECT 1 FROM [dbo].[CSR_Tasks] t 
          WHERE t.[Project_id] = p.[Project_id] AND t.[IsActive] = 1 
            AND YEAR(t.[OnboardDate]) = YEAR(GETDATE()) 
            AND MONTH(t.[OnboardDate]) = m.[Month]
      )
    GROUP BY m.[Month]
    ORDER BY m.[Month] ASC;

    -- 3. Lịch tiếp đón trong tháng hiện tại: chấm tròn xanh/xám (Dataset 2)
    SELECT DISTINCT
        CONVERT(NVARCHAR(10), t.[OnboardDate], 23) AS [OnboardDate],
        CASE WHEN t.[OnboardDate] >= CAST(GETDATE() AS DATE) THEN 'green' ELSE 'gray' END AS [DotColor]
    FROM [dbo].[CSR_Projects] p
    INNER JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[IsActive] = 1
    WHERE p.[RecordType] = 1 
      AND p.[Status] IN (N'BOD đã duyệt', N'Hoàn thành')
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR p.[SubmitterMNV] = @ActorMNV
      )
      AND YEAR(t.[OnboardDate]) = YEAR(GETDATE()) 
      AND MONTH(t.[OnboardDate]) = MONTH(GETDATE());

    -- 4. Thông báo: những đơn đang chờ phản hồi, chờ BOD duyệt (PRD đã duyệt) (Dataset 3)
    SELECT TOP 20
        n.[Id], n.[Message], n.[IsRead], n.[CreatedAt], n.[ProjectId], p.[Status] AS [ProjectStatus]
    FROM [dbo].[CSR_Notifications] n
    INNER JOIN [dbo].[CSR_Projects] p ON n.[ProjectId] = p.[Project_id]
    WHERE p.[Status] IN (N'Chờ phản hồi', N'PRD đã duyệt', N'Đã gửi-Chờ phản hồi')
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR p.[SubmitterMNV] = @ActorMNV
          OR EXISTS (
              SELECT 1 FROM [dbo].[CSR_Tasks] t 
              WHERE t.[Project_id] = p.[Project_id] AND t.[IsActive] = 1 
                AND (t.[AssigneeEmail] = @ActorEmail OR t.[SupervisorEmail] = @ActorEmail)
          )
      )
    ORDER BY n.[CreatedAt] DESC;

    -- 5. Danh sách khách có ngày tiếp đón trong tháng hiện tại (Dataset 4)
    SELECT DISTINCT
        p.[Project_id] AS [ProjectId],
        p.[CustomerName],
        p.[CustomerType],
        p.[SubmitterName],
        p.[Status],
        CONVERT(NVARCHAR(10), p.[CreatedAt], 23) AS [CreatedAt],
        (SELECT TOP 1 [MeetingTopic] FROM [dbo].[CSR_Projects] WHERE [Project_id] = p.[Project_id]) AS [MeetingTopic],
        STUFF((
            SELECT DISTINCT ', ' + CONVERT(NVARCHAR(10), t2.[OnboardDate], 103)
            FROM [dbo].[CSR_Tasks] t2
            WHERE t2.[Project_id] = p.[Project_id] AND t2.[IsActive] = 1
            FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS [OnboardDates]
    FROM [dbo].[CSR_Projects] p
    INNER JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[IsActive] = 1
    WHERE p.[RecordType] = 1 
      AND p.[Status] != N'Đã huỷ'
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
            WHEN t.[TaskStatus] = N'Đang xử lý' OR (t.[TaskStatus] != N'Hoàn thành' AND t.[DeadlineDate] >= CAST(GETDATE() AS DATE) AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)) THEN N'Đang xử lý'
            ELSE N'Delay'
        END AS [ComputedStatus]
    FROM [dbo].[CSR_Tasks] t
    INNER JOIN [dbo].[CSR_Projects] p ON t.[Project_id] = p.[Project_id]
    WHERE t.[IsActive] = 1
      AND p.[Status] != N'Đã huỷ'
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR t.[AssigneeEmail] = @ActorEmail
          OR t.[SupervisorEmail] = @ActorEmail
      )
      AND YEAR(t.[DeadlineDate]) = YEAR(GETDATE())
      AND MONTH(t.[DeadlineDate]) = MONTH(GETDATE())
      AND NOT EXISTS (
          SELECT 1 FROM [dbo].[CSR_Tasks] t2 
          WHERE t2.[Project_id] = p.[Project_id] 
            AND t2.[IsActive] = 1 
            AND t2.[OnboardDate] < CAST(GETDATE() AS DATE)
      )
    ORDER BY t.[DeadlineDate] ASC;

END
GO

-- ============================================================
-- 2. usp_GetReportsSummary
-- Thống kê tiếp đón: hỗ trợ 9 slicers, tính MoM/YoY và trả về đúng biểu đồ cột Ox onboard date
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_GetReportsSummary]
    @Year NVARCHAR(500) = NULL,
    @Month NVARCHAR(500) = NULL,
    @Week NVARCHAR(500) = NULL,
    @CustomerType NVARCHAR(MAX) = NULL,
    @CustomerName NVARCHAR(MAX) = NULL,
    @Destination NVARCHAR(MAX) = NULL,
    @Department NVARCHAR(MAX) = NULL,
    @ProjectStatus NVARCHAR(500) = NULL,
    @TaskStatus NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Lấy giá trị target đầu tiên để so sánh MoM/YoY nếu có truyền bộ lọc đơn lẻ, hoặc dùng ngày hiện tại làm mặc định
    DECLARE @TargetMonth INT = MONTH(GETDATE());
    DECLARE @TargetYear INT = YEAR(GETDATE());
    
    IF @Month IS NOT NULL AND @Month != '' AND CHARINDEX(',', @Month) = 0
        SET @TargetMonth = CAST(@Month AS INT);
        
    IF @Year IS NOT NULL AND @Year != '' AND CHARINDEX(',', @Year) = 0
        SET @TargetYear = CAST(@Year AS INT);

    -- Tạo bảng tạm lọc danh sách Project
    SELECT DISTINCT p.[Project_id], p.[SubmitDate], p.[CustomerType], p.[CustomerName], 
                    p.[SubmitterName], p.[Status], p.[CreatedAt], p.[UpdatedAt], p.[SubmitterMNV]
    INTO #FilteredProjects
    FROM [dbo].[CSR_Projects] p
    LEFT JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[IsActive] = 1
    LEFT JOIN [dbo].[CSR_Employees] e ON p.[SubmitterMNV] = e.[MNV]
    WHERE p.[RecordType] = 1
      AND p.[Status] != N'Đã huỷ'
      AND (@Year IS NULL OR @Year = '' OR YEAR(p.[CreatedAt]) IN (SELECT CAST(value AS INT) FROM STRING_SPLIT(@Year, ',')))
      AND (@Month IS NULL OR @Month = '' OR MONTH(p.[CreatedAt]) IN (SELECT CAST(value AS INT) FROM STRING_SPLIT(@Month, ',')))
      AND (@Week IS NULL OR @Week = '' OR DATEPART(WEEK, p.[CreatedAt]) IN (SELECT CAST(value AS INT) FROM STRING_SPLIT(@Week, ',')))
      AND (@CustomerType IS NULL OR @CustomerType = '' OR p.[CustomerType] IN (SELECT value FROM STRING_SPLIT(@CustomerType, ',')))
      AND (@CustomerName IS NULL OR @CustomerName = '' OR p.[CustomerName] IN (SELECT value FROM STRING_SPLIT(@CustomerName, ',')))
      AND (@Destination IS NULL OR @Destination = '' OR t.[Destination] IN (SELECT value FROM STRING_SPLIT(@Destination, ',')))
      AND (@Department IS NULL OR @Department = '' OR e.[Department] IN (SELECT value FROM STRING_SPLIT(@Department, ',')))
      AND (@ProjectStatus IS NULL OR @ProjectStatus = '' OR (
          p.[Status] IN (SELECT value FROM STRING_SPLIT(@ProjectStatus, ','))
          OR (CHARINDEX(N'Đang xử lý', @ProjectStatus) > 0 AND p.[Status] IN (N'PRD đã duyệt', N'BOD đã duyệt'))
          OR (CHARINDEX(N'Chờ phản hồi', @ProjectStatus) > 0 AND p.[Status] = N'Đã gửi-Chờ phản hồi')
      ))
      AND (@TaskStatus IS NULL OR @TaskStatus = '' OR EXISTS (
          SELECT 1 FROM STRING_SPLIT(@TaskStatus, ',')
          WHERE value = CASE 
              WHEN t.[TaskStatus] = N'Hoàn thành' OR t.[OnboardDate] < CAST(GETDATE() AS DATE) THEN N'Hoàn thành'
              WHEN t.[TaskStatus] = N'Đang xử lý' OR (t.[TaskStatus] != N'Hoàn thành' AND t.[DeadlineDate] >= CAST(GETDATE() AS DATE) AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)) THEN N'Đang xử lý'
              ELSE N'Delay'
          END
      ));

    -- KPI Cards (Có % MoM và % YoY)
    DECLARE @CurrCount INT, @PrevMonthCount INT, @PrevYearCount INT;
    SELECT @CurrCount = COUNT(*) FROM #FilteredProjects;
    
    -- Đơn tháng trước (MoM)
    DECLARE @PrevMonth INT = CASE WHEN @TargetMonth = 1 THEN 12 ELSE @TargetMonth - 1 END;
    DECLARE @PrevMonthYear INT = CASE WHEN @TargetMonth = 1 THEN @TargetYear - 1 ELSE @TargetYear END;
    
    SELECT @PrevMonthCount = COUNT(DISTINCT p.[Project_id])
    FROM [dbo].[CSR_Projects] p
    LEFT JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[IsActive] = 1
    LEFT JOIN [dbo].[CSR_Employees] e ON p.[SubmitterMNV] = e.[MNV]
    WHERE p.[RecordType] = 1 AND p.[Status] != N'Đã huỷ'
      AND YEAR(p.[CreatedAt]) = @PrevMonthYear AND MONTH(p.[CreatedAt]) = @PrevMonth
      AND (@CustomerType IS NULL OR @CustomerType = '' OR p.[CustomerType] IN (SELECT value FROM STRING_SPLIT(@CustomerType, ',')))
      AND (@CustomerName IS NULL OR @CustomerName = '' OR p.[CustomerName] IN (SELECT value FROM STRING_SPLIT(@CustomerName, ',')))
      AND (@Destination IS NULL OR @Destination = '' OR t.[Destination] IN (SELECT value FROM STRING_SPLIT(@Destination, ',')))
      AND (@Department IS NULL OR @Department = '' OR e.[Department] IN (SELECT value FROM STRING_SPLIT(@Department, ',')));

    -- Đơn cùng kỳ năm trước (YoY)
    SELECT @PrevYearCount = COUNT(DISTINCT p.[Project_id])
    FROM [dbo].[CSR_Projects] p
    LEFT JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[IsActive] = 1
    LEFT JOIN [dbo].[CSR_Employees] e ON p.[SubmitterMNV] = e.[MNV]
    WHERE p.[RecordType] = 1 AND p.[Status] != N'Đã huỷ'
      AND YEAR(p.[CreatedAt]) = @TargetYear - 1 AND MONTH(p.[CreatedAt]) = @TargetMonth
      AND (@CustomerType IS NULL OR @CustomerType = '' OR p.[CustomerType] IN (SELECT value FROM STRING_SPLIT(@CustomerType, ',')))
      AND (@CustomerName IS NULL OR @CustomerName = '' OR p.[CustomerName] IN (SELECT value FROM STRING_SPLIT(@CustomerName, ',')))
      AND (@Destination IS NULL OR @Destination = '' OR t.[Destination] IN (SELECT value FROM STRING_SPLIT(@Destination, ',')))
      AND (@Department IS NULL OR @Department = '' OR e.[Department] IN (SELECT value FROM STRING_SPLIT(@Department, ',')));

    -- Rating trung bình kỳ hiện tại, MoM, YoY
    DECLARE @CurrRating FLOAT, @PrevMonthRating FLOAT, @PrevYearRating FLOAT;
    SELECT @CurrRating = AVG(CAST(r.[Rating] AS FLOAT))
    FROM [dbo].[CSR_Reviews] r
    INNER JOIN #FilteredProjects p ON r.[ProjectId] = p.[Project_id];

    SELECT @PrevMonthRating = AVG(CAST(r.[Rating] AS FLOAT))
    FROM [dbo].[CSR_Reviews] r
    INNER JOIN [dbo].[CSR_Projects] p ON r.[ProjectId] = p.[Project_id]
    LEFT JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[IsActive] = 1
    LEFT JOIN [dbo].[CSR_Employees] e ON p.[SubmitterMNV] = e.[MNV]
    WHERE p.[RecordType] = 1 AND p.[Status] != N'Đã huỷ'
      AND YEAR(p.[CreatedAt]) = @PrevMonthYear AND MONTH(p.[CreatedAt]) = @PrevMonth
      AND (@CustomerType IS NULL OR @CustomerType = '' OR p.[CustomerType] IN (SELECT value FROM STRING_SPLIT(@CustomerType, ',')))
      AND (@CustomerName IS NULL OR @CustomerName = '' OR p.[CustomerName] IN (SELECT value FROM STRING_SPLIT(@CustomerName, ',')))
      AND (@Destination IS NULL OR @Destination = '' OR t.[Destination] IN (SELECT value FROM STRING_SPLIT(@Destination, ',')))
      AND (@Department IS NULL OR @Department = '' OR e.[Department] IN (SELECT value FROM STRING_SPLIT(@Department, ',')));

    SELECT @PrevYearRating = AVG(CAST(r.[Rating] AS FLOAT))
    FROM [dbo].[CSR_Reviews] r
    INNER JOIN [dbo].[CSR_Projects] p ON r.[ProjectId] = p.[Project_id]
    LEFT JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[IsActive] = 1
    LEFT JOIN [dbo].[CSR_Employees] e ON p.[SubmitterMNV] = e.[MNV]
    WHERE p.[RecordType] = 1 AND p.[Status] != N'Đã huỷ'
      AND YEAR(p.[CreatedAt]) = @TargetYear - 1 AND MONTH(p.[CreatedAt]) = @TargetMonth
      AND (@CustomerType IS NULL OR @CustomerType = '' OR p.[CustomerType] IN (SELECT value FROM STRING_SPLIT(@CustomerType, ',')))
      AND (@CustomerName IS NULL OR @CustomerName = '' OR p.[CustomerName] IN (SELECT value FROM STRING_SPLIT(@CustomerName, ',')))
      AND (@Destination IS NULL OR @Destination = '' OR t.[Destination] IN (SELECT value FROM STRING_SPLIT(@Destination, ',')))
      AND (@Department IS NULL OR @Department = '' OR e.[Department] IN (SELECT value FROM STRING_SPLIT(@Department, ',')));

    -- Thống kê công việc chuẩn bị
    DECLARE @TotalTasks INT, @CompletedTasks INT, @ProcessingTasks INT, @DelayTasks INT;
    SELECT 
        @TotalTasks = COUNT(*),
        @CompletedTasks = SUM(CASE WHEN [ComputedStatus] = N'Hoàn thành' THEN 1 ELSE 0 END),
        @ProcessingTasks = SUM(CASE WHEN [ComputedStatus] = N'Đang xử lý' THEN 1 ELSE 0 END),
        @DelayTasks = SUM(CASE WHEN [ComputedStatus] = N'Delay' THEN 1 ELSE 0 END)
    FROM (
        SELECT 
            CASE 
                WHEN t.[TaskStatus] = N'Hoàn thành' OR t.[OnboardDate] < CAST(GETDATE() AS DATE) THEN N'Hoàn thành'
                WHEN t.[TaskStatus] = N'Đang xử lý' OR (t.[TaskStatus] != N'Hoàn thành' AND t.[DeadlineDate] >= CAST(GETDATE() AS DATE) AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)) THEN N'Đang xử lý'
                ELSE N'Delay'
            END AS [ComputedStatus]
        FROM [dbo].[CSR_Tasks] t
        INNER JOIN #FilteredProjects p ON t.[Project_id] = p.[Project_id]
        WHERE t.[IsActive] = 1
    ) t_status;

    -- Output 1: KPIs
    SELECT 
        @CurrCount AS [TotalSubmissions],
        CASE WHEN @PrevMonthCount > 0 THEN ROUND((CAST(@CurrCount - @PrevMonthCount AS FLOAT) / @PrevMonthCount) * 100, 1) ELSE NULL END AS [TotalMoM],
        CASE WHEN @PrevYearCount > 0 THEN ROUND((CAST(@CurrCount - @PrevYearCount AS FLOAT) / @PrevYearCount) * 100, 1) ELSE NULL END AS [TotalYoY],
        
        ISNULL(SUM(CASE WHEN [Status] = N'Hoàn thành' THEN 1 ELSE 0 END), 0) AS [CompletedSubmissions],
        ISNULL(SUM(CASE WHEN [Status] IN (N'PRD đã duyệt', N'BOD đã duyệt') THEN 1 ELSE 0 END), 0) AS [ProcessingSubmissions],
        ISNULL(SUM(CASE WHEN [Status] IN (N'Đã gửi-Chờ phản hồi', N'Chờ phản hồi') THEN 1 ELSE 0 END), 0) AS [PendingSubmissions],
        
        ROUND(ISNULL(@CurrRating, 0), 2) AS [AverageRating],
        CASE WHEN @PrevMonthRating > 0 THEN ROUND(((@CurrRating - @PrevMonthRating) / @PrevMonthRating) * 100, 1) ELSE NULL END AS [RatingMoM],
        CASE WHEN @PrevYearRating > 0 THEN ROUND(((@CurrRating - @PrevYearRating) / @PrevYearRating) * 100, 1) ELSE NULL END AS [RatingYoY],

        ISNULL(@TotalTasks, 0) AS [TotalTasks],
        ISNULL(@CompletedTasks, 0) AS [CompletedTasks],
        ISNULL(@ProcessingTasks, 0) AS [ProcessingTasks],
        ISNULL(@DelayTasks, 0) AS [DelayTasks]
    FROM #FilteredProjects;

    -- Output 2: Tổng số đơn tiếp đón chạy theo tình trạng đơn, trục Ox đi theo ngày tiếp đón
    SELECT 
        CONVERT(NVARCHAR(10), t.[OnboardDate], 23) AS [OnboardDate],
        SUM(CASE WHEN p.[Status] = N'Hoàn thành' THEN 1 ELSE 0 END) AS [Completed],
        SUM(CASE WHEN p.[Status] IN (N'PRD đã duyệt', N'BOD đã duyệt') THEN 1 ELSE 0 END) AS [Processing],
        SUM(CASE WHEN p.[Status] IN (N'Đã gửi-Chờ phản hồi', N'Chờ phản hồi') THEN 1 ELSE 0 END) AS [Pending]
    FROM #FilteredProjects p
    INNER JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[IsActive] = 1
    GROUP BY t.[OnboardDate]
    ORDER BY t.[OnboardDate] ASC;

    -- Output 3: Tổng đơn tiếp đón từng phòng ban (Biểu đồ cột)
    SELECT 
        ISNULL(e.[Department], N'Không xác định') AS [Department],
        COUNT(DISTINCT p.[Project_id]) AS [Total]
    FROM #FilteredProjects p
    LEFT JOIN [dbo].[CSR_Employees] e ON p.[SubmitterMNV] = e.[MNV]
    GROUP BY e.[Department]
    ORDER BY [Total] DESC;

    -- Output 4: Tổng đơn tiếp đón theo địa điểm (Biểu đồ thanh ngang)
    SELECT 
        ISNULL(t.[Destination], N'Không xác định') AS [Destination], 
        COUNT(DISTINCT p.[Project_id]) AS [Count]
    FROM #FilteredProjects p
    INNER JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[IsActive] = 1
    GROUP BY t.[Destination]
    ORDER BY [Count] DESC;

    -- Output 5: Tỉ lệ đơn tiếp đón theo tình trạng (Biểu đồ tròn)
    SELECT 
        [Status], 
        COUNT(*) AS [Count]
    FROM #FilteredProjects
    GROUP BY [Status]
    ORDER BY [Count] DESC;

    -- Output 6: Top khách hàng tiếp đón nhiều nhất và rating đánh giá trung bình
    SELECT TOP 10 
        p.[CustomerName], 
        p.[CustomerType], 
        COUNT(DISTINCT p.[Project_id]) AS [VisitCount],
        ROUND(AVG(CAST(r.[Rating] AS FLOAT)), 2) AS [AverageRating]
    FROM #FilteredProjects p
    LEFT JOIN [dbo].[CSR_Reviews] r ON r.[ProjectId] = p.[Project_id]
    GROUP BY p.[CustomerName], p.[CustomerType]
    ORDER BY [VisitCount] DESC;

    -- Output 7: Chi tiết các đơn tiếp đón (Bảng)
    SELECT 
        [Project_id], 
        [CustomerName], 
        [CustomerType], 
        [MeetingTopic] = (SELECT TOP 1 MeetingTopic FROM [dbo].[CSR_Projects] WHERE Project_id = p.Project_id), 
        [SubmitterName], 
        [Status],
        [CreatedAt],
        [OnboardDates] = STUFF((
            SELECT DISTINCT ', ' + CONVERT(NVARCHAR(10), t2.[OnboardDate], 103)
            FROM [dbo].[CSR_Tasks] t2
            WHERE t2.[Project_id] = p.[Project_id] AND t2.[IsActive] = 1
            FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'), 1, 2, '')
    FROM #FilteredProjects p
    ORDER BY p.[CreatedAt] DESC;

    DROP TABLE #FilteredProjects;
END
GO

-- ============================================================
-- 3. usp_GetReportsReview
-- Đánh giá khách hàng: hỗ trợ đầy đủ 9 bộ lọc slicer
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_GetReportsReview]
    @Year NVARCHAR(500) = NULL,
    @Month NVARCHAR(500) = NULL,
    @Week NVARCHAR(500) = NULL,
    @CustomerType NVARCHAR(MAX) = NULL,
    @CustomerName NVARCHAR(MAX) = NULL,
    @Destination NVARCHAR(MAX) = NULL,
    @Department NVARCHAR(MAX) = NULL,
    @ProjectStatus NVARCHAR(500) = NULL,
    @TaskStatus NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Tạo bảng tạm lọc danh sách Project
    SELECT DISTINCT p.[Project_id], p.[CustomerName], p.[SubmitterMNV]
    INTO #FilteredProjects
    FROM [dbo].[CSR_Projects] p
    LEFT JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[IsActive] = 1
    LEFT JOIN [dbo].[CSR_Employees] e ON p.[SubmitterMNV] = e.[MNV]
    WHERE p.[RecordType] = 1
      AND p.[Status] != N'Đã huỷ'
      AND (@Year IS NULL OR @Year = '' OR YEAR(p.[CreatedAt]) IN (SELECT CAST(value AS INT) FROM STRING_SPLIT(@Year, ',')))
      AND (@Month IS NULL OR @Month = '' OR MONTH(p.[CreatedAt]) IN (SELECT CAST(value AS INT) FROM STRING_SPLIT(@Month, ',')))
      AND (@Week IS NULL OR @Week = '' OR DATEPART(WEEK, p.[CreatedAt]) IN (SELECT CAST(value AS INT) FROM STRING_SPLIT(@Week, ',')))
      AND (@CustomerType IS NULL OR @CustomerType = '' OR p.[CustomerType] IN (SELECT value FROM STRING_SPLIT(@CustomerType, ',')))
      AND (@CustomerName IS NULL OR @CustomerName = '' OR p.[CustomerName] IN (SELECT value FROM STRING_SPLIT(@CustomerName, ',')))
      AND (@Destination IS NULL OR @Destination = '' OR t.[Destination] IN (SELECT value FROM STRING_SPLIT(@Destination, ',')))
      AND (@Department IS NULL OR @Department = '' OR e.[Department] IN (SELECT value FROM STRING_SPLIT(@Department, ',')))
      AND (@ProjectStatus IS NULL OR @ProjectStatus = '' OR (
          p.[Status] IN (SELECT value FROM STRING_SPLIT(@ProjectStatus, ','))
          OR (CHARINDEX(N'Đang xử lý', @ProjectStatus) > 0 AND p.[Status] IN (N'PRD đã duyệt', N'BOD đã duyệt'))
          OR (CHARINDEX(N'Chờ phản hồi', @ProjectStatus) > 0 AND p.[Status] = N'Đã gửi-Chờ phản hồi')
      ))
      AND (@TaskStatus IS NULL OR @TaskStatus = '' OR EXISTS (
          SELECT 1 FROM STRING_SPLIT(@TaskStatus, ',')
          WHERE value = CASE 
              WHEN t.[TaskStatus] = N'Hoàn thành' OR t.[OnboardDate] < CAST(GETDATE() AS DATE) THEN N'Hoàn thành'
              WHEN t.[TaskStatus] = N'Đang xử lý' OR (t.[TaskStatus] != N'Hoàn thành' AND t.[DeadlineDate] >= CAST(GETDATE() AS DATE) AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)) THEN N'Đang xử lý'
              ELSE N'Delay'
          END
      ));

    -- 1. Điểm đánh giá trung bình tổng thể
    SELECT 
        ROUND(AVG(CAST(r.[Rating] AS FLOAT)), 2) AS [AverageRating],
        COUNT(r.[Id]) AS [TotalReviews]
    FROM [dbo].[CSR_Reviews] r
    INNER JOIN #FilteredProjects p ON r.[ProjectId] = p.[Project_id];

    -- 2. Điểm trung bình theo từng tiêu chí (Để frontend xếp Top tiêu chí cao nhất và thấp nhất)
    SELECT 
        c.[CriteriaName],
        c.[CriteriaGroup],
        ROUND(AVG(CAST(r.[Rating] AS FLOAT)), 2) AS [AverageRating]
    FROM [dbo].[CSR_Reviews] r
    INNER JOIN [dbo].[CSR_ReviewCriteria] c ON r.[CriteriaId] = c.[Id]
    INNER JOIN #FilteredProjects p ON r.[ProjectId] = p.[Project_id]
    GROUP BY c.[CriteriaName], c.[CriteriaGroup]
    ORDER BY [AverageRating] DESC;

    -- 3. Điểm trung bình theo từng địa điểm tiếp đón
    SELECT 
        ISNULL(t.[Destination], N'Không xác định') AS [Destination],
        ROUND(AVG(CAST(r.[Rating] AS FLOAT)), 2) AS [AverageRating]
    FROM [dbo].[CSR_Reviews] r
    INNER JOIN #FilteredProjects p ON r.[ProjectId] = p.[Project_id]
    INNER JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[IsActive] = 1
    GROUP BY t.[Destination]
    ORDER BY [AverageRating] DESC;

    -- 4. Bảng chi tiết đánh giá của khách hàng từng chuyến tiếp đón
    SELECT 
        r.[Id],
        r.[ProjectId],
        p.[CustomerName],
        r.[ReviewerName],
        r.[Rating],
        r.[Comment],
        r.[CreatedAt],
        -- Ngày tiếp đón
        [OnboardDates] = STUFF((
            SELECT DISTINCT ', ' + CONVERT(NVARCHAR(10), t2.[OnboardDate], 103)
            FROM [dbo].[CSR_Tasks] t2
            WHERE t2.[Project_id] = p.[Project_id] AND t2.[IsActive] = 1
            FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'), 1, 2, ''),
        -- Địa điểm
        [Destinations] = STUFF((
            SELECT DISTINCT ', ' + t2.[Destination]
            FROM [dbo].[CSR_Tasks] t2
            WHERE t2.[Project_id] = p.[Project_id] AND t2.[IsActive] = 1
            FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'), 1, 2, '')
    FROM [dbo].[CSR_Reviews] r
    INNER JOIN #FilteredProjects p ON r.[ProjectId] = p.[Project_id]
    ORDER BY r.[CreatedAt] DESC;

    DROP TABLE #FilteredProjects;
END
GO

-- ============================================================
-- 4. usp_GetReportsProgress
-- Báo cáo tiến độ: hỗ trợ đầy đủ 9 bộ lọc slicer, tính ontime gửi đơn & hoàn thành công việc
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_GetReportsProgress]
    @Year NVARCHAR(500) = NULL,
    @Month NVARCHAR(500) = NULL,
    @Week NVARCHAR(500) = NULL,
    @CustomerType NVARCHAR(MAX) = NULL,
    @CustomerName NVARCHAR(MAX) = NULL,
    @Destination NVARCHAR(MAX) = NULL,
    @Department NVARCHAR(MAX) = NULL,
    @ProjectStatus NVARCHAR(500) = NULL,
    @TaskStatus NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Tạo bảng tạm lọc danh sách Project
    SELECT DISTINCT p.[Project_id], p.[CustomerName], p.[SubmitterMNV], p.[CreatedAt]
    INTO #FilteredProjects
    FROM [dbo].[CSR_Projects] p
    LEFT JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[IsActive] = 1
    LEFT JOIN [dbo].[CSR_Employees] e ON p.[SubmitterMNV] = e.[MNV]
    WHERE p.[RecordType] = 1
      AND p.[Status] != N'Đã huỷ'
      AND (@Year IS NULL OR @Year = '' OR YEAR(p.[CreatedAt]) IN (SELECT CAST(value AS INT) FROM STRING_SPLIT(@Year, ',')))
      AND (@Month IS NULL OR @Month = '' OR MONTH(p.[CreatedAt]) IN (SELECT CAST(value AS INT) FROM STRING_SPLIT(@Month, ',')))
      AND (@Week IS NULL OR @Week = '' OR DATEPART(WEEK, p.[CreatedAt]) IN (SELECT CAST(value AS INT) FROM STRING_SPLIT(@Week, ',')))
      AND (@CustomerType IS NULL OR @CustomerType = '' OR p.[CustomerType] IN (SELECT value FROM STRING_SPLIT(@CustomerType, ',')))
      AND (@CustomerName IS NULL OR @CustomerName = '' OR p.[CustomerName] IN (SELECT value FROM STRING_SPLIT(@CustomerName, ',')))
      AND (@Destination IS NULL OR @Destination = '' OR t.[Destination] IN (SELECT value FROM STRING_SPLIT(@Destination, ',')))
      AND (@Department IS NULL OR @Department = '' OR e.[Department] IN (SELECT value FROM STRING_SPLIT(@Department, ',')))
      AND (@ProjectStatus IS NULL OR @ProjectStatus = '' OR (
          p.[Status] IN (SELECT value FROM STRING_SPLIT(@ProjectStatus, ','))
          OR (CHARINDEX(N'Đang xử lý', @ProjectStatus) > 0 AND p.[Status] IN (N'PRD đã duyệt', N'BOD đã duyệt'))
          OR (CHARINDEX(N'Chờ phản hồi', @ProjectStatus) > 0 AND p.[Status] = N'Đã gửi-Chờ phản hồi')
      ))
      AND (@TaskStatus IS NULL OR @TaskStatus = '' OR EXISTS (
          SELECT 1 FROM STRING_SPLIT(@TaskStatus, ',')
          WHERE value = CASE 
              WHEN t.[TaskStatus] = N'Hoàn thành' OR t.[OnboardDate] < CAST(GETDATE() AS DATE) THEN N'Hoàn thành'
              WHEN t.[TaskStatus] = N'Đang xử lý' OR (t.[TaskStatus] != N'Hoàn thành' AND t.[DeadlineDate] >= CAST(GETDATE() AS DATE) AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)) THEN N'Đang xử lý'
              ELSE N'Delay'
          END
      ));

    -- Tạo bảng chứa thông tin task của các project đã lọc kèm Computed Status
    SELECT 
        t.[Task_id],
        t.[Project_id],
        p.[CustomerName],
        t.[TaskName],
        t.[Destination],
        t.[Assignee],
        t.[DeadlineDate],
        ISNULL(e.[Department], N'Không xác định') AS [Department],
        CASE 
            WHEN t.[TaskStatus] = N'Hoàn thành' OR t.[OnboardDate] < CAST(GETDATE() AS DATE) THEN N'Hoàn thành'
            WHEN t.[TaskStatus] = N'Đang xử lý' OR (t.[TaskStatus] != N'Hoàn thành' AND t.[DeadlineDate] >= CAST(GETDATE() AS DATE) AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)) THEN N'Đang xử lý'
            ELSE N'Delay'
        END AS [ComputedStatus]
    INTO #FilteredTasks
    FROM [dbo].[CSR_Tasks] t
    INNER JOIN #FilteredProjects p ON t.[Project_id] = p.[Project_id]
    LEFT JOIN [dbo].[CSR_Employees] e ON p.[SubmitterMNV] = e.[MNV]
    WHERE t.[IsActive] = 1;

    -- 1. Tiến độ gửi đơn tiếp đón: Ontime (gửi trước 7 ngày) vs Delay (trong vòng 7 ngày)
    -- Tính từ ngày làm đơn (CreatedAt) đến ngày tiếp đón (OnboardDate) đầu tiên của đơn đó
    SELECT 
        SUM(CASE WHEN DATEDIFF(DAY, p.[CreatedAt], t.MinOnboardDate) >= 7 THEN 1 ELSE 0 END) AS [OntimeCount],
        SUM(CASE WHEN DATEDIFF(DAY, p.[CreatedAt], t.MinOnboardDate) < 7 THEN 1 ELSE 0 END) AS [DelayCount]
    FROM #FilteredProjects p
    INNER JOIN (
        SELECT [Project_id], MIN([OnboardDate]) AS MinOnboardDate
        FROM [dbo].[CSR_Tasks]
        WHERE [IsActive] = 1
        GROUP BY [Project_id]
    ) t ON p.[Project_id] = t.[Project_id];

    -- 2. Tiến độ công việc: Ontime (Hoàn thành + Đang xử lý) vs Delay (Trễ hạn)
    SELECT 
        SUM(CASE WHEN [ComputedStatus] != N'Delay' THEN 1 ELSE 0 END) AS [OntimeCount],
        SUM(CASE WHEN [ComputedStatus] = N'Delay' THEN 1 ELSE 0 END) AS [DelayCount]
    FROM #FilteredTasks;

    -- 3. Tỷ lệ Ontime và Delay của các phòng ban (team)
    SELECT 
        [Department],
        COUNT(*) AS [TotalTasks],
        SUM(CASE WHEN [ComputedStatus] != N'Delay' THEN 1 ELSE 0 END) AS [OntimeTasks],
        SUM(CASE WHEN [ComputedStatus] = N'Delay' THEN 1 ELSE 0 END) AS [DelayTasks],
        ROUND(SUM(CASE WHEN [ComputedStatus] != N'Delay' THEN 1.0 ELSE 0.0 END) * 100.0 / COUNT(*), 1) AS [OntimeRate],
        ROUND(SUM(CASE WHEN [ComputedStatus] = N'Delay' THEN 1.0 ELSE 0.0 END) * 100.0 / COUNT(*), 1) AS [DelayRate]
    FROM #FilteredTasks
    GROUP BY [Department]
    ORDER BY [OntimeRate] DESC;

    DROP TABLE #FilteredProjects;
    DROP TABLE #FilteredTasks;
END
GO
