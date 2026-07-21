USE CSR_DB;
GO

-- ============================================================
-- 1. Cập nhật usp_GetReportsSummary với bộ lọc nhiều giá trị (multi-select)
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
      AND (@ProjectStatus IS NULL OR @ProjectStatus = '' OR p.[Status] IN (SELECT value FROM STRING_SPLIT(@ProjectStatus, ',')))
      AND (@TaskStatus IS NULL OR @TaskStatus = '' OR EXISTS (
          SELECT 1 FROM STRING_SPLIT(@TaskStatus, ',')
          WHERE value = CASE 
              WHEN t.[TaskStatus] = N'Hoàn thành' OR t.[OnboardDate] < CAST(GETDATE() AS DATE) THEN N'Hoàn thành'
              WHEN t.[TaskStatus] = N'Đang xử lý' OR (t.[TaskStatus] != N'Hoàn thành' AND t.[DeadlineDate] >= CAST(GETDATE() AS DATE) AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)) THEN N'Đang xử lý'
              ELSE N'Delay'
          END
      ));

    -- 1. KPI Cards (Có % MoM và % YoY)
    -- Tổng số đơn tiếp đón kỳ hiện tại
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

    -- Output 1: KPIs
    SELECT 
        @CurrCount AS [TotalSubmissions],
        CASE WHEN @PrevMonthCount > 0 THEN ROUND((CAST(@CurrCount - @PrevMonthCount AS FLOAT) / @PrevMonthCount) * 100, 1) ELSE NULL END AS [TotalMoM],
        CASE WHEN @PrevYearCount > 0 THEN ROUND((CAST(@CurrCount - @PrevYearCount AS FLOAT) / @PrevYearCount) * 100, 1) ELSE NULL END AS [TotalYoY],
        
        ISNULL(SUM(CASE WHEN [Status] = N'Hoàn thành' THEN 1 ELSE 0 END), 0) AS [CompletedSubmissions],
        ISNULL(SUM(CASE WHEN [Status] IN (N'Chờ phản hồi', N'PRD đã duyệt', N'Đã gửi-Chờ phản hồi') THEN 1 ELSE 0 END), 0) AS [ProcessingSubmissions],
        ISNULL(SUM(CASE WHEN [Status] IN (N'Đã gửi-Chờ phản hồi', N'Chờ phản hồi') THEN 1 ELSE 0 END), 0) AS [PendingSubmissions],
        
        ROUND(ISNULL(@CurrRating, 0), 2) AS [AverageRating],
        CASE WHEN @PrevMonthRating > 0 THEN ROUND(((@CurrRating - @PrevMonthRating) / @PrevMonthRating) * 100, 1) ELSE NULL END AS [RatingMoM],
        CASE WHEN @PrevYearRating > 0 THEN ROUND(((@CurrRating - @PrevYearRating) / @PrevYearRating) * 100, 1) ELSE NULL END AS [RatingYoY]
    FROM #FilteredProjects;

    -- 2. Số đơn theo tháng trong năm (Biểu đồ cột)
    SELECT
        m.[Month],
        ISNULL(COUNT(p.[Project_id]), 0) AS [Total],
        SUM(CASE WHEN p.[Status] = N'Hoàn thành' THEN 1 ELSE 0 END) AS [Completed],
        SUM(CASE WHEN p.[Status] IN (N'Chờ phản hồi', N'PRD đã duyệt', N'Đã gửi-Chờ phản hồi') THEN 1 ELSE 0 END) AS [Processing],
        SUM(CASE WHEN p.[Status] IN (N'Đã gửi-Chờ phản hồi', N'Chờ phản hồi') THEN 1 ELSE 0 END) AS [Pending]
    FROM (
        SELECT 1 AS [Month] UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION 
        SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12
    ) m
    LEFT JOIN #FilteredProjects p ON MONTH(p.[CreatedAt]) = m.[Month]
    GROUP BY m.[Month]
    ORDER BY m.[Month] ASC;

    -- 3. Phân bổ địa điểm tiếp đón (Biểu đồ cột)
    SELECT 
        ISNULL(t.[Destination], N'Không xác định') AS [Destination], 
        COUNT(DISTINCT p.[Project_id]) AS [Count]
    FROM #FilteredProjects p
    INNER JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[IsActive] = 1
    GROUP BY t.[Destination]
    ORDER BY [Count] DESC;

    -- 4. Tỉ lệ loại khách hàng (Biểu đồ tròn)
    SELECT 
        [CustomerType], 
        COUNT(*) AS [Count]
    FROM #FilteredProjects
    GROUP BY [CustomerType]
    ORDER BY [Count] DESC;

    -- 5. Top 10 khách hàng (Biểu đồ thanh ngang)
    SELECT TOP 10 
        [CustomerName], 
        [CustomerType], 
        COUNT(*) AS [VisitCount]
    FROM #FilteredProjects
    GROUP BY [CustomerName], [CustomerType]
    ORDER BY [VisitCount] DESC;

    -- 6. Chi tiết các đơn tiếp đón (Bảng)
    SELECT 
        [Project_id], 
        [CustomerName], 
        [CustomerType], 
        [MeetingTopic] = (SELECT TOP 1 MeetingTopic FROM [dbo].[CSR_Projects] WHERE Project_id = p.Project_id), 
        [SubmitterName], 
        [Status],
        [CreatedAt],
        -- Lấy chuỗi ngày onboard kết hợp
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
-- 2. Cập nhật usp_GetReportsReview với bộ lọc nhiều giá trị (multi-select)
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_GetReportsReview]
    @Year NVARCHAR(500) = NULL,
    @Month NVARCHAR(500) = NULL,
    @Week NVARCHAR(500) = NULL,
    @CustomerType NVARCHAR(MAX) = NULL,
    @CustomerName NVARCHAR(MAX) = NULL,
    @Destination NVARCHAR(MAX) = NULL,
    @Department NVARCHAR(MAX) = NULL
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
      AND (@Department IS NULL OR @Department = '' OR e.[Department] IN (SELECT value FROM STRING_SPLIT(@Department, ',')));

    -- 1. Điểm đánh giá trung bình tổng thể
    SELECT 
        ROUND(AVG(CAST(r.[Rating] AS FLOAT)), 2) AS [AverageRating],
        COUNT(r.[Id]) AS [TotalReviews]
    FROM [dbo].[CSR_Reviews] r
    INNER JOIN #FilteredProjects p ON r.[ProjectId] = p.[Project_id];

    -- 2. Phân bố số sao (1-5 sao)
    SELECT 
        stars.[Rating] AS [RatingStar],
        ISNULL(COUNT(r.[Id]), 0) AS [Count]
    FROM (
        SELECT 1 AS [Rating] UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5
    ) stars
    LEFT JOIN [dbo].[CSR_Reviews] r ON r.[Rating] = stars.[Rating] AND r.[ProjectId] IN (SELECT [Project_id] FROM #FilteredProjects)
    GROUP BY stars.[Rating]
    ORDER BY stars.[Rating] DESC;

    -- 3. Điểm trung bình theo từng tiêu chí
    SELECT 
        c.[CriteriaName],
        c.[CriteriaGroup],
        ROUND(AVG(CAST(r.[Rating] AS FLOAT)), 2) AS [AverageRating]
    FROM [dbo].[CSR_Reviews] r
    INNER JOIN [dbo].[CSR_ReviewCriteria] c ON r.[CriteriaId] = c.[Id]
    INNER JOIN #FilteredProjects p ON r.[ProjectId] = p.[Project_id]
    GROUP BY c.[CriteriaName], c.[CriteriaGroup]
    ORDER BY [AverageRating] DESC;

    -- 4. Điểm trung bình theo phòng ban
    SELECT 
        ISNULL(e.[Department], N'Khác') AS [Department],
        ROUND(AVG(CAST(r.[Rating] AS FLOAT)), 2) AS [AverageRating]
    FROM [dbo].[CSR_Reviews] r
    INNER JOIN #FilteredProjects p ON r.[ProjectId] = p.[Project_id]
    LEFT JOIN [dbo].[CSR_Employees] e ON p.[SubmitterMNV] = e.[MNV]
    GROUP BY e.[Department]
    ORDER BY [AverageRating] DESC;

    -- 5. Danh sách ý kiến đóng góp
    SELECT 
        r.[Id],
        r.[ProjectId],
        p.[CustomerName],
        r.[ReviewerName],
        r.[Rating],
        r.[Comment],
        r.[CreatedAt]
    FROM [dbo].[CSR_Reviews] r
    INNER JOIN #FilteredProjects p ON r.[ProjectId] = p.[Project_id]
    WHERE r.[Comment] IS NOT NULL AND LTRIM(RTRIM(r.[Comment])) != ''
    ORDER BY r.[CreatedAt] DESC;

    DROP TABLE #FilteredProjects;
END
GO

-- ============================================================
-- 3. Cập nhật usp_GetReportsProgress với bộ lọc nhiều giá trị (multi-select)
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_GetReportsProgress]
    @Year NVARCHAR(500) = NULL,
    @Month NVARCHAR(500) = NULL,
    @Week NVARCHAR(500) = NULL,
    @CustomerType NVARCHAR(MAX) = NULL,
    @CustomerName NVARCHAR(MAX) = NULL,
    @Destination NVARCHAR(MAX) = NULL,
    @Department NVARCHAR(MAX) = NULL
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
      AND (@Department IS NULL OR @Department = '' OR e.[Department] IN (SELECT value FROM STRING_SPLIT(@Department, ',')));

    -- Tạo bảng chứa thông tin task của các project đã lọc kèm Computed Status
    SELECT 
        t.[Task_id],
        t.[Project_id],
        p.[CustomerName],
        t.[TaskName],
        t.[Destination],
        t.[Assignee],
        t.[AssigneeEmail],
        t.[DeadlineDate],
        DATEDIFF(DAY, t.[DeadlineDate], CAST(GETDATE() AS DATE)) AS [DaysOverdue],
        ISNULL(e.[Department], N'Khác') AS [Department],
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

    -- 1. KPI Cards
    SELECT 
        COUNT(*) AS [TotalTasks],
        SUM(CASE WHEN [ComputedStatus] = N'Hoàn thành' THEN 1 ELSE 0 END) AS [CompletedTasks],
        SUM(CASE WHEN [ComputedStatus] = N'Đang xử lý' THEN 1 ELSE 0 END) AS [ProcessingTasks],
        SUM(CASE WHEN [ComputedStatus] = N'Delay' THEN 1 ELSE 0 END) AS [DelayTasks]
    FROM #FilteredTasks;

    -- 2. Tình trạng công việc theo địa điểm
    SELECT 
        [Destination],
        SUM(CASE WHEN [ComputedStatus] = N'Hoàn thành' THEN 1 ELSE 0 END) AS [Completed],
        SUM(CASE WHEN [ComputedStatus] = N'Đang xử lý' THEN 1 ELSE 0 END) AS [Processing],
        SUM(CASE WHEN [ComputedStatus] = N'Delay' THEN 1 ELSE 0 END) AS [Delay]
    FROM #FilteredTasks
    GROUP BY [Destination]
    ORDER BY [Destination];

    -- 3. Tình trạng công việc theo phòng ban
    SELECT 
        [Department],
        SUM(CASE WHEN [ComputedStatus] = N'Hoàn thành' THEN 1 ELSE 0 END) AS [Completed],
        SUM(CASE WHEN [ComputedStatus] = N'Đang xử lý' THEN 1 ELSE 0 END) AS [Processing],
        SUM(CASE WHEN [ComputedStatus] = N'Delay' THEN 1 ELSE 0 END) AS [Delay]
    FROM #FilteredTasks
    GROUP BY [Department]
    ORDER BY [Department];

    -- 4. Tình trạng công việc theo người thực hiện
    SELECT TOP 15
        ISNULL([Assignee], N'Chưa phân công') AS [Assignee],
        SUM(CASE WHEN [ComputedStatus] = N'Hoàn thành' THEN 1 ELSE 0 END) AS [Completed],
        SUM(CASE WHEN [ComputedStatus] = N'Đang xử lý' THEN 1 ELSE 0 END) AS [Processing],
        SUM(CASE WHEN [ComputedStatus] = N'Delay' THEN 1 ELSE 0 END) AS [Delay]
    FROM #FilteredTasks
    GROUP BY [Assignee]
    ORDER BY [Delay] DESC, [Processing] DESC;

    -- 5. Danh sách công việc trễ hạn (Delay) chi tiết
    SELECT 
        [Task_id] AS [TaskId],
        [Project_id] AS [ProjectId],
        [CustomerName],
        [TaskName],
        [Destination],
        [Assignee],
        [DeadlineDate],
        [DaysOverdue]
    FROM #FilteredTasks
    WHERE [ComputedStatus] = N'Delay'
    ORDER BY [DaysOverdue] DESC, [DeadlineDate] ASC;

    DROP TABLE #FilteredProjects;
    DROP TABLE #FilteredTasks;
END
GO

-- ============================================================
-- 4. Cập nhật usp_GetTaskManagement với bộ lọc nhiều giá trị (multi-select)
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_GetTaskManagement]
    @ActorRole      NVARCHAR(50) = '',
    @ActorMNV       NVARCHAR(50) = '',
    @Department     NVARCHAR(MAX) = NULL,
    @Assignee       NVARCHAR(MAX) = NULL,
    @TaskStatus     NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Lấy Email của Actor
    DECLARE @ActorEmail NVARCHAR(200) = '';
    IF @ActorMNV IS NOT NULL AND @ActorMNV != ''
    BEGIN
        SELECT TOP 1 @ActorEmail = [Email] FROM [dbo].[CSR_Employees] WHERE [MNV] = @ActorMNV;
    END

    SELECT 
        t.[Task_id] AS [TaskId],
        t.[Project_id] AS [ProjectId],
        p.[CustomerName],
        p.[CustomerType],
        p.[MeetingTopic],
        p.[SubmitterName],
        t.[TaskName],
        t.[TaskDetail],
        t.[Destination],
        t.[Assignee],
        t.[AssigneeEmail],
        t.[Supervisor],
        t.[SupervisorEmail],
        CONVERT(NVARCHAR(10), t.[OnboardDate], 23) AS [OnboardDate],
        CONVERT(NVARCHAR(10), t.[DeadlineDate], 23) AS [DeadlineDate],
        t.[TaskStatus],
        CASE 
            WHEN t.[TaskStatus] = N'Hoàn thành' OR t.[OnboardDate] < CAST(GETDATE() AS DATE) THEN N'Hoàn thành'
            WHEN t.[TaskStatus] = N'Đang xử lý' OR (t.[TaskStatus] != N'Hoàn thành' AND t.[DeadlineDate] >= CAST(GETDATE() AS DATE) AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)) THEN N'Đang xử lý'
            ELSE N'Delay'
        END AS [ComputedStatus],
        (SELECT COUNT(*) FROM [dbo].[CSR_TaskNotes] WHERE [TaskId] = t.[Task_id]) AS [NotesCount],
        (SELECT COUNT(*) FROM [dbo].[CSR_TaskAttachments] WHERE [TaskId] = t.[Task_id]) AS [AttachmentsCount]
    FROM [dbo].[CSR_Tasks] t
    INNER JOIN [dbo].[CSR_Projects] p ON t.[Project_id] = p.[Project_id]
    LEFT JOIN [dbo].[CSR_Employees] e ON p.[SubmitterMNV] = e.[MNV]
    WHERE t.[IsActive] = 1
      AND p.[Status] IN (N'Chờ phản hồi', N'PRD đã duyệt', N'BOD đã duyệt', N'Hoàn thành')
      -- Phân quyền: User thường chỉ xem task liên quan đến mình
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR t.[AssigneeEmail] = @ActorEmail
          OR t.[SupervisorEmail] = @ActorEmail
          OR p.[SubmitterMNV] = @ActorMNV
      )
      -- Áp dụng bộ lọc nhiều giá trị
      AND (@Department IS NULL OR @Department = '' OR e.[Department] IN (SELECT value FROM STRING_SPLIT(@Department, ',')))
      AND (@Assignee IS NULL OR @Assignee = '' OR t.[Assignee] IN (SELECT value FROM STRING_SPLIT(@Assignee, ',')) OR t.[AssigneeEmail] IN (SELECT value FROM STRING_SPLIT(@Assignee, ',')))
      AND (@TaskStatus IS NULL OR @TaskStatus = '' OR EXISTS (
          SELECT 1 FROM STRING_SPLIT(@TaskStatus, ',')
          WHERE value = CASE 
              WHEN t.[TaskStatus] = N'Hoàn thành' OR t.[OnboardDate] < CAST(GETDATE() AS DATE) THEN N'Hoàn thành'
              WHEN t.[TaskStatus] = N'Đang xử lý' OR (t.[TaskStatus] != N'Hoàn thành' AND t.[DeadlineDate] >= CAST(GETDATE() AS DATE) AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)) THEN N'Đang xử lý'
              ELSE N'Delay'
          END
      ))
    ORDER BY t.[OnboardDate] ASC, t.[DeadlineDate] ASC;
END
GO
