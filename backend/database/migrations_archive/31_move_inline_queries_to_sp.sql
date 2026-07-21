-- ============================================================
-- 31_move_inline_queries_to_sp.sql
-- Chuyển toàn bộ inline query trong Node.js routes thành SP
-- Áp dụng quy tắc: không được viết query inline trong code backend
-- ============================================================
USE CSR_DB;
GO

-- ============================================================
-- 1. submissions.js — inline queries
-- ============================================================

-- 1a. GET /submissions/:projectId/history — lấy ParentId
CREATE OR ALTER PROCEDURE [dbo].[usp_GetProjectParentId]
    @ProjectId NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT ISNULL([ParentId], @ProjectId) AS [ParentId]
    FROM [dbo].[CSR_Projects]
    WHERE [Project_id] = @ProjectId;
END
GO

-- 1b. GET /submissions/:projectId/history — lấy toàn bộ lịch sử theo ParentId
CREATE OR ALTER PROCEDURE [dbo].[usp_GetProjectHistory]
    @ParentId NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        p.[Project_id],
        p.[RecordType],
        p.[Version],
        p.[Status],
        p.[CreatedAt],
        p.[UpdatedAt],
        p.[MeetingTopic],
        p.[SubmitterName],
        p.[CustomerName]
    FROM [dbo].[CSR_Projects] p
    WHERE p.[ParentId] = @ParentId
    ORDER BY p.[Version] DESC;
END
GO

-- 1c. PUT /submissions/:projectId — lấy thông tin gốc để edit
CREATE OR ALTER PROCEDURE [dbo].[usp_GetProjectForEdit]
    @ProjectId NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        [Status],
        [ParentId],
        [Version],
        [SubmitterName],
        [SubmitterEmail],
        [SubmitterMNV],
        [CustomerType],
        [CustomerName]
    FROM [dbo].[CSR_Projects]
    WHERE [Project_id] = @ProjectId;
END
GO

-- 1d. POST /submissions/:projectId/cancel — lấy status trước khi huỷ
CREATE OR ALTER PROCEDURE [dbo].[usp_GetProjectStatus]
    @ProjectId NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [Status]
    FROM [dbo].[CSR_Projects]
    WHERE [Project_id] = @ProjectId;
END
GO

-- 1e. POST /submissions/:projectId/approve — lấy thông tin gửi Teams card (khi PRD duyệt)
CREATE OR ALTER PROCEDURE [dbo].[usp_GetProjectForTeams]
    @ProjectId NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [Project_id], [SubmitterName], [CustomerName], [MeetingTopic]
    FROM [dbo].[CSR_Projects]
    WHERE [Project_id] = @ProjectId;
END
GO

-- 1f. syncNewCustomerReps — lấy info dự án để sync
CREATE OR ALTER PROCEDURE [dbo].[usp_GetProjectForSync]
    @ProjectId NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [CustomerType], [CustomerName], [GuestReps]
    FROM [dbo].[CSR_Projects]
    WHERE [Project_id] = @ProjectId;
END
GO

-- 1g. syncNewCustomerReps — lấy danh sách đại diện khách hàng từ config
CREATE OR ALTER PROCEDURE [dbo].[usp_GetCustomerConfigReps]
    @Category NVARCHAR(50),
    @Name     NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [Id], [JsonData], [IsActive]
    FROM [dbo].[CSR_ConfigLists]
    WHERE [Category] = @Category AND [Name] = @Name;
END
GO

-- 1h. syncNewCustomerReps — insert customer reps mới vào config
CREATE OR ALTER PROCEDURE [dbo].[usp_InsertCustomerConfigReps]
    @Category NVARCHAR(50),
    @Name     NVARCHAR(200),
    @JsonData NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO [dbo].[CSR_ConfigLists] ([Category], [Name], [JsonData], [IsActive])
    VALUES (@Category, @Name, @JsonData, 1);
END
GO

-- 1i. syncNewCustomerReps — cập nhật customer reps trong config
CREATE OR ALTER PROCEDURE [dbo].[usp_UpdateCustomerConfigReps]
    @Id       INT,
    @JsonData NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE [dbo].[CSR_ConfigLists]
    SET [JsonData] = @JsonData
    WHERE [Id] = @Id;
END
GO

-- ============================================================
-- 2. dashboard.js — 1 inline query lớn
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_GetDashboard]
    @ActorRole NVARCHAR(50) = '',
    @ActorMNV  NVARCHAR(50) = ''
AS
BEGIN
    SET NOCOUNT ON;

    -- Tự động cập nhật trạng thái Hoàn thành
    UPDATE p SET p.[Status] = N'Hoàn thành', p.[UpdatedAt] = GETDATE()
    FROM [dbo].[CSR_Projects] p
    WHERE p.[Status] = N'BOD đã duyệt' AND p.[RecordType] = 1
      AND NOT EXISTS (
          SELECT 1 FROM [dbo].[CSR_Tasks] t
          WHERE t.[Project_id] = p.[Project_id] AND t.[IsActive] = 1
            AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)
      )
      AND EXISTS (SELECT 1 FROM [dbo].[CSR_Tasks] t WHERE t.[Project_id] = p.[Project_id] AND t.[IsActive] = 1);

    -- 1. Upcoming trips: đơn có onboard date trong 14 ngày tới
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

    -- 2. Pending tasks: task deadline còn trong 7 ngày
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

    -- 3. Overdue tasks: task quá deadline
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
      AND p.[Status] IN (N'BOD đã duyệt', N'PRD đã duyệt', N'Chờ phản hồi')
      AND (
          @ActorRole != 'User'
          OR t.[AssigneeEmail] IN (SELECT Email FROM CSR_Employees WHERE MNV = @ActorMNV)
          OR t.[SupervisorEmail] IN (SELECT Email FROM CSR_Employees WHERE MNV = @ActorMNV)
      )
    ORDER BY t.[DeadlineDate] ASC;

    -- 4. Recently completed: đơn hoàn thành trong 30 ngày
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

    -- 5. Stats tổng hợp
    SELECT
      (SELECT COUNT(*) FROM [dbo].[CSR_Projects] WHERE [Status] = N'Chờ phản hồi' AND [RecordType]=1) AS PendingApproval,
      (SELECT COUNT(*) FROM [dbo].[CSR_Projects] WHERE [Status] = N'BOD đã duyệt' AND [RecordType]=1) AS Approved,
      (SELECT COUNT(*) FROM [dbo].[CSR_Projects] WHERE [Status] = N'Hoàn thành' AND [RecordType]=1
          AND [UpdatedAt] >= DATEADD(DAY, -30, GETDATE())) AS CompletedThisMonth,
      (SELECT COUNT(*) FROM [dbo].[CSR_Tasks] t
          INNER JOIN [dbo].[CSR_Projects] p ON p.[Project_id] = t.[Project_id]
          WHERE t.[IsActive]=1 AND t.[DeadlineDate] < CAST(GETDATE() AS DATE)
            AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)
            AND p.[Status] IN (N'BOD đã duyệt', N'PRD đã duyệt', N'Chờ phản hồi')) AS OverdueTasks,
      (SELECT COUNT(*) FROM [dbo].[CSR_Projects] p
          INNER JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[IsActive] = 1
          WHERE p.[Status] IN (N'BOD đã duyệt', N'Hoàn thành', N'PRD đã duyệt', N'Chờ phản hồi')
            AND p.[RecordType] = 1
            AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)
            AND t.[OnboardDate] <= DATEADD(DAY, 7, CAST(GETDATE() AS DATE))) AS UpcomingWeek;
END
GO

-- ============================================================
-- 3. reports.js — 1 inline query lớn
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_GetReportsSummary]
    @Year INT
AS
BEGIN
    SET NOCOUNT ON;

    -- 1. Số đơn theo tháng trong năm
    SELECT
      MONTH(p.[CreatedAt]) AS [Month],
      COUNT(*) AS [Total],
      SUM(CASE WHEN p.[Status] = N'Hoàn thành' THEN 1 ELSE 0 END) AS [Completed],
      SUM(CASE WHEN p.[Status] IN (N'BOD đã duyệt') THEN 1 ELSE 0 END) AS [Approved],
      SUM(CASE WHEN p.[Status] IN (N'Chờ phản hồi', N'PRD đã duyệt') THEN 1 ELSE 0 END) AS [Pending],
      SUM(CASE WHEN p.[Status] IN (N'PRD từ chối', N'BOD từ chối', N'Đã huỷ') THEN 1 ELSE 0 END) AS [Rejected]
    FROM [dbo].[CSR_Projects] p
    WHERE YEAR(p.[CreatedAt]) = @Year AND p.[RecordType] = 1
    GROUP BY MONTH(p.[CreatedAt])
    ORDER BY [Month] ASC;

    -- 2. Phân bổ theo trạng thái (tổng tất cả)
    SELECT p.[Status], COUNT(*) AS [Count]
    FROM [dbo].[CSR_Projects] p
    WHERE p.[RecordType] = 1
    GROUP BY p.[Status]
    ORDER BY [Count] DESC;

    -- 3. Phân bổ theo địa điểm
    SELECT t.[Destination], COUNT(DISTINCT p.[Project_id]) AS [ProjectCount]
    FROM [dbo].[CSR_Tasks] t
    INNER JOIN [dbo].[CSR_Projects] p ON p.[Project_id] = t.[Project_id]
    WHERE t.[IsActive] = 1 AND p.[RecordType] = 1
      AND YEAR(p.[CreatedAt]) = @Year
    GROUP BY t.[Destination]
    ORDER BY [ProjectCount] DESC;

    -- 4. Top 10 khách hàng
    SELECT TOP 10 p.[CustomerName], p.[CustomerType], COUNT(*) AS [VisitCount]
    FROM [dbo].[CSR_Projects] p
    WHERE p.[RecordType] = 1 AND p.[Status] != N'Đã huỷ'
    GROUP BY p.[CustomerName], p.[CustomerType]
    ORDER BY [VisitCount] DESC;

    -- 5. KPI tổng hợp
    SELECT
      (SELECT COUNT(*) FROM [dbo].[CSR_Projects] WHERE [RecordType]=1) AS TotalAll,
      (SELECT COUNT(*) FROM [dbo].[CSR_Projects] WHERE [RecordType]=1 AND YEAR([CreatedAt])=@Year) AS TotalYear,
      (SELECT COUNT(*) FROM [dbo].[CSR_Projects] WHERE [RecordType]=1 AND [Status]=N'Hoàn thành' AND YEAR([CreatedAt])=@Year) AS CompletedYear,
      (SELECT COUNT(*) FROM [dbo].[CSR_Projects] WHERE [RecordType]=1 AND [Status] IN (N'Chờ phản hồi', N'PRD đã duyệt')) AS ActiveNow,
      (SELECT COUNT(DISTINCT [CustomerName]) FROM [dbo].[CSR_Projects] WHERE [RecordType]=1) AS UniqueCustomers,
      (SELECT COUNT(*) FROM [dbo].[CSR_Projects] WHERE [RecordType]=1 AND MONTH([CreatedAt])=MONTH(GETDATE()) AND YEAR([CreatedAt])=YEAR(GETDATE())) AS ThisMonth;

    -- 6. Danh sách năm có dữ liệu
    SELECT DISTINCT YEAR([CreatedAt]) AS [Year]
    FROM [dbo].[CSR_Projects]
    WHERE [RecordType] = 1
    ORDER BY [Year] DESC;
END
GO

-- ============================================================
-- 4. guest-calendar.js — 1 inline query
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_GetGuestCalendar]
    @StartDate NVARCHAR(10),
    @EndDate   NVARCHAR(10)
AS
BEGIN
    SET NOCOUNT ON;

    -- Tự động cập nhật trạng thái Hoàn thành trước khi truy vấn
    UPDATE p
    SET p.[Status] = N'Hoàn thành', p.[UpdatedAt] = GETDATE()
    FROM [dbo].[CSR_Projects] p
    WHERE p.[Status] = N'BOD đã duyệt'
      AND p.[RecordType] = 1
      AND NOT EXISTS (
          SELECT 1 FROM [dbo].[CSR_Tasks] t
          WHERE t.[Project_id] = p.[Project_id] AND t.[IsActive] = 1
            AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)
      )
      AND EXISTS (
          SELECT 1 FROM [dbo].[CSR_Tasks] t
          WHERE t.[Project_id] = p.[Project_id] AND t.[IsActive] = 1
      );

    -- Lấy các đơn ACTIVE trong tháng, trả chuỗi yyyy-MM-dd để tránh timezone shift
    SELECT DISTINCT
      p.[Project_id],
      p.[CustomerName],
      p.[CustomerType],
      p.[MeetingTopic],
      p.[SubmitterName],
      p.[Status],
      p.[CreatedAt],
      CONVERT(NVARCHAR(10), t.[OnboardDate], 23) AS OnboardDate,
      t.[Destination]
    FROM [dbo].[CSR_Projects] p
    INNER JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id]
    WHERE p.[Status] IN (N'Chờ phản hồi', N'PRD đã duyệt', N'BOD đã duyệt', N'Hoàn thành')
      AND p.[RecordType] = 1
      AND CONVERT(NVARCHAR(10), t.[OnboardDate], 23) >= @StartDate
      AND CONVERT(NVARCHAR(10), t.[OnboardDate], 23) <= @EndDate
    ORDER BY CONVERT(NVARCHAR(10), t.[OnboardDate], 23) ASC, p.[Project_id] ASC;
END
GO

-- ============================================================
-- 5. emailCampaigns.js — 2 inline queries
-- ============================================================

-- 5a. GET /email-campaigns/:id — lấy chi tiết 1 template theo Id
CREATE OR ALTER PROCEDURE [dbo].[usp_GetEmailTemplateById]
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT *
    FROM [dbo].[CSR_EmailCampaignTemplates]
    WHERE [Id] = @Id;
END
GO

-- 5b. DELETE /email-campaigns/:id
CREATE OR ALTER PROCEDURE [dbo].[usp_DeleteEmailTemplate]
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM [dbo].[CSR_EmailCampaignTemplates]
    WHERE [Id] = @Id;
END
GO

-- ============================================================
-- 6. notifications.js — 2 inline queries
-- ============================================================

-- 6a. GET /notifications
CREATE OR ALTER PROCEDURE [dbo].[usp_GetNotifications]
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP 50 *
    FROM [dbo].[CSR_Notifications]
    ORDER BY [CreatedAt] DESC;
END
GO

-- 6b. PUT /notifications/mark-read
CREATE OR ALTER PROCEDURE [dbo].[usp_MarkNotificationsRead]
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE [dbo].[CSR_Notifications]
    SET [IsRead] = 1
    WHERE [IsRead] = 0;
END
GO

PRINT '=== Migration 31: All inline queries moved to Stored Procedures ==='
GO
