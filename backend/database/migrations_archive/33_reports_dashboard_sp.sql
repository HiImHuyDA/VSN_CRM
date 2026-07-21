USE CSR_DB;
GO

-- ============================================================
-- 1. usp_GetFilterOptions
-- Lấy dữ liệu cho các bộ lọc slicer trên giao diện
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_GetFilterOptions]
AS
BEGIN
    SET NOCOUNT ON;

    -- 1. Năm
    SELECT DISTINCT YEAR([CreatedAt]) AS [Year]
    FROM [dbo].[CSR_Projects]
    WHERE [RecordType] = 1
    ORDER BY [Year] DESC;

    -- 2. Tháng
    SELECT DISTINCT MONTH([CreatedAt]) AS [Month]
    FROM [dbo].[CSR_Projects]
    WHERE [RecordType] = 1
    ORDER BY [Month] ASC;

    -- 3. Tuần
    SELECT DISTINCT DATEPART(WEEK, [CreatedAt]) AS [Week]
    FROM [dbo].[CSR_Projects]
    WHERE [RecordType] = 1
    ORDER BY [Week] ASC;

    -- 4. Loại khách hàng
    SELECT DISTINCT [CustomerType]
    FROM [dbo].[CSR_Projects]
    WHERE [RecordType] = 1 AND [CustomerType] IS NOT NULL AND [CustomerType] != ''
    ORDER BY [CustomerType];

    -- 5. Tên khách hàng
    SELECT DISTINCT [CustomerName]
    FROM [dbo].[CSR_Projects]
    WHERE [RecordType] = 1 AND [CustomerName] IS NOT NULL AND [CustomerName] != ''
    ORDER BY [CustomerName];

    -- 6. Địa điểm
    SELECT DISTINCT [Destination]
    FROM [dbo].[CSR_Tasks]
    WHERE [IsActive] = 1 AND [Destination] IS NOT NULL AND [Destination] != ''
    ORDER BY [Destination];

    -- 7. Phòng ban
    SELECT DISTINCT [Department]
    FROM [dbo].[CSR_Employees]
    WHERE [IsActive] = 1 AND [Department] IS NOT NULL AND [Department] != ''
    ORDER BY [Department];

    -- 8. Tình trạng đơn
    SELECT DISTINCT [Status]
    FROM [dbo].[CSR_Projects]
    WHERE [RecordType] = 1
    ORDER BY [Status];
END
GO

-- ============================================================
-- 2. usp_GetReportsSummary
-- Tab Thống kê tiếp đón: KPI cards và các biểu đồ
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_GetReportsSummary]
    @Year INT = NULL,
    @Month INT = NULL,
    @Week INT = NULL,
    @CustomerType NVARCHAR(50) = NULL,
    @CustomerName NVARCHAR(200) = NULL,
    @Destination NVARCHAR(100) = NULL,
    @Department NVARCHAR(200) = NULL,
    @ProjectStatus NVARCHAR(50) = NULL,
    @TaskStatus NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Thiết lập mốc thời gian so sánh MoM/YoY
    DECLARE @TargetMonth INT = COALESCE(@Month, MONTH(GETDATE()));
    DECLARE @TargetYear INT = COALESCE(@Year, YEAR(GETDATE()));

    -- Tạo bảng tạm lọc danh sách Project
    SELECT DISTINCT p.[Project_id], p.[SubmitDate], p.[CustomerType], p.[CustomerName], 
                    p.[SubmitterName], p.[Status], p.[CreatedAt], p.[UpdatedAt], p.[SubmitterMNV]
    INTO #FilteredProjects
    FROM [dbo].[CSR_Projects] p
    LEFT JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[IsActive] = 1
    LEFT JOIN [dbo].[CSR_Employees] e ON p.[SubmitterMNV] = e.[MNV]
    WHERE p.[RecordType] = 1
      AND p.[Status] != N'Đã huỷ'
      AND (@Year IS NULL OR YEAR(p.[CreatedAt]) = @Year)
      AND (@Month IS NULL OR MONTH(p.[CreatedAt]) = @Month)
      AND (@Week IS NULL OR DATEPART(WEEK, p.[CreatedAt]) = @Week)
      AND (@CustomerType IS NULL OR p.[CustomerType] = @CustomerType)
      AND (@CustomerName IS NULL OR p.[CustomerName] LIKE '%' + @CustomerName + '%')
      AND (@Destination IS NULL OR t.[Destination] = @Destination)
      AND (@Department IS NULL OR e.[Department] = @Department)
      AND (@ProjectStatus IS NULL OR p.[Status] = @ProjectStatus)
      AND (@TaskStatus IS NULL OR (
          CASE 
              WHEN t.[TaskStatus] = N'Hoàn thành' OR t.[OnboardDate] < CAST(GETDATE() AS DATE) THEN N'Hoàn thành'
              WHEN t.[TaskStatus] = N'Đang xử lý' OR (t.[TaskStatus] != N'Hoàn thành' AND t.[DeadlineDate] >= CAST(GETDATE() AS DATE) AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)) THEN N'Đang xử lý'
              ELSE N'Delay'
          END = @TaskStatus
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
      AND (@CustomerType IS NULL OR p.[CustomerType] = @CustomerType)
      AND (@CustomerName IS NULL OR p.[CustomerName] LIKE '%' + @CustomerName + '%')
      AND (@Destination IS NULL OR t.[Destination] = @Destination)
      AND (@Department IS NULL OR e.[Department] = @Department);

    -- Đơn cùng kỳ năm trước (YoY)
    SELECT @PrevYearCount = COUNT(DISTINCT p.[Project_id])
    FROM [dbo].[CSR_Projects] p
    LEFT JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[IsActive] = 1
    LEFT JOIN [dbo].[CSR_Employees] e ON p.[SubmitterMNV] = e.[MNV]
    WHERE p.[RecordType] = 1 AND p.[Status] != N'Đã huỷ'
      AND YEAR(p.[CreatedAt]) = @TargetYear - 1 AND MONTH(p.[CreatedAt]) = @TargetMonth
      AND (@CustomerType IS NULL OR p.[CustomerType] = @CustomerType)
      AND (@CustomerName IS NULL OR p.[CustomerName] LIKE '%' + @CustomerName + '%')
      AND (@Destination IS NULL OR t.[Destination] = @Destination)
      AND (@Department IS NULL OR e.[Department] = @Department);

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
      AND (@CustomerType IS NULL OR p.[CustomerType] = @CustomerType)
      AND (@CustomerName IS NULL OR p.[CustomerName] LIKE '%' + @CustomerName + '%')
      AND (@Destination IS NULL OR t.[Destination] = @Destination)
      AND (@Department IS NULL OR e.[Department] = @Department);

    SELECT @PrevYearRating = AVG(CAST(r.[Rating] AS FLOAT))
    FROM [dbo].[CSR_Reviews] r
    INNER JOIN [dbo].[CSR_Projects] p ON r.[ProjectId] = p.[Project_id]
    LEFT JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[IsActive] = 1
    LEFT JOIN [dbo].[CSR_Employees] e ON p.[SubmitterMNV] = e.[MNV]
    WHERE p.[RecordType] = 1 AND p.[Status] != N'Đã huỷ'
      AND YEAR(p.[CreatedAt]) = @TargetYear - 1 AND MONTH(p.[CreatedAt]) = @TargetMonth
      AND (@CustomerType IS NULL OR p.[CustomerType] = @CustomerType)
      AND (@CustomerName IS NULL OR p.[CustomerName] LIKE '%' + @CustomerName + '%')
      AND (@Destination IS NULL OR t.[Destination] = @Destination)
      AND (@Department IS NULL OR e.[Department] = @Department);

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
-- 3. usp_GetReportsReview
-- Tab Đánh giá & Phản hồi: Phân tích đánh giá sao của khách
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_GetReportsReview]
    @Year INT = NULL,
    @Month INT = NULL,
    @Week INT = NULL,
    @CustomerType NVARCHAR(50) = NULL,
    @CustomerName NVARCHAR(200) = NULL,
    @Destination NVARCHAR(100) = NULL,
    @Department NVARCHAR(200) = NULL
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
      AND (@Year IS NULL OR YEAR(p.[CreatedAt]) = @Year)
      AND (@Month IS NULL OR MONTH(p.[CreatedAt]) = @Month)
      AND (@Week IS NULL OR DATEPART(WEEK, p.[CreatedAt]) = @Week)
      AND (@CustomerType IS NULL OR p.[CustomerType] = @CustomerType)
      AND (@CustomerName IS NULL OR p.[CustomerName] LIKE '%' + @CustomerName + '%')
      AND (@Destination IS NULL OR t.[Destination] = @Destination)
      AND (@Department IS NULL OR e.[Department] = @Department);

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
-- 4. usp_GetReportsProgress
-- Tab Tiến độ công việc: Trạng thái các task chuẩn bị
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_GetReportsProgress]
    @Year INT = NULL,
    @Month INT = NULL,
    @Week INT = NULL,
    @CustomerType NVARCHAR(50) = NULL,
    @CustomerName NVARCHAR(200) = NULL,
    @Destination NVARCHAR(100) = NULL,
    @Department NVARCHAR(200) = NULL
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
      AND (@Year IS NULL OR YEAR(p.[CreatedAt]) = @Year)
      AND (@Month IS NULL OR MONTH(p.[CreatedAt]) = @Month)
      AND (@Week IS NULL OR DATEPART(WEEK, p.[CreatedAt]) = @Week)
      AND (@CustomerType IS NULL OR p.[CustomerType] = @CustomerType)
      AND (@CustomerName IS NULL OR p.[CustomerName] LIKE '%' + @CustomerName + '%')
      AND (@Destination IS NULL OR t.[Destination] = @Destination)
      AND (@Department IS NULL OR e.[Department] = @Department);

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
-- 5. usp_GetDashboardV2
-- Dashboard mới: Thêm phần tin tức/notifications và thiết kế 4 cards lớn
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_GetDashboardV2]
    @ActorRole NVARCHAR(50) = '',
    @ActorMNV  NVARCHAR(50) = ''
AS
BEGIN
    SET NOCOUNT ON;

    -- 1. Sửa trạng thái Hoàn thành tự động cho các project
    UPDATE p SET p.[Status] = N'Hoàn thành', p.[UpdatedAt] = GETDATE()
    FROM [dbo].[CSR_Projects] p
    WHERE p.[Status] = N'BOD đã duyệt' AND p.[RecordType] = 1
      AND NOT EXISTS (
          SELECT 1 FROM [dbo].[CSR_Tasks] t
          WHERE t.[Project_id] = p.[Project_id] AND t.[IsActive] = 1
            AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)
      )
      AND EXISTS (SELECT 1 FROM [dbo].[CSR_Tasks] t WHERE t.[Project_id] = p.[Project_id] AND t.[IsActive] = 1);

    -- 2. Đơn sắp tới trong vòng 14 ngày tới (Upcoming)
    SELECT DISTINCT TOP 20
      p.[Project_id], p.[CustomerName], p.[CustomerType],
      p.[MeetingTopic], p.[SubmitterName], p.[Status],
      CONVERT(NVARCHAR(10), MIN(t.[OnboardDate]), 23) AS NearestDate,
      COUNT(DISTINCT t.[OnboardDate]) AS TotalDays,
      COUNT(DISTINCT t.[Destination]) AS TotalLocations,
      STUFF((
          SELECT DISTINCT ', ' + t2.[Destination]
          FROM [dbo].[CSR_Tasks] t2
          WHERE t2.[Project_id] = p.[Project_id] AND t2.[IsActive] = 1
            AND t2.[OnboardDate] >= CAST(GETDATE() AS DATE)
            AND t2.[OnboardDate] <= DATEADD(DAY, 14, CAST(GETDATE() AS DATE))
          FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS Destinations
    FROM [dbo].[CSR_Projects] p
    INNER JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[IsActive] = 1
    WHERE p.[Status] IN (N'BOD đã duyệt', N'Hoàn thành', N'PRD đã duyệt', N'Chờ phản hồi')
      AND p.[RecordType] = 1
      AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)
      AND t.[OnboardDate] <= DATEADD(DAY, 14, CAST(GETDATE() AS DATE))
      AND (
          @ActorRole != 'User'
          OR p.[SubmitterMNV] = @ActorMNV
          OR t.[AssigneeEmail] IN (SELECT Email FROM CSR_Employees WHERE MNV = @ActorMNV)
          OR t.[SupervisorEmail] IN (SELECT Email FROM CSR_Employees WHERE MNV = @ActorMNV)
      )
    GROUP BY p.[Project_id], p.[CustomerName], p.[CustomerType],
             p.[MeetingTopic], p.[SubmitterName], p.[Status]
    ORDER BY NearestDate ASC;

    -- 3. Công việc sắp đến hạn (Pending tasks trong 7 ngày tới)
    SELECT TOP 30
      t.[Task_id], t.[Project_id], t.[TaskName], t.[Destination],
      CONVERT(NVARCHAR(10), t.[OnboardDate], 23) AS OnboardDate,
      CONVERT(NVARCHAR(10), t.[DeadlineDate], 23) AS DeadlineDate,
      DATEDIFF(DAY, CAST(GETDATE() AS DATE), t.[DeadlineDate]) AS DaysLeft,
      t.[Assignee], t.[AssigneeEmail], t.[Supervisor],
      p.[CustomerName], p.[Status]
    FROM [dbo].[CSR_Tasks] t
    INNER JOIN [dbo].[CSR_Projects] p ON p.[Project_id] = t.[Project_id]
    WHERE t.[IsActive] = 1
      AND t.[DeadlineDate] IS NOT NULL
      AND t.[DeadlineDate] >= CAST(GETDATE() AS DATE)
      AND t.[DeadlineDate] <= DATEADD(DAY, 7, CAST(GETDATE() AS DATE))
      AND t.[OnboardDate] >= DATEADD(DAY, -3, CAST(GETDATE() AS DATE))
      AND p.[Status] IN (N'BOD đã duyệt', N'PRD đã duyệt', N'Chờ phản hồi')
      AND (
          @ActorRole != 'User'
          OR t.[AssigneeEmail] IN (SELECT Email FROM CSR_Employees WHERE MNV = @ActorMNV)
          OR t.[SupervisorEmail] IN (SELECT Email FROM CSR_Employees WHERE MNV = @ActorMNV)
      )
    ORDER BY t.[DeadlineDate] ASC, t.[OnboardDate] ASC;

    -- 4. Công việc quá hạn (Overdue tasks)
    SELECT TOP 20
      t.[Task_id], t.[Project_id], t.[TaskName], t.[Destination],
      CONVERT(NVARCHAR(10), t.[OnboardDate], 23) AS OnboardDate,
      CONVERT(NVARCHAR(10), t.[DeadlineDate], 23) AS DeadlineDate,
      DATEDIFF(DAY, t.[DeadlineDate], CAST(GETDATE() AS DATE)) AS DaysOverdue,
      t.[Assignee], t.[AssigneeEmail], t.[Supervisor],
      p.[CustomerName], p.[Status]
    FROM [dbo].[CSR_Tasks] t
    INNER JOIN [dbo].[CSR_Projects] p ON p.[Project_id] = t.[Project_id]
    WHERE t.[IsActive] = 1
      AND t.[DeadlineDate] IS NOT NULL
      AND t.[DeadlineDate] < CAST(GETDATE() AS DATE)
      AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)
      AND t.[TaskStatus] != N'Hoàn thành' -- Chưa hoàn thành mới tính quá hạn
      AND p.[Status] IN (N'BOD đã duyệt', N'PRD đã duyệt', N'Chờ phản hồi')
      AND (
          @ActorRole != 'User'
          OR t.[AssigneeEmail] IN (SELECT Email FROM CSR_Employees WHERE MNV = @ActorMNV)
          OR t.[SupervisorEmail] IN (SELECT Email FROM CSR_Employees WHERE MNV = @ActorMNV)
      )
    ORDER BY t.[DeadlineDate] ASC;

    -- 5. Lịch sử hoàn thành gần đây
    SELECT TOP 10
      p.[Project_id], p.[CustomerName], p.[MeetingTopic],
      p.[SubmitterName], p.[Status], p.[UpdatedAt],
      COUNT(DISTINCT t.[OnboardDate]) AS TotalDays
    FROM [dbo].[CSR_Projects] p
    LEFT JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[IsActive] = 1
    WHERE p.[Status] = N'Hoàn thành'
      AND p.[RecordType] = 1
      AND p.[UpdatedAt] >= DATEADD(DAY, -30, GETDATE())
      AND (
          @ActorRole != 'User'
          OR p.[SubmitterMNV] = @ActorMNV
      )
    GROUP BY p.[Project_id], p.[CustomerName], p.[MeetingTopic],
             p.[SubmitterName], p.[Status], p.[UpdatedAt]
    ORDER BY p.[UpdatedAt] DESC;

    -- 6. Stats KPI tổng hợp (Sử dụng 4 cards lớn: Tổng đơn, Đang xử lý, Chờ phản hồi, Việc trễ hạn)
    SELECT
      (SELECT COUNT(*) FROM [dbo].[CSR_Projects] WHERE [RecordType] = 1 AND [Status] != N'Đã huỷ') AS TotalSubmissions,
      (SELECT COUNT(*) FROM [dbo].[CSR_Projects] WHERE [RecordType] = 1 AND [Status] = N'Hoàn thành') AS CompletedSubmissions,
      (SELECT COUNT(*) FROM [dbo].[CSR_Projects] WHERE [RecordType] = 1 AND [Status] IN (N'Chờ phản hồi', N'PRD đã duyệt', N'Đã gửi-Chờ phản hồi')) AS ProcessingSubmissions,
      (SELECT COUNT(*) FROM [dbo].[CSR_Projects] WHERE [RecordType] = 1 AND [Status] IN (N'Đã gửi-Chờ phản hồi', N'Chờ phản hồi')) AS PendingSubmissions,
      (SELECT COUNT(*) FROM [dbo].[CSR_Tasks] t
          INNER JOIN [dbo].[CSR_Projects] p ON p.[Project_id] = t.[Project_id]
          WHERE t.[IsActive] = 1 
            AND t.[DeadlineDate] < CAST(GETDATE() AS DATE)
            AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)
            AND t.[TaskStatus] != N'Hoàn thành'
            AND p.[Status] IN (N'BOD đã duyệt', N'PRD đã duyệt', N'Chờ phản hồi')) AS OverdueTasksCount,
      -- Thống kê theo tháng (Line Chart dữ liệu cho Dashboard)
      (SELECT COUNT(*) FROM [dbo].[CSR_Projects] p
          INNER JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[IsActive] = 1
          WHERE p.[Status] IN (N'BOD đã duyệt', N'Hoàn thành', N'PRD đã duyệt', N'Chờ phản hồi')
            AND p.[RecordType] = 1
            AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)
            AND t.[OnboardDate] <= DATEADD(DAY, 7, CAST(GETDATE() AS DATE))) AS UpcomingWeekCount;

    -- 7. Danh sách Notifications mới nhất (Dành cho phần tin tức/thông báo)
    SELECT TOP 10 [Id], [Message], [IsRead], [CreatedAt], [ProjectId]
    FROM [dbo].[CSR_Notifications]
    ORDER BY [CreatedAt] DESC;
END
GO

-- ============================================================
-- 6. usp_GetTaskManagement
-- Lấy danh sách task cho màn hình quản lý công việc (Table & Kanban)
-- Phân quyền: User chỉ xem các task assign cho mình
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_GetTaskManagement]
    @ActorRole      NVARCHAR(50) = '',
    @ActorMNV       NVARCHAR(50) = '',
    @Department     NVARCHAR(200) = NULL,
    @Assignee       NVARCHAR(200) = NULL,
    @TaskStatus     NVARCHAR(50) = NULL
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
      -- Áp dụng bộ lọc
      AND (@Department IS NULL OR e.[Department] = @Department)
      AND (@Assignee IS NULL OR t.[Assignee] = @Assignee OR t.[AssigneeEmail] = @Assignee)
      AND (@TaskStatus IS NULL OR (
          CASE 
              WHEN t.[TaskStatus] = N'Hoàn thành' OR t.[OnboardDate] < CAST(GETDATE() AS DATE) THEN N'Hoàn thành'
              WHEN t.[TaskStatus] = N'Đang xử lý' OR (t.[TaskStatus] != N'Hoàn thành' AND t.[DeadlineDate] >= CAST(GETDATE() AS DATE) AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)) THEN N'Đang xử lý'
              ELSE N'Delay'
          END = @TaskStatus
      ))
    ORDER BY t.[OnboardDate] ASC, t.[DeadlineDate] ASC;
END
GO

-- ============================================================
-- 7. usp_UpdateTaskStatus
-- Cập nhật trạng thái của task (sử dụng khi kéo thả hoặc update thủ công)
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_UpdateTaskStatus]
    @TaskId     NVARCHAR(150),
    @NewStatus  NVARCHAR(50),
    @ActorMNV   NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    IF NOT EXISTS (SELECT 1 FROM [dbo].[CSR_Tasks] WHERE [Task_id] = @TaskId)
    BEGIN
        RAISERROR('Không tìm thấy công việc', 16, 1);
        RETURN;
    END

    UPDATE [dbo].[CSR_Tasks]
    SET [TaskStatus] = @NewStatus
    WHERE [Task_id] = @TaskId;

    -- Thêm log audit (nếu bảng CSR_AuditLogs có tồn tại)
    IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CSR_AuditLogs]') AND type = N'U')
    BEGIN
        INSERT INTO [dbo].[CSR_AuditLogs] ([Action], [Details], [MNV], [CreatedAt])
        VALUES ('UPDATE_TASK_STATUS', N'Cập nhật trạng thái Task ' + @TaskId + N' sang ' + @NewStatus, ISNULL(@ActorMNV, 'SYSTEM'), GETDATE());
    END

    SELECT @TaskId AS [TaskId], @NewStatus AS [TaskStatus], N'Cập nhật trạng thái thành công' AS [Message];
END
GO

-- ============================================================
-- 8. Stored Procedures cho Task Notes
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_GetTaskNotes]
    @TaskId NVARCHAR(150)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [Id], [TaskId], [Content], [AuthorMNV], [AuthorName], [CreatedAt]
    FROM [dbo].[CSR_TaskNotes]
    WHERE [TaskId] = @TaskId
    ORDER BY [CreatedAt] DESC;
END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_AddTaskNote]
    @TaskId     NVARCHAR(150),
    @Content    NVARCHAR(MAX),
    @AuthorMNV  NVARCHAR(50),
    @AuthorName NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO [dbo].[CSR_TaskNotes] ([TaskId], [Content], [AuthorMNV], [AuthorName], [CreatedAt])
    VALUES (@TaskId, @Content, @AuthorMNV, @AuthorName, GETDATE());

    SELECT SCOPE_IDENTITY() AS [Id], @TaskId AS [TaskId], @Content AS [Content], 
           @AuthorMNV AS [AuthorMNV], @AuthorName AS [AuthorName], GETDATE() AS [CreatedAt];
END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_DeleteTaskNote]
    @NoteId INT,
    @AuthorMNV NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Admin có quyền xoá bất kỳ note nào, còn lại chỉ xoá được note của chính mình
    DELETE FROM [dbo].[CSR_TaskNotes]
    WHERE [Id] = @NoteId
      AND (@AuthorMNV IS NULL OR [AuthorMNV] = @AuthorMNV);

    SELECT @NoteId AS [NoteId], N'Đã xoá ghi chú thành công' AS [Message];
END
GO

-- ============================================================
-- 9. Stored Procedures cho Task Attachments
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_GetTaskAttachments]
    @TaskId NVARCHAR(150)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [Id], [TaskId], [FileName], [FilePath], [FileSize], [UploadedBy], [CreatedAt]
    FROM [dbo].[CSR_TaskAttachments]
    WHERE [TaskId] = @TaskId
    ORDER BY [CreatedAt] DESC;
END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_AddTaskAttachment]
    @TaskId     NVARCHAR(150),
    @FileName   NVARCHAR(500),
    @FilePath   NVARCHAR(1000),
    @FileSize   BIGINT,
    @UploadedBy NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO [dbo].[CSR_TaskAttachments] ([TaskId], [FileName], [FilePath], [FileSize], [UploadedBy], [CreatedAt])
    VALUES (@TaskId, @FileName, @FilePath, @FileSize, @UploadedBy, GETDATE());

    SELECT SCOPE_IDENTITY() AS [Id], @TaskId AS [TaskId], @FileName AS [FileName], 
           @FilePath AS [FilePath], @FileSize AS [FileSize], @UploadedBy AS [UploadedBy], GETDATE() AS [CreatedAt];
END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_DeleteTaskAttachment]
    @AttachmentId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @FilePath NVARCHAR(1000);
    SELECT @FilePath = [FilePath] FROM [dbo].[CSR_TaskAttachments] WHERE [Id] = @AttachmentId;

    DELETE FROM [dbo].[CSR_TaskAttachments]
    WHERE [Id] = @AttachmentId;

    SELECT @AttachmentId AS [AttachmentId], @FilePath AS [FilePath], N'Đã xoá file đính kèm thành công' AS [Message];
END
GO

-- ============================================================
-- 10. Stored Procedures cho Review Criteria
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_GetReviewCriteria]
    @OnlyActive BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [Id], [CriteriaName], [Description], [CriteriaGroup], [SortOrder], [IsRequired], [IsActive], [CreatedAt]
    FROM [dbo].[CSR_ReviewCriteria]
    WHERE @OnlyActive = 0 OR [IsActive] = 1
    ORDER BY [SortOrder] ASC, [CriteriaGroup] ASC;
END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_UpsertReviewCriteria]
    @Id             INT = NULL,
    @CriteriaName   NVARCHAR(200),
    @Description    NVARCHAR(500) = NULL,
    @CriteriaGroup  NVARCHAR(100),
    @SortOrder      INT = 0,
    @IsRequired     BIT = 0,
    @IsActive       BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    IF @Id IS NULL OR @Id <= 0
    BEGIN
        INSERT INTO [dbo].[CSR_ReviewCriteria] ([CriteriaName], [Description], [CriteriaGroup], [SortOrder], [IsRequired], [IsActive], [CreatedAt])
        VALUES (@CriteriaName, @Description, @CriteriaGroup, @SortOrder, @IsRequired, @IsActive, GETDATE());
        
        SELECT SCOPE_IDENTITY() AS [Id], @CriteriaName AS [CriteriaName], N'Thêm mới tiêu chí thành công' AS [Message];
    END
    ELSE
    BEGIN
        UPDATE [dbo].[CSR_ReviewCriteria]
        SET [CriteriaName]  = @CriteriaName,
            [Description]   = @Description,
            [CriteriaGroup] = @CriteriaGroup,
            [SortOrder]     = @SortOrder,
            [IsRequired]    = @IsRequired,
            [IsActive]      = @IsActive
        WHERE [Id] = @Id;

        SELECT @Id AS [Id], @CriteriaName AS [CriteriaName], N'Cập nhật tiêu chí thành công' AS [Message];
    END
END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_SubmitReviews]
    @ProjectId      NVARCHAR(100),
    @ReviewerName   NVARCHAR(200) = NULL,
    @ReviewsJson    NVARCHAR(MAX)   -- JSON array: [{"criteriaId": 1, "rating": 5, "comment": "Tốt"}, ...]
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        -- Xoá đánh giá cũ cho dự án này nếu có
        DELETE FROM [dbo].[CSR_Reviews] WHERE [ProjectId] = @ProjectId;

        -- Insert đánh giá mới từ JSON
        INSERT INTO [dbo].[CSR_Reviews] ([ProjectId], [CriteriaId], [Rating], [Comment], [ReviewerName], [CreatedAt])
        SELECT 
            @ProjectId,
            [criteriaId],
            [rating],
            [comment],
            @ReviewerName,
            GETDATE()
        FROM OPENJSON(@ReviewsJson)
        WITH (
            [criteriaId] INT            '$.criteriaId',
            [rating]     INT            '$.rating',
            [comment]    NVARCHAR(MAX)  '$.comment'
        );

        COMMIT TRANSACTION;
        SELECT @ProjectId AS [ProjectId], N'Gửi đánh giá thành công' AS [Message];
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        DECLARE @Err NVARCHAR(500) = ERROR_MESSAGE();
        RAISERROR(@Err, 16, 1);
    END CATCH
END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_GetProjectReviews]
    @ProjectId NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT r.[Id], r.[ProjectId], r.[CriteriaId], c.[CriteriaName], c.[CriteriaGroup], 
           r.[Rating], r.[Comment], r.[ReviewerName], r.[CreatedAt]
    FROM [dbo].[CSR_Reviews] r
    INNER JOIN [dbo].[CSR_ReviewCriteria] c ON r.[CriteriaId] = c.[Id]
    WHERE r.[ProjectId] = @ProjectId
    ORDER BY c.[SortOrder] ASC;
END
GO
