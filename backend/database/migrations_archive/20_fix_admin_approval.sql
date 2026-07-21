-- ============================================================
-- Script: 20_fix_admin_approval.sql
-- Fix bugs: Admin approval inferring wrong role, missing LeadTime and IncludeGuests in get submission.
-- ============================================================

-- 1. usp_RejectSubmission
CREATE OR ALTER PROCEDURE [dbo].[usp_RejectSubmission]
    @ProjectId      NVARCHAR(100),
    @ActorRole      NVARCHAR(50)    = NULL,
    @ActorMNV       NVARCHAR(50)    = NULL,
    @ActorName      NVARCHAR(200)   = NULL,
    @ActorEmail     NVARCHAR(200)   = NULL,
    @Reason         NVARCHAR(MAX)   = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        DECLARE @OldStatus NVARCHAR(50);
        SELECT @OldStatus = [Status] FROM [dbo].[CSR_Projects] WHERE [Project_id] = @ProjectId;

        IF @OldStatus IS NULL
            RAISERROR(N'Không tìm thấy đơn: %s', 16, 1, @ProjectId);

        IF @ActorRole = N'BOD' AND @OldStatus <> N'PRD đã duyệt'
            RAISERROR(N'BOD chỉ xử lý được đơn đã được PRD phê duyệt trước.', 16, 1);

        DECLARE @NewStatus NVARCHAR(50) = N'Từ chối';
        
        IF @ActorRole = N'PRD' OR (@ActorRole = N'Admin' AND @OldStatus = N'Chờ phản hồi')
            SET @NewStatus = N'PRD từ chối';
        ELSE IF @ActorRole = N'BOD' OR (@ActorRole = N'Admin' AND @OldStatus = N'PRD đã duyệt')
            SET @NewStatus = N'BOD từ chối';

        UPDATE [dbo].[CSR_Projects]
        SET [Status] = @NewStatus, [UpdatedAt] = GETDATE()
        WHERE [Project_id] = @ProjectId;

        INSERT INTO [dbo].[CSR_ApprovalLogs]
            ([ProjectId], [Action], [Role], [ActorMNV], [ActorName], [Reason], [OldStatus], [NewStatus])
        VALUES
            (@ProjectId, N'Reject', @ActorRole, @ActorMNV, @ActorName, @Reason, @OldStatus, @NewStatus);

        COMMIT TRANSACTION;
        SELECT @ProjectId AS [Project_id], @NewStatus AS [NewStatus],
               N'Đã từ chối đơn' AS [Message];
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        DECLARE @Err NVARCHAR(500) = ERROR_MESSAGE();
        RAISERROR(@Err, 16, 1);
    END CATCH
END
GO

-- 2. usp_ApproveSubmission
CREATE OR ALTER PROCEDURE [dbo].[usp_ApproveSubmission]
    @ProjectId      NVARCHAR(100),
    @ActorRole      NVARCHAR(50)    = NULL,
    @ActorMNV       NVARCHAR(50)    = NULL,
    @ActorName      NVARCHAR(200)   = NULL,
    @ActorEmail     NVARCHAR(200)   = NULL,
    @Note           NVARCHAR(MAX)   = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        DECLARE @OldStatus NVARCHAR(50);
        SELECT @OldStatus = [Status] FROM [dbo].[CSR_Projects] WHERE [Project_id] = @ProjectId;

        IF @OldStatus IS NULL
            RAISERROR(N'Không tìm thấy đơn: %s', 16, 1, @ProjectId);

        DECLARE @NewStatus NVARCHAR(50);

        IF @ActorRole = N'BOD' OR (@ActorRole = N'Admin' AND @OldStatus = N'PRD đã duyệt')
        BEGIN
            IF @OldStatus <> N'PRD đã duyệt'
                RAISERROR(N'Chỉ duyệt được đơn đã được PRD phê duyệt trước.', 16, 1);
            SET @NewStatus = N'BOD đã duyệt';
        END
        ELSE
        BEGIN
            SET @NewStatus = N'PRD đã duyệt';
        END

        UPDATE [dbo].[CSR_Projects]
        SET [Status] = @NewStatus, [UpdatedAt] = GETDATE()
        WHERE [Project_id] = @ProjectId;

        INSERT INTO [dbo].[CSR_ApprovalLogs]
            ([ProjectId], [Action], [Role], [ActorMNV], [ActorName], [Reason], [OldStatus], [NewStatus])
        VALUES
            (@ProjectId, N'Approve', @ActorRole, @ActorMNV, @ActorName, @Note, @OldStatus, @NewStatus);

        COMMIT TRANSACTION;
        SELECT @ProjectId AS [Project_id], @NewStatus AS [NewStatus],
               N'Đã phê duyệt thành công' AS [Message];
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        DECLARE @Err NVARCHAR(500) = ERROR_MESSAGE();
        RAISERROR(@Err, 16, 1);
    END CATCH
END
GO

-- 3. usp_GetSubmission (Add LeadTime and IncludeGuests)
CREATE OR ALTER PROCEDURE [dbo].[usp_GetSubmission]
    @ProjectId NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

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
END
GO

PRINT '=== SQL Fixes applied successfully ===';
GO
