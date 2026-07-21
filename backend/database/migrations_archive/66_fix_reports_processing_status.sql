-- Migration 66: Fix 2 bug ở màn hình Báo cáo & Thống kê
-- Bug 1: Đơn của khách Partner/Supplier/Khách vãng lai/Ứng viên phỏng vấn (không bắt buộc có Task)
--        bị loại khỏi chart "Số đơn tiếp đón (Tổng cộng)" do dùng INNER JOIN CSR_Tasks.
--        => Đổi sang LEFT JOIN, dùng CreatedAt làm fallback cho trục Ox khi không có OnboardDate.
-- Bug 2: Phân loại trạng thái đơn dựa theo StatusId (CSR_Statuses) thay vì so khớp text TenTrangThai:
--        Hoàn thành = StatusId 5 (BOD đã duyệt), 7 (Hoàn thành)
--        Đang xử lý = StatusId 4 (PRD đã duyệt), 6 (BOD từ chối), 10 (PRD từ chối - thêm ở migration 67)
--        Chờ phản hồi = StatusId 8
--        (Trước đây "BOD đã duyệt" - StatusId 5 - bị tính nhầm vào nhóm Đang xử lý)
USE CSR_DB;
GO

-- 1. usp_GetFilterOptions
CREATE OR ALTER PROCEDURE [dbo].[usp_GetFilterOptions]
AS
BEGIN
    SET NOCOUNT ON;

    -- 1. Năm tạo đơn
    SELECT DISTINCT YEAR([CreatedAt]) AS [Year]
    FROM [dbo].[CSR_Projects]
    WHERE [RecordType] = 1
    ORDER BY [Year] DESC;

    -- 2. Tháng trong năm (1-12)
    SELECT [Id] AS [Month], [Name] AS [MonthName]
    FROM (
                                                                                                    SELECT 1 AS [Id], N'Tháng 1' AS [Name]
        UNION
            SELECT 2, N'Tháng 2'
        UNION
            SELECT 3, N'Tháng 3'
        UNION
            SELECT 4, N'Tháng 4'
        UNION
            SELECT 5, N'Tháng 5'
        UNION
            SELECT 6, N'Tháng 6'
        UNION
            SELECT 7, N'Tháng 7'
        UNION
            SELECT 8, N'Tháng 8'
        UNION
            SELECT 9, N'Tháng 9'
        UNION
            SELECT 10, N'Tháng 10'
        UNION
            SELECT 11, N'Tháng 11'
        UNION
            SELECT 12, N'Tháng 12'
    ) m
    ORDER BY [Id];

    -- 3. Tuần trong năm (1-53)
    SELECT DISTINCT DATEPART(WEEK, t.[OnboardDate]) AS [Week]
    FROM [dbo].[CSR_Tasks] t
    WHERE t.[StatusId] = 1
    ORDER BY [Week] ASC;

    -- 4. Loại khách hàng (CustomerType)
    SELECT DISTINCT [CustomerType]
    FROM [dbo].[CSR_Projects]
    WHERE [CustomerType] IS NOT NULL AND [CustomerType] != '' AND [RecordType] = 1;

    -- 5. Tên khách hàng (CustomerName)
    SELECT DISTINCT [CustomerName]
    FROM [dbo].[CSR_Projects]
    WHERE [CustomerName] IS NOT NULL AND [CustomerName] != '' AND [RecordType] = 1;

    -- 6. Địa điểm tiếp đón (Destination)
    SELECT DISTINCT [Destination]
    FROM [dbo].[CSR_Tasks]
    WHERE [Destination] IS NOT NULL AND [Destination] != '' AND [StatusId] = 1;

    -- 7. Bộ phận phụ trách (Bộ phận của Assignee - lấy từ CSR_Employees)
    SELECT DISTINCT COALESCE(e.[Department], N'Chưa phân loại') AS [Department]
    FROM [dbo].[CSR_Tasks] t
        LEFT JOIN [dbo].[CSR_Employees] e ON t.[AssigneeEmail] = e.[Email]
    WHERE t.[StatusId] = 1;

    -- 8. Trạng thái dự án (Status)
    SELECT DISTINCT s.[TenTrangThai] AS [Status]
    FROM [dbo].[CSR_Projects] p
        INNER JOIN [dbo].[CSR_Statuses] s ON p.[StatusId] = s.[Id]
    WHERE p.[RecordType] = 1;
END;
GO


-- 2. usp_GetReportsSummary
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
        p.[SubmitterName], s.[TenTrangThai] AS [Status], p.[StatusId], p.[CreatedAt], p.[UpdatedAt], p.[SubmitterMNV]
    INTO #FilteredProjects
    FROM [dbo].[CSR_Projects] p
        INNER JOIN [dbo].[CSR_Statuses] s ON p.[StatusId] = s.[Id]
        LEFT JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1
        LEFT JOIN [dbo].[CSR_Employees] e ON p.[SubmitterMNV] = e.[MNV]
    WHERE p.[RecordType] = 1
        AND p.[StatusId] != 9 -- Khác Đã huỷ
        AND (@Year IS NULL OR @Year = '' OR YEAR(p.[CreatedAt]) IN (SELECT CAST(value AS INT)
        FROM STRING_SPLIT(@Year, ',')))
        AND (@Month IS NULL OR @Month = '' OR MONTH(p.[CreatedAt]) IN (SELECT CAST(value AS INT)
        FROM STRING_SPLIT(@Month, ',')))
        AND (@Week IS NULL OR @Week = '' OR DATEPART(WEEK, p.[CreatedAt]) IN (SELECT CAST(value AS INT)
        FROM STRING_SPLIT(@Week, ',')))
        AND (@CustomerType IS NULL OR @CustomerType = '' OR p.[CustomerType] IN (SELECT value
        FROM STRING_SPLIT(@CustomerType, ',')))
        AND (@CustomerName IS NULL OR @CustomerName = '' OR p.[CustomerName] IN (SELECT value
        FROM STRING_SPLIT(@CustomerName, ',')))
        AND (@Destination IS NULL OR @Destination = '' OR t.[Destination] IN (SELECT value
        FROM STRING_SPLIT(@Destination, ',')))
        AND (@Department IS NULL OR @Department = '' OR e.[Department] IN (SELECT value
        FROM STRING_SPLIT(@Department, ',')))
        -- Mapping trạng thái theo StatusId (bảng CSR_Statuses):
        -- Đang xử lý = StatusId 4 (PRD đã duyệt) hoặc 6 (BOD từ chối); Chờ phản hồi = StatusId 8; Hoàn thành = StatusId 7
        AND (@ProjectStatus IS NULL OR @ProjectStatus = '' OR (
          (CHARINDEX(N'Hoàn thành', @ProjectStatus) > 0 AND p.[StatusId] IN (5, 7))
        OR (CHARINDEX(N'Đang xử lý', @ProjectStatus) > 0 AND p.[StatusId] IN (4, 6, 10))
        OR (CHARINDEX(N'Chờ phản hồi', @ProjectStatus) > 0 AND p.[StatusId] = 8)
      ))
        AND (@TaskStatus IS NULL OR @TaskStatus = '' OR EXISTS (
          SELECT 1
        FROM STRING_SPLIT(@TaskStatus, ',')
        WHERE value = CASE 
              WHEN t.[TaskStatus] = N'Hoàn thành' OR t.[OnboardDate] < CAST(GETDATE() AS DATE) THEN N'Hoàn thành'
              WHEN t.[TaskStatus] = N'Đang xử lý' OR (t.[TaskStatus] != N'Hoàn thành' AND t.[DeadlineDate] >= CAST(GETDATE() AS DATE) AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)) THEN N'Đang xử lý'
              ELSE N'Delay'
          END
      ));

    -- KPI Cards (Cả % MoM và % YoY)
    DECLARE @CurrCount INT, @PrevMonthCount INT, @PrevYearCount INT;
    SELECT @CurrCount = COUNT(*)
    FROM #FilteredProjects;

    -- Đơn tháng trước (MoM)
    DECLARE @PrevMonth INT = CASE WHEN @TargetMonth = 1 THEN 12 ELSE @TargetMonth - 1 END;
    DECLARE @PrevMonthYear INT = CASE WHEN @TargetMonth = 1 THEN @TargetYear - 1 ELSE @TargetYear END;

    SELECT @PrevMonthCount = COUNT(DISTINCT p.[Project_id])
    FROM [dbo].[CSR_Projects] p
        LEFT JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1
        LEFT JOIN [dbo].[CSR_Employees] e ON p.[SubmitterMNV] = e.[MNV]
    WHERE p.[RecordType] = 1 AND p.[StatusId] != 9
        AND YEAR(p.[CreatedAt]) = @PrevMonthYear AND MONTH(p.[CreatedAt]) = @PrevMonth
        AND (@CustomerType IS NULL OR @CustomerType = '' OR p.[CustomerType] IN (SELECT value
        FROM STRING_SPLIT(@CustomerType, ',')))
        AND (@CustomerName IS NULL OR @CustomerName = '' OR p.[CustomerName] IN (SELECT value
        FROM STRING_SPLIT(@CustomerName, ',')))
        AND (@Destination IS NULL OR @Destination = '' OR t.[Destination] IN (SELECT value
        FROM STRING_SPLIT(@Destination, ',')))
        AND (@Department IS NULL OR @Department = '' OR e.[Department] IN (SELECT value
        FROM STRING_SPLIT(@Department, ',')));

    -- Đơn cùng kỳ năm trước (YoY)
    SELECT @PrevYearCount = COUNT(DISTINCT p.[Project_id])
    FROM [dbo].[CSR_Projects] p
        LEFT JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1
        LEFT JOIN [dbo].[CSR_Employees] e ON p.[SubmitterMNV] = e.[MNV]
    WHERE p.[RecordType] = 1 AND p.[StatusId] != 9
        AND YEAR(p.[CreatedAt]) = @TargetYear - 1 AND MONTH(p.[CreatedAt]) = @TargetMonth
        AND (@CustomerType IS NULL OR @CustomerType = '' OR p.[CustomerType] IN (SELECT value
        FROM STRING_SPLIT(@CustomerType, ',')))
        AND (@CustomerName IS NULL OR @CustomerName = '' OR p.[CustomerName] IN (SELECT value
        FROM STRING_SPLIT(@CustomerName, ',')))
        AND (@Destination IS NULL OR @Destination = '' OR t.[Destination] IN (SELECT value
        FROM STRING_SPLIT(@Destination, ',')))
        AND (@Department IS NULL OR @Department = '' OR e.[Department] IN (SELECT value
        FROM STRING_SPLIT(@Department, ',')));

    -- Rating trung bình kỳ hiện tại, MoM, YoY
    DECLARE @CurrRating FLOAT, @PrevMonthRating FLOAT, @PrevYearRating FLOAT;
    SELECT @CurrRating = AVG(CAST(r.[Rating] AS FLOAT))
    FROM [dbo].[CSR_Reviews] r
        INNER JOIN #FilteredProjects p ON r.[ProjectId] = p.[Project_id];

    SELECT @PrevMonthRating = AVG(CAST(r.[Rating] AS FLOAT))
    FROM [dbo].[CSR_Reviews] r
        INNER JOIN [dbo].[CSR_Projects] p ON r.[ProjectId] = p.[Project_id]
        LEFT JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1
        LEFT JOIN [dbo].[CSR_Employees] e ON p.[SubmitterMNV] = e.[MNV]
    WHERE p.[RecordType] = 1 AND p.[StatusId] != 9
        AND YEAR(p.[CreatedAt]) = @PrevMonthYear AND MONTH(p.[CreatedAt]) = @PrevMonth
        AND (@CustomerType IS NULL OR @CustomerType = '' OR p.[CustomerType] IN (SELECT value
        FROM STRING_SPLIT(@CustomerType, ',')))
        AND (@CustomerName IS NULL OR @CustomerName = '' OR p.[CustomerName] IN (SELECT value
        FROM STRING_SPLIT(@CustomerName, ',')))
        AND (@Destination IS NULL OR @Destination = '' OR t.[Destination] IN (SELECT value
        FROM STRING_SPLIT(@Destination, ',')))
        AND (@Department IS NULL OR @Department = '' OR e.[Department] IN (SELECT value
        FROM STRING_SPLIT(@Department, ',')));

    SELECT @PrevYearRating = AVG(CAST(r.[Rating] AS FLOAT))
    FROM [dbo].[CSR_Reviews] r
        INNER JOIN [dbo].[CSR_Projects] p ON r.[ProjectId] = p.[Project_id]
        LEFT JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1
        LEFT JOIN [dbo].[CSR_Employees] e ON p.[SubmitterMNV] = e.[MNV]
    WHERE p.[RecordType] = 1 AND p.[StatusId] != 9
        AND YEAR(p.[CreatedAt]) = @TargetYear - 1 AND MONTH(p.[CreatedAt]) = @TargetMonth
        AND (@CustomerType IS NULL OR @CustomerType = '' OR p.[CustomerType] IN (SELECT value
        FROM STRING_SPLIT(@CustomerType, ',')))
        AND (@CustomerName IS NULL OR @CustomerName = '' OR p.[CustomerName] IN (SELECT value
        FROM STRING_SPLIT(@CustomerName, ',')))
        AND (@Destination IS NULL OR @Destination = '' OR t.[Destination] IN (SELECT value
        FROM STRING_SPLIT(@Destination, ',')))
        AND (@Department IS NULL OR @Department = '' OR e.[Department] IN (SELECT value
        FROM STRING_SPLIT(@Department, ',')));

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
        WHERE t.[StatusId] = 1
    ) t_status;

    -- Output 1: KPIs
    SELECT
        @CurrCount AS [TotalSubmissions],
        CASE WHEN @PrevMonthCount > 0 THEN ROUND((CAST(@CurrCount - @PrevMonthCount AS FLOAT) / @PrevMonthCount) * 100, 1) ELSE NULL END AS [TotalMoM],
        CASE WHEN @PrevYearCount > 0 THEN ROUND((CAST(@CurrCount - @PrevYearCount AS FLOAT) / @PrevYearCount) * 100, 1) ELSE NULL END AS [TotalYoY],

        ISNULL(SUM(CASE WHEN [StatusId] IN (5, 7) THEN 1 ELSE 0 END), 0) AS [CompletedSubmissions],
        ISNULL(SUM(CASE WHEN [StatusId] IN (4, 6, 10) THEN 1 ELSE 0 END), 0) AS [ProcessingSubmissions],
        ISNULL(SUM(CASE WHEN [StatusId] = 8 THEN 1 ELSE 0 END), 0) AS [PendingSubmissions],

        ROUND(ISNULL(@CurrRating, 0), 2) AS [AverageRating],
        CASE WHEN @PrevMonthRating > 0 THEN ROUND(((@CurrRating - @PrevMonthRating) / @PrevMonthRating) * 100, 1) ELSE NULL END AS [RatingMoM],
        CASE WHEN @PrevYearRating > 0 THEN ROUND(((@CurrRating - @PrevYearRating) / @PrevYearRating) * 100, 1) ELSE NULL END AS [RatingYoY],

        ISNULL(@TotalTasks, 0) AS [TotalTasks],
        ISNULL(@CompletedTasks, 0) AS [CompletedTasks],
        ISNULL(@ProcessingTasks, 0) AS [ProcessingTasks],
        ISNULL(@DelayTasks, 0) AS [DelayTasks]
    FROM #FilteredProjects;

    -- Output 2: Tổng số đơn tiếp đón chạy theo tình trạng đơn, trục Ox đi theo ngày tiếp đón
    -- LEFT JOIN (thay vì INNER JOIN) để không loại bỏ các đơn không phát sinh Task
    -- (VD: Partner, Supplier, Khách vãng lai, Ứng viên phỏng vấn — không bắt buộc có task).
    -- Với các đơn này, dùng ngày tạo đơn (CreatedAt) làm mốc trên trục Ox thay cho OnboardDate.
    SELECT
        CONVERT(NVARCHAR(10), ISNULL(t.[OnboardDate], CAST(p.[CreatedAt] AS DATE)), 23) AS [OnboardDate],
        SUM(CASE WHEN p.[StatusId] IN (5, 7) THEN 1 ELSE 0 END) AS [Completed],
        SUM(CASE WHEN p.[StatusId] IN (4, 6, 10) THEN 1 ELSE 0 END) AS [Processing],
        SUM(CASE WHEN p.[StatusId] = 8 THEN 1 ELSE 0 END) AS [Pending]
    FROM #FilteredProjects p
        LEFT JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1
    GROUP BY ISNULL(t.[OnboardDate], CAST(p.[CreatedAt] AS DATE))
    ORDER BY ISNULL(t.[OnboardDate], CAST(p.[CreatedAt] AS DATE)) ASC;

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
        INNER JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1
    GROUP BY t.[Destination]
    ORDER BY [Count] DESC;

    -- Output 5: Tỷ lệ đơn tiếp đón theo tình trạng (Biểu đồ tròn)
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
        [MeetingTopic] = (SELECT TOP 1
            MeetingTopic
        FROM [dbo].[CSR_Projects]
        WHERE Project_id = p.Project_id),
        [SubmitterName],
        [Status],
        [CreatedAt],
        [OnboardDates] = STUFF((
            SELECT DISTINCT ', ' + CONVERT(NVARCHAR(10), t2.[OnboardDate], 103)
        FROM [dbo].[CSR_Tasks] t2
        WHERE t2.[Project_id] = p.[Project_id] AND t2.[StatusId] = 1
        FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'), 1, 2, '')
    FROM #FilteredProjects p
    ORDER BY p.[CreatedAt] DESC;

    DROP TABLE #FilteredProjects;
END;
GO


-- 3. usp_GetReportsReview
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
        INNER JOIN [dbo].[CSR_Statuses] s ON p.[StatusId] = s.[Id]
        LEFT JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1
        LEFT JOIN [dbo].[CSR_Employees] e ON p.[SubmitterMNV] = e.[MNV]
    WHERE p.[RecordType] = 1
        AND p.[StatusId] != 9 -- Khác Đã huỷ
        AND (@Year IS NULL OR @Year = '' OR YEAR(p.[CreatedAt]) IN (SELECT CAST(value AS INT)
        FROM STRING_SPLIT(@Year, ',')))
        AND (@Month IS NULL OR @Month = '' OR MONTH(p.[CreatedAt]) IN (SELECT CAST(value AS INT)
        FROM STRING_SPLIT(@Month, ',')))
        AND (@Week IS NULL OR @Week = '' OR DATEPART(WEEK, p.[CreatedAt]) IN (SELECT CAST(value AS INT)
        FROM STRING_SPLIT(@Week, ',')))
        AND (@CustomerType IS NULL OR @CustomerType = '' OR p.[CustomerType] IN (SELECT value
        FROM STRING_SPLIT(@CustomerType, ',')))
        AND (@CustomerName IS NULL OR @CustomerName = '' OR p.[CustomerName] IN (SELECT value
        FROM STRING_SPLIT(@CustomerName, ',')))
        AND (@Destination IS NULL OR @Destination = '' OR t.[Destination] IN (SELECT value
        FROM STRING_SPLIT(@Destination, ',')))
        AND (@Department IS NULL OR @Department = '' OR e.[Department] IN (SELECT value
        FROM STRING_SPLIT(@Department, ',')))
        AND (@ProjectStatus IS NULL OR @ProjectStatus = '' OR (
          (CHARINDEX(N'Hoàn thành', @ProjectStatus) > 0 AND p.[StatusId] IN (5, 7))
        OR (CHARINDEX(N'Đang xử lý', @ProjectStatus) > 0 AND p.[StatusId] IN (4, 6, 10))
        OR (CHARINDEX(N'Chờ phản hồi', @ProjectStatus) > 0 AND p.[StatusId] = 8)
      ))
        AND (@TaskStatus IS NULL OR @TaskStatus = '' OR EXISTS (
          SELECT 1
        FROM STRING_SPLIT(@TaskStatus, ',')
        WHERE value = CASE 
              WHEN t.[TaskStatus] = N'Hoàn thành' OR t.[OnboardDate] < CAST(GETDATE() AS DATE) THEN N'Hoàn thành'
              WHEN t.[TaskStatus] = N'Đang xử lý' OR (t.[TaskStatus] != N'Hoàn thành' AND t.[DeadlineDate] >= CAST(GETDATE() AS DATE) AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)) THEN N'Đang xử lý'
              ELSE N'Delay'
          END
      ));

    -- 1. Điểm đánh giá trung bình tổng thể
    SELECT
        ROUND(AVG(CAST(r.[Rating] AS FLOAT)), 2) AS [AverageRating],
        COUNT(r.[Id]) AS [TotalReviews],
        (
            SELECT TOP 1
            c.[CriteriaName]
        FROM [dbo].[CSR_Reviews] r2
            INNER JOIN #FilteredProjects f2 ON r2.[ProjectId] = f2.[Project_id]
            INNER JOIN [dbo].[CSR_ReviewCriteria] c ON r2.[CriteriaId] = c.[Id]
        GROUP BY c.[CriteriaName]
        ORDER BY AVG(CAST(r2.[Rating] AS FLOAT)) DESC, c.[CriteriaName]
        ) AS [TopCriteriaName],
        (
            SELECT TOP 1
            c.[CriteriaName]
        FROM [dbo].[CSR_Reviews] r2
            INNER JOIN #FilteredProjects f2 ON r2.[ProjectId] = f2.[Project_id]
            INNER JOIN [dbo].[CSR_ReviewCriteria] c ON r2.[CriteriaId] = c.[Id]
        GROUP BY c.[CriteriaName]
        ORDER BY AVG(CAST(r2.[Rating] AS FLOAT)) ASC, c.[CriteriaName]
        ) AS [BottomCriteriaName]
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

    -- 3. Điểm trung bình theo địa điểm
    SELECT
        ISNULL(t.[Destination], N'Không xác định') AS [Destination],
        ROUND(AVG(CAST(r.[Rating] AS FLOAT)), 2) AS [AverageRating]
    FROM [dbo].[CSR_Reviews] r
        INNER JOIN #FilteredProjects p ON r.[ProjectId] = p.[Project_id]
        INNER JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1
    GROUP BY t.[Destination]
    ORDER BY [AverageRating] DESC;

    -- 4. Chi tiết các phản hồi / bình luận của khách hàng
    SELECT
        r.[Id],
        r.[ProjectId],
        p.[CustomerName],
        r.[ReviewerName],
        r.[Rating],
        r.[Comment],
        r.[CreatedAt],
        [OnboardDates] = STUFF((
            SELECT DISTINCT ', ' + CONVERT(NVARCHAR(10), t2.[OnboardDate], 103)
        FROM [dbo].[CSR_Tasks] t2
        WHERE t2.[Project_id] = p.[Project_id] AND t2.[StatusId] = 1
        FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'), 1, 2, ''),
        [Destinations] = STUFF((
            SELECT DISTINCT ', ' + t2.[Destination]
        FROM [dbo].[CSR_Tasks] t2
        WHERE t2.[Project_id] = p.[Project_id] AND t2.[StatusId] = 1
        FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'), 1, 2, '')
    FROM [dbo].[CSR_Reviews] r
        INNER JOIN #FilteredProjects pr ON r.[ProjectId] = pr.[Project_id]
        INNER JOIN [dbo].[CSR_Projects] p ON pr.[Project_id] = p.[Project_id]
    ORDER BY r.[CreatedAt] DESC;

    DROP TABLE #FilteredProjects;
END;
GO


-- 4. usp_GetReportsProgress
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
        INNER JOIN [dbo].[CSR_Statuses] s ON p.[StatusId] = s.[Id]
        LEFT JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1
        LEFT JOIN [dbo].[CSR_Employees] e ON p.[SubmitterMNV] = e.[MNV]
    WHERE p.[RecordType] = 1
        AND p.[StatusId] != 9 -- Khác Đã huỷ
        AND (@Year IS NULL OR @Year = '' OR YEAR(p.[CreatedAt]) IN (SELECT CAST(value AS INT)
        FROM STRING_SPLIT(@Year, ',')))
        AND (@Month IS NULL OR @Month = '' OR MONTH(p.[CreatedAt]) IN (SELECT CAST(value AS INT)
        FROM STRING_SPLIT(@Month, ',')))
        AND (@Week IS NULL OR @Week = '' OR DATEPART(WEEK, p.[CreatedAt]) IN (SELECT CAST(value AS INT)
        FROM STRING_SPLIT(@Week, ',')))
        AND (@CustomerType IS NULL OR @CustomerType = '' OR p.[CustomerType] IN (SELECT value
        FROM STRING_SPLIT(@CustomerType, ',')))
        AND (@CustomerName IS NULL OR @CustomerName = '' OR p.[CustomerName] IN (SELECT value
        FROM STRING_SPLIT(@CustomerName, ',')))
        AND (@Destination IS NULL OR @Destination = '' OR t.[Destination] IN (SELECT value
        FROM STRING_SPLIT(@Destination, ',')))
        AND (@Department IS NULL OR @Department = '' OR e.[Department] IN (SELECT value
        FROM STRING_SPLIT(@Department, ',')))
        AND (@ProjectStatus IS NULL OR @ProjectStatus = '' OR (
          (CHARINDEX(N'Hoàn thành', @ProjectStatus) > 0 AND p.[StatusId] IN (5, 7))
        OR (CHARINDEX(N'Đang xử lý', @ProjectStatus) > 0 AND p.[StatusId] IN (4, 6, 10))
        OR (CHARINDEX(N'Chờ phản hồi', @ProjectStatus) > 0 AND p.[StatusId] = 8)
      ))
        AND (@TaskStatus IS NULL OR @TaskStatus = '' OR EXISTS (
          SELECT 1
        FROM STRING_SPLIT(@TaskStatus, ',')
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
        LEFT JOIN [dbo].[CSR_Employees] e ON t.[AssigneeEmail] = e.[Email]
    WHERE t.[StatusId] = 1;

    -- 1. Tiến độ gửi đơn tiếp đón: Ontime (gửi trước 7 ngày) vs Delay (trong vòng 7 ngày)
    -- Tính từ ngày làm đơn (CreatedAt) đến ngày tiếp đón (OnboardDate) đầu tiên của đơn đó
    SELECT
        SUM(CASE WHEN DATEDIFF(DAY, p.[CreatedAt], t.MinOnboardDate) >= 7 THEN 1 ELSE 0 END) AS [OntimeCount],
        SUM(CASE WHEN DATEDIFF(DAY, p.[CreatedAt], t.MinOnboardDate) < 7 THEN 1 ELSE 0 END) AS [DelayCount]
    FROM #FilteredProjects p
        INNER JOIN (
        SELECT [Project_id], MIN([OnboardDate]) AS MinOnboardDate
        FROM [dbo].[CSR_Tasks]
        WHERE [StatusId] = 1
        GROUP BY [Project_id]
    ) t ON p.[Project_id] = t.[Project_id];

    -- 2. Tiến độ công việc: Ontime (Hoàn thành + Đang xử lý) vs Delay (Trễ hạn)
    SELECT
        SUM(CASE WHEN [ComputedStatus] != N'Delay' THEN 1 ELSE 0 END) AS [OntimeCount],
        SUM(CASE WHEN [ComputedStatus] = N'Delay' THEN 1 ELSE 0 END) AS [DelayCount]
    FROM #FilteredTasks;

    -- 3. Tỉ lệ Ontime và Delay của các phòng ban (team)
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
END;
GO

PRINT 'Migration 66: Fixed walk-in/no-task submissions missing from trend chart, and BOD-approved status no longer counted as Đang xử lý.';
GO