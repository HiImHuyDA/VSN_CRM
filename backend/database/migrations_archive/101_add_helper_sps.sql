-- 101_add_helper_sps.sql — Add Helper SPs to remove remaining inline SQL queries

-- 1. usp_EmailCampaign_GetUpcomingProjects
CREATE OR ALTER PROCEDURE usp_EmailCampaign_GetUpcomingProjects
    @TargetDate DATE
AS
BEGIN
    SET NOCOUNT ON;
    WITH EarliestOnboard AS (
        SELECT Project_id, MIN(OnboardDate) as MinOnboardDate
        FROM CSR_Tasks
        WHERE StatusId = 1
        GROUP BY Project_id
    )
    SELECT p.Project_id, p.CustomerName, p.CustomerType, p.SubmitterName, p.SubmitterEmail, p.MeetingTopic, p.GuestReps, eo.MinOnboardDate
    FROM CSR_Projects p
    JOIN EarliestOnboard eo ON p.Project_id = eo.Project_id
    WHERE p.StatusId IN (5, 7)
      AND eo.MinOnboardDate = @TargetDate;
END
GO

-- 2. usp_EmailCampaign_GetActiveTemplates
CREATE OR ALTER PROCEDURE usp_EmailCampaign_GetActiveTemplates
    @Today DATE
AS
BEGIN
    SET NOCOUNT ON;
    SELECT * FROM CSR_EmailCampaignTemplates
    WHERE StatusId = 1
      AND Purpose IN (N'Chào đón khách', N'Mời sự kiện')
      AND (StartDate IS NULL OR StartDate <= @Today)
      AND (EndDate IS NULL OR EndDate >= @Today);
END
GO

-- 3. usp_EmailCampaign_CheckLogSuccess
CREATE OR ALTER PROCEDURE usp_EmailCampaign_CheckLogSuccess
    @ProjectId NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 1 AS HasSent FROM CSR_EmailCampaignLogs WHERE ProjectId = @ProjectId AND Status = 'Success';
END
GO

-- 4. usp_EmailCampaign_GetProjectTasks
CREATE OR ALTER PROCEDURE usp_EmailCampaign_GetProjectTasks
    @ProjectId NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT Destination, OnboardDate, MeetingStartTime, MeetingEndTime, MeetingRoom, MealOption 
    FROM CSR_Tasks 
    WHERE Project_id = @ProjectId AND StatusId = 1 
    ORDER BY OnboardDate ASC;
END
GO

-- 5. usp_GetCustomerConfigReps
CREATE OR ALTER PROCEDURE usp_GetCustomerConfigReps
    @Category NVARCHAR(50),
    @Name     NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [Id], [JsonData], [Email], [StatusId]
    FROM [dbo].[CSR_ConfigLists]
    WHERE [Category] = @Category AND [Name] = @Name AND [StatusId] = 1;
END
GO

-- 6. usp_User_GetEmailsByRole
CREATE OR ALTER PROCEDURE usp_User_GetEmailsByRole
    @Role NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT Email FROM CSR_Users WHERE Role = @Role AND Email IS NOT NULL AND Email <> '';
END
GO

-- 7. usp_User_GetRoleAndDept
CREATE OR ALTER PROCEDURE usp_User_GetRoleAndDept
    @MNV NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT Role, Department FROM CSR_Users WHERE MNV = @MNV;
END
GO

-- 8. usp_Fleet_GetManagerEmailByMNV
CREATE OR ALTER PROCEDURE usp_Fleet_GetManagerEmailByMNV
    @MNV NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP 1 ManagerEmail FROM CSR_Employees WHERE MNV = @MNV AND StatusId = 1;
END
GO

-- 9. usp_Project_GetParentAndVersion
CREATE OR ALTER PROCEDURE usp_Project_GetParentAndVersion
    @ProjectId NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT ParentId, Version, CustomerType FROM CSR_Projects WHERE Project_id = @ProjectId;
END
GO

-- 10. usp_Location_GetNotificationEmails
CREATE OR ALTER PROCEDURE usp_Location_GetNotificationEmails
    @Name NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT NotificationEmails FROM CSR_Locations WHERE Name = @Name AND StatusId = 1;
END
GO

-- 11. usp_Project_GetAgendaJsonData
CREATE OR ALTER PROCEDURE usp_Project_GetAgendaJsonData
    @ProjectId NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT AgendaJsonData FROM CSR_Projects WHERE Project_id = @ProjectId;
END
GO

-- 12. usp_ScheduledEmail_GetPending
CREATE OR ALTER PROCEDURE usp_ScheduledEmail_GetPending
    @Now DATETIME
AS
BEGIN
    SET NOCOUNT ON;
    SELECT * FROM CSR_ScheduledEmails
    WHERE Status = 'Pending' AND SendAt <= @Now;
END
GO

-- 13. usp_BODApproval_GetPendingQueue
CREATE OR ALTER PROCEDURE usp_BODApproval_GetPendingQueue
AS
BEGIN
    SET NOCOUNT ON;
    WITH EarliestOnboard AS (
        SELECT Project_id, MIN(OnboardDate) as MinOnboardDate
        FROM CSR_Tasks
        WHERE StatusId = 1
        GROUP BY Project_id
    )
    SELECT p.Project_id, p.CustomerName, p.SubmitterName, p.SubmitterEmail, p.MeetingTopic, p.GuestCount, p.GuestReps,
           eo.MinOnboardDate
    FROM CSR_Projects p
    JOIN EarliestOnboard eo ON p.Project_id = eo.Project_id
    WHERE p.StatusId = 2;
END
GO

-- 14. usp_BODApproval_GetPRDPendingQueue
CREATE OR ALTER PROCEDURE usp_BODApproval_GetPRDPendingQueue
AS
BEGIN
    SET NOCOUNT ON;
    WITH EarliestOnboard AS (
        SELECT Project_id, MIN(OnboardDate) as MinOnboardDate
        FROM CSR_Tasks
        WHERE StatusId = 1
        GROUP BY Project_id
    )
    SELECT p.Project_id, p.CustomerName, p.SubmitterName, p.SubmitterEmail, p.MeetingTopic, p.GuestCount, p.GuestReps,
           eo.MinOnboardDate
    FROM CSR_Projects p
    JOIN EarliestOnboard eo ON p.Project_id = eo.Project_id
    WHERE p.StatusId = 3;
END
GO
