USE CSR_DB;
GO

-- ============================================================
-- 1. Xóa các Stored Procedures tên cũ
-- ============================================================
DROP PROCEDURE IF EXISTS [dbo].[usp_GetTaskConfig];
DROP PROCEDURE IF EXISTS [dbo].[usp_GetTaskConfigs];
DROP PROCEDURE IF EXISTS [dbo].[usp_GetSubmission];
DROP PROCEDURE IF EXISTS [dbo].[usp_GetSubmissions];
DROP PROCEDURE IF EXISTS [dbo].[usp_GetEmailTemplateById];
DROP PROCEDURE IF EXISTS [dbo].[usp_GetEmailTemplates];
DROP PROCEDURE IF EXISTS [dbo].[usp_GetTaskAttachmentById];
DROP PROCEDURE IF EXISTS [dbo].[usp_GetTaskAttachments];
DROP PROCEDURE IF EXISTS [dbo].[usp_GetDashboard];
DROP PROCEDURE IF EXISTS [dbo].[usp_GetDashboardV2];
GO

-- ============================================================
-- 2. Định nghĩa Stored Procedures với tên mới chuẩn hóa
-- ============================================================

-- ------------------------------------------------------------
-- Module: TaskConfig
-- ------------------------------------------------------------

-- A. usp_TaskConfig_GetDefaultsByDestinations (Cũ: usp_GetTaskConfig)
CREATE OR ALTER PROCEDURE [dbo].[usp_TaskConfig_GetDefaultsByDestinations]
    @Destinations NVARCHAR(MAX)  -- Comma-separated: 'VSN OFFICE,VAC'
AS
BEGIN
    SET NOCOUNT ON;

    -- Tách danh sách destinations
    CREATE TABLE #Dests (Dest NVARCHAR(100));
    INSERT INTO #Dests (Dest)
    SELECT LTRIM(RTRIM(value))
    FROM STRING_SPLIT(@Destinations, ',');

    SELECT
        d.Dest AS RequestedDestination,
        tc.Id,
        tc.Destination,
        tc.TaskName,
        tc.Description,
        tc.AssigneeName,
        tc.AssigneeEmail,
        tc.SupervisorName,
        tc.SupervisorEmail,
        tc.IsCompulsory,
        tc.LeadtimeDays,
        tc.IsActive
    FROM #Dests d
    JOIN dbo.CSR_TaskConfig tc ON tc.Destination = d.Dest
    WHERE tc.IsActive = 1
    ORDER BY d.Dest, tc.Id;

    DROP TABLE #Dests;
END;
GO

-- B. usp_TaskConfig_List (Cũ: usp_GetTaskConfigs)
CREATE OR ALTER PROCEDURE [dbo].[usp_TaskConfig_List]
    @Destination NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 
        [Id], [Destination], [TaskName], [Description], 
        [AssigneeId], [AssigneeName], [AssigneeEmail], 
        [SupervisorId], [SupervisorName], [SupervisorEmail],
        [IsCompulsory], [LeadtimeDays], [IsActive]
    FROM [dbo].[CSR_TaskConfig]
    WHERE (@Destination IS NULL OR [Destination] = @Destination)
    ORDER BY [Destination], [TaskName];
END
GO

-- ------------------------------------------------------------
-- Module: Submission (Đơn tiếp đón)
-- ------------------------------------------------------------

-- A. usp_Submission_GetDetail (Cũ: usp_GetSubmission)
CREATE OR ALTER PROCEDURE [dbo].[usp_Submission_GetDetail]
    @ProjectId NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

    -- Tự động cập nhật đơn này sang Hoàn thành nếu đủ điều kiện
    UPDATE p
    SET p.[Status] = N'Hoàn thành', p.[UpdatedAt] = GETDATE()
    FROM [dbo].[CSR_Projects] p
    WHERE p.[Project_id] = @ProjectId
      AND p.[Status] = N'BOD đã duyệt'
      AND p.[RecordType] = 1
      AND NOT EXISTS (
          SELECT 1 
          FROM [dbo].[CSR_Tasks] t
          WHERE t.[Project_id] = p.[Project_id]
            AND t.[IsActive] = 1
            AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)
      )
      AND EXISTS (
          SELECT 1 
          FROM [dbo].[CSR_Tasks] t
          WHERE t.[Project_id] = p.[Project_id]
            AND t.[IsActive] = 1
      );

    SELECT
        [Project_id], [Timestamp], [SubmitDate], [CustomerType], [CustomerName],
        [SubmitterEmail], [SubmitterName], [SubmitterMNV], [GuestRepName], [GuestReps],
        [GuestCount], [MeetingTopic], [Attendees], [AttendeesEmail],
        [AgendaInfo], [AgendaJsonData], [AgendaAttachUrl], [Status], [CreatedAt], [UpdatedAt]
    FROM [dbo].[CSR_Projects]
    WHERE [Project_id] = @ProjectId;

    SELECT
        v.[Task_id],
        v.[Project_id],
        v.[CustomerName],
        v.[CustomerType],
        v.[OnboardDate],
        v.[Destination],
        v.[TaskName],
        v.[TaskDetail],
        v.[Assignee],
        v.[AssigneeEmail],
        v.[Supervisor],
        v.[SupervisorEmail],
        t.[TaskAttendees],
        t.[TaskAttendeesEmail],
        t.[IncludeGuests],
        v.[DeadlineDate],
        v.[ReminderDate],
        v.[DeadlineStatus],
        v.[DaysUntilDeadline],
        v.[Vehicle],
        v.[PassengerCount],
        v.[FlightRoute],
        v.[ReturnDate],
        v.[MealOption],
        v.[MeetingRoom],
        v.[MeetingRoomEmail],
        v.[MeetingStartTime],
        v.[MeetingEndTime],
        v.[CalendarEventId],
        v.[ContentType]
    FROM [dbo].[vw_ActiveTasks] v
    INNER JOIN [dbo].[CSR_Tasks] t ON v.[Task_id] = t.[Task_id]
    WHERE v.[Project_id] = @ProjectId
    ORDER BY v.[OnboardDate], v.[Destination], v.[TaskName];
END;
GO

-- B. usp_Submission_List (Cũ: usp_GetSubmissions)
CREATE OR ALTER PROCEDURE [dbo].[usp_Submission_List]
    @SearchText     NVARCHAR(200)   = '',
    @Status         NVARCHAR(50)    = '',
    @ActorRole      NVARCHAR(50)    = '',
    @ActorMNV       NVARCHAR(50)    = '',
    @PageNumber     INT             = 1,
    @PageSize       INT             = 20,
    @Tab            NVARCHAR(50)    = 'tracking'
AS
BEGIN
    SET NOCOUNT ON;

    -- Tự động cập nhật các đơn đủ điều kiện sang Hoàn thành trước khi trả kết quả
    UPDATE p
    SET p.[Status] = N'Hoàn thành', p.[UpdatedAt] = GETDATE()
    FROM [dbo].[CSR_Projects] p
    WHERE p.[Status] = N'BOD đã duyệt'
      AND p.[RecordType] = 1
      AND NOT EXISTS (
          SELECT 1 
          FROM [dbo].[CSR_Tasks] t
          WHERE t.[Project_id] = p.[Project_id]
            AND t.[IsActive] = 1
            AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)
      )
      AND EXISTS (
          SELECT 1 
          FROM [dbo].[CSR_Tasks] t
          WHERE t.[Project_id] = p.[Project_id]
            AND t.[IsActive] = 1
      );

    WITH LatestVersions AS (
        SELECT 
            [Project_id], 
            ROW_NUMBER() OVER (PARTITION BY [ParentId] ORDER BY [Version] DESC) as rn,
            MIN([CreatedAt]) OVER (PARTITION BY [ParentId]) as OriginalCreatedAt
        FROM [dbo].[vw_SubmissionSummary]
    )
    SELECT
        v.[Project_id], v.[ParentId], v.[RecordType], v.[Version], v.[SubmitDate], v.[CustomerType], v.[CustomerName],
        v.[SubmitterName], v.[MeetingTopic], v.[Status],
        lv.OriginalCreatedAt AS [CreatedAt],
        CASE 
            WHEN v.[RecordType] = 1 THEN v.[UpdatedAt]
            ELSE v.[CreatedAt] 
        END AS [UpdatedAt],
        v.[TotalDays], v.[OnboardDates], v.[Destinations], v.[TotalTasks], v.[UrgentTasks]
    FROM [dbo].[vw_SubmissionSummary] v
    INNER JOIN LatestVersions lv ON v.[Project_id] = lv.[Project_id] AND lv.rn = 1
    WHERE
        (
            (@ActorRole = 'User' AND v.[SubmitterMNV] = @ActorMNV)
            OR (@ActorRole != 'User')
        )
        AND (@SearchText = '' OR [CustomerName] LIKE '%' + @SearchText + '%'
                         OR [SubmitterName] LIKE '%' + @SearchText + '%'
                         OR v.[Project_id]   LIKE '%' + @SearchText + '%')
        AND (@Status = '' OR [Status] = @Status)
        AND (
            -- Tab Theo dõi yêu cầu
            (@Tab = 'tracking' AND (
                (@ActorRole = 'BOD' AND [Status] = N'PRD đã duyệt')
                OR (@ActorRole != 'BOD' AND [Status] IN (N'Chờ phản hồi', N'PRD đã duyệt'))
            ))
            -- Tab Tra cứu yêu cầu (Thêm 'Hoàn thành' cho BOD)
            OR (ISNULL(@Tab, '') != 'tracking' AND (
                (@ActorRole != 'BOD')
                OR (@ActorRole = 'BOD' AND [Status] IN (N'PRD đã duyệt', N'BOD đã duyệt', N'BOD từ chối', N'Hoàn thành'))
            ))
        )
    ORDER BY lv.OriginalCreatedAt DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;

    -- Tổng số bản ghi
    WITH LatestVersions AS (
        SELECT [Project_id], ROW_NUMBER() OVER (PARTITION BY [ParentId] ORDER BY [Version] DESC) as rn
        FROM [dbo].[vw_SubmissionSummary]
    )
    SELECT COUNT(*) AS [TotalCount]
    FROM [dbo].[vw_SubmissionSummary] v
    INNER JOIN LatestVersions lv ON v.[Project_id] = lv.[Project_id] AND lv.rn = 1
    WHERE
        (
            (@ActorRole = 'User' AND v.[SubmitterMNV] = @ActorMNV)
            OR (@ActorRole != 'User')
        )
        AND (@SearchText = '' OR [CustomerName] LIKE '%' + @SearchText + '%'
                         OR [SubmitterName] LIKE '%' + @SearchText + '%'
                         OR v.[Project_id]   LIKE '%' + @SearchText + '%')
        AND (@Status = '' OR [Status] = @Status)
        AND (
            -- Tab Theo dõi yêu cầu
            (@Tab = 'tracking' AND (
                (@ActorRole = 'BOD' AND [Status] = N'PRD đã duyệt')
                OR (@ActorRole != 'BOD' AND [Status] IN (N'Chờ phản hồi', N'PRD đã duyệt'))
            ))
            -- Tab Tra cứu yêu cầu (Thêm 'Hoàn thành' cho BOD)
            OR (ISNULL(@Tab, '') != 'tracking' AND (
                (@ActorRole != 'BOD')
                OR (@ActorRole = 'BOD' AND [Status] IN (N'PRD đã duyệt', N'BOD đã duyệt', N'BOD từ chối', N'Hoàn thành'))
            ))
        );
END;
GO

-- ------------------------------------------------------------
-- Module: EmailTemplate (Mẫu Email chiến dịch)
-- ------------------------------------------------------------

-- A. usp_EmailTemplate_GetById (Cũ: usp_GetEmailTemplateById)
CREATE OR ALTER PROCEDURE [dbo].[usp_EmailTemplate_GetById]
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT *
    FROM [dbo].[CSR_EmailCampaignTemplates]
    WHERE [Id] = @Id;
END
GO

-- B. usp_EmailTemplate_List (Cũ: usp_GetEmailTemplates)
CREATE OR ALTER PROCEDURE [dbo].[usp_EmailTemplate_List]
    @Purpose      NVARCHAR(100) = NULL,
    @Location     NVARCHAR(100) = NULL,
    @Customer     NVARCHAR(200) = NULL,
    @IsActive     BIT = NULL,
    @SearchText   NVARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [Id], [Purpose], [TemplateName], [StartDate], [EndDate], [Location],
           [IsAllCustomer], [Customers], [SenderName], [SenderEmail],
           [RecipientName], [RecipientEmail], [EmailSubject], [EmailBody],
           [IsActive], [CreatedAt], [UpdatedAt]
    FROM [dbo].[CSR_EmailCampaignTemplates]
    WHERE (@Purpose IS NULL OR [Purpose] = @Purpose)
      AND (@Location IS NULL OR [Location] = @Location OR [Location] = '')
      AND (@IsActive IS NULL OR [IsActive] = @IsActive)
      AND (@SearchText IS NULL OR [TemplateName] LIKE '%' + @SearchText + '%')
      AND (
          @Customer IS NULL OR 
          [IsAllCustomer] = 1 OR 
          [Customers] LIKE '%' + @Customer + '%'
      )
    ORDER BY [CreatedAt] DESC;
END
GO

-- ------------------------------------------------------------
-- Module: TaskAttachment (File đính kèm)
-- ------------------------------------------------------------

-- A. usp_TaskAttachment_GetById (Cũ: usp_GetTaskAttachmentById)
CREATE OR ALTER PROCEDURE [dbo].[usp_TaskAttachment_GetById]
    @AttachmentId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [FilePath], [FileName] 
    FROM [dbo].[CSR_TaskAttachments] 
    WHERE [Id] = @AttachmentId;
END
GO

-- B. usp_TaskAttachment_ListByTaskId (Cũ: usp_GetTaskAttachments)
CREATE OR ALTER PROCEDURE [dbo].[usp_TaskAttachment_ListByTaskId]
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

-- ------------------------------------------------------------
-- Module: Dashboard (Bảng điều khiển)
-- ------------------------------------------------------------

-- A. usp_Dashboard_GetStats (Cũ: usp_GetDashboardV2)
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
    INNER JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[IsActive] = 1
    WHERE p.[RecordType] = 1 
      AND p.[Status] != N'Đã huỷ' 
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
    INNER JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[IsActive] = 1
    WHERE p.[RecordType] = 1 
      AND p.[Status] != N'Đã huỷ'
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
    INNER JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[IsActive] = 1
    WHERE p.[RecordType] = 1 
      AND p.[Status] = N'BOD đã duyệt'
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

    -- Thẻ 4: Các task gần tới deadline
    DECLARE @TasksNearDeadlineCount INT;
    SELECT @TasksNearDeadlineCount = COUNT(*)
    FROM [dbo].[CSR_Tasks] t
    INNER JOIN [dbo].[CSR_Projects] p ON p.[Project_id] = t.[Project_id]
    WHERE t.[IsActive] = 1
      AND t.[TaskStatus] != N'Hoàn thành'
      AND p.[Status] = N'BOD đã duyệt'
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

    -- 3. Lịch tiếp đón trong tháng hiện tại (Dataset 2)
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

    -- 4. Thông báo chờ phê duyệt (Dataset 3)
    SELECT DISTINCT TOP 20
        p.[Project_id] AS [ProjectId],
        p.[CustomerName],
        p.[Status] AS [Status],
        p.[CreatedAt],
        [OnboardDates] = STUFF((
            SELECT DISTINCT ', ' + CONVERT(NVARCHAR(10), t2.[OnboardDate], 103)
            FROM [dbo].[CSR_Tasks] t2
            WHERE t2.[Project_id] = p.[Project_id] AND t2.[IsActive] = 1
            FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'), 1, 2, '')
    FROM [dbo].[CSR_Projects] p
    WHERE p.[RecordType] = 1 
      AND p.[Status] IN (N'Chờ phản hồi', N'PRD đã duyệt', N'Đã gửi-Chờ phản hồi')
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
            WHEN t.[DeadlineDate] < CAST(GETDATE() AS DATE) THEN N'Delay'
            WHEN t.[TaskStatus] = N'Chưa bắt đầu' THEN N'Chưa bắt đầu'
            ELSE N'Đang xử lý'
        END AS [ComputedStatus]
    FROM [dbo].[CSR_Tasks] t
    INNER JOIN [dbo].[CSR_Projects] p ON t.[Project_id] = p.[Project_id]
    WHERE t.[IsActive] = 1
      AND p.[Status] IN (N'BOD đã duyệt', N'Hoàn thành')
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
