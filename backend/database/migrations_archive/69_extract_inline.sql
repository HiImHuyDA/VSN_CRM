-- Migration 69: Bóc các câu INSERT/UPDATE/DELETE inline trong code JS (backend/src)
-- thành Stored Procedure riêng, để tách business/data logic ra khỏi code Node.js.
-- Các module JS liên quan sẽ được sửa để gọi các SP này thay vì .query() trực tiếp.
USE CSR_DB;
GO

-- 1. usp_InsertApprovalLog
-- Thay thế 2 chỗ INSERT INTO CSR_ApprovalLogs trong routes/submissions.js (route /cancel)
CREATE OR ALTER PROCEDURE [dbo].[usp_InsertApprovalLog]
    @ProjectId  NVARCHAR(100),
    @Action     NVARCHAR(50),
    @Role       NVARCHAR(50)    = NULL,
    @ActorMNV   NVARCHAR(50)    = NULL,
    @ActorName  NVARCHAR(200)   = NULL,
    @Reason     NVARCHAR(MAX)   = NULL,
    @OldStatus  NVARCHAR(50)    = NULL,
    @NewStatus  NVARCHAR(50)    = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO [dbo].[CSR_ApprovalLogs]
        ([ProjectId], [Action], [Role], [ActorMNV], [ActorName], [Reason], [OldStatus], [NewStatus])
    VALUES
        (@ProjectId, @Action, @Role, @ActorMNV, @ActorName, @Reason, @OldStatus, @NewStatus);
END
GO

-- 2. usp_UpdateTaskCalendarEventId
-- Thay thế 2 chỗ UPDATE CSR_Tasks SET CalendarEventId trong utils/approvalNotification.js
-- (1 chỗ set giá trị mới sau khi book phòng họp, 1 chỗ set NULL khi huỷ event)
CREATE OR ALTER PROCEDURE [dbo].[usp_UpdateTaskCalendarEventId]
    @TaskId            NVARCHAR(150),
    @CalendarEventId    NVARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE [dbo].[CSR_Tasks]
    SET [CalendarEventId] = @CalendarEventId
    WHERE [Task_id] = @TaskId;
END
GO

-- 3. usp_InsertScheduledEmail
-- Thay thế INSERT INTO CSR_ScheduledEmails trong utils/approvalNotification.js (scheduleApprovalEmail)
CREATE OR ALTER PROCEDURE [dbo].[usp_InsertScheduledEmail]
    @ProjectId  NVARCHAR(100),
    @ParentId   NVARCHAR(100),
    @EmailType  NVARCHAR(50),
    @SendAt     DATETIME
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO [dbo].[CSR_ScheduledEmails]
        ([ProjectId], [ParentId], [EmailType], [SendAt], [Status], [CreatedAt], [UpdatedAt])
    VALUES
        (@ProjectId, @ParentId, @EmailType, @SendAt, 'Pending', GETDATE(), GETDATE());
END
GO

-- 4. usp_CancelPendingScheduledEmails
-- Thay thế UPDATE CSR_ScheduledEmails ... WHERE Status='Pending' trong utils/approvalNotification.js
CREATE OR ALTER PROCEDURE [dbo].[usp_CancelPendingScheduledEmails]
    @ParentId NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE [dbo].[CSR_ScheduledEmails]
    SET [Status] = 'Cancelled', [UpdatedAt] = GETDATE()
    WHERE [ParentId] = @ParentId AND [Status] = 'Pending';
END
GO

-- 5. usp_UpdateScheduledEmailStatus
-- Thay thế 2 chỗ UPDATE CSR_ScheduledEmails (Sent/Failed) trong utils/scheduledEmailScheduler.js
-- @Status = 'Sent'   => tự set SentAt = GETDATE()
-- @Status = 'Failed' => ghi @ErrorMessage, không đụng SentAt
CREATE OR ALTER PROCEDURE [dbo].[usp_UpdateScheduledEmailStatus]
    @Id             INT,
    @Status         NVARCHAR(50),
    @ErrorMessage   NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF @Status = 'Sent'
    BEGIN
        UPDATE [dbo].[CSR_ScheduledEmails]
        SET [Status] = 'Sent', [SentAt] = GETDATE(), [UpdatedAt] = GETDATE()
        WHERE [Id] = @Id;
    END
    ELSE
    BEGIN
        UPDATE [dbo].[CSR_ScheduledEmails]
        SET [Status] = @Status, [ErrorMessage] = @ErrorMessage, [UpdatedAt] = GETDATE()
        WHERE [Id] = @Id;
    END
END
GO

-- 6. usp_InsertEmailCampaignLog
-- Thay thế 6 chỗ INSERT INTO CSR_EmailCampaignLogs trong utils/campaignScheduler.js
-- @TemplateId truyền 0 hoặc NULL đều được hiểu là NULL (tương đương NULLIF(@TemplateId,0) trong code cũ)
CREATE OR ALTER PROCEDURE [dbo].[usp_InsertEmailCampaignLog]
    @TemplateId     INT             = NULL,
    @ProjectId      NVARCHAR(100),
    @Status         NVARCHAR(50),
    @ErrorMessage   NVARCHAR(MAX)   = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO [dbo].[CSR_EmailCampaignLogs]
        ([TemplateId], [ProjectId], [Status], [ErrorMessage], [SentAt])
    VALUES
        (NULLIF(@TemplateId, 0), @ProjectId, @Status, @ErrorMessage, GETDATE());
END
GO

-- 7. usp_InsertFeedbackInvitation
-- Thay thế INSERT INTO CSR_FeedbackInvitations trong utils/feedbackScheduler.js
CREATE OR ALTER PROCEDURE [dbo].[usp_InsertFeedbackInvitation]
    @Token      NVARCHAR(128),
    @ProjectId  NVARCHAR(100),
    @VisitorId  INT,
    @ExpireDate DATETIME,
    @Status     NVARCHAR(50)    = 'Pending',
    @CreatedBy  NVARCHAR(100)   = 'SYSTEM'
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO [dbo].[CSR_FeedbackInvitations]
        ([Token], [ProjectId], [VisitorId], [ExpireDate], [Status], [CreatedBy])
    VALUES
        (@Token, @ProjectId, @VisitorId, @ExpireDate, @Status, @CreatedBy);
END
GO

-- 8. usp_InsertNotification
-- Thay thế INSERT INTO CSR_Notifications trong utils/notification.js
CREATE OR ALTER PROCEDURE [dbo].[usp_InsertNotification]
    @Message    NVARCHAR(MAX),
    @ActorMNV   NVARCHAR(50)    = NULL,
    @ProjectId  NVARCHAR(100)   = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO [dbo].[CSR_Notifications]
        ([Message], [ActorMNV], [ProjectId], [IsRead], [CreatedAt])
    VALUES
        (@Message, @ActorMNV, @ProjectId, 0, GETDATE());
END
GO

PRINT 'Migration 69: Created 8 stored procedures to replace inline INSERT/UPDATE statements in JS modules.';
GO