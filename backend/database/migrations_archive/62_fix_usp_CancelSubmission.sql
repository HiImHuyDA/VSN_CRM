USE CSR_DB;
GO

-- Cập nhật stored procedure usp_CancelSubmission để sử dụng StatusId (CSR_Projects) và StatusId (CSR_Tasks) tương thích với cấu trúc DB mới
CREATE OR ALTER PROCEDURE [dbo].[usp_CancelSubmission]
    @ProjectId          NVARCHAR(100),
    @SubmitterMNV       NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;

    BEGIN TRY
        -- 1. Lấy thông tin bản ghi hiện tại
        DECLARE @ParentId NVARCHAR(50), @Version INT;
        
        SELECT TOP 1 
            @ParentId = [ParentId], 
            @Version = [Version]
        FROM [dbo].[CSR_Projects]
        WHERE [Project_id] = @ProjectId;

        IF @ParentId IS NULL
        BEGIN
            SELECT 'ERROR' AS [Project_id], N'Không tìm thấy đơn yêu cầu!' AS [Message];
            ROLLBACK TRANSACTION;
            RETURN;
        END

        -- 2. Sinh Project_id mới
        DECLARE @NewProjectId NVARCHAR(100);
        SET @NewProjectId = @ProjectId + '_C'; -- Thêm suffix để phân biệt

        -- Nếu _C đã tồn tại, dùng timestamp
        IF EXISTS (SELECT 1 FROM [dbo].[CSR_Projects] WHERE [Project_id] = @NewProjectId)
        BEGIN
            SET @NewProjectId = @ProjectId + '_C' + RIGHT(CAST(DATEDIFF(s, '1970-01-01', GETDATE()) AS NVARCHAR(20)), 4);
        END

        -- 3. Copy dữ liệu cũ thành RecordType = 3, StatusId = 9 (Đã huỷ)
        INSERT INTO [dbo].[CSR_Projects] (
            [Project_id], [ParentId], [RecordType], [Version],
            [Timestamp], [SubmitDate], [CustomerType], [CustomerName],
            [SubmitterEmail], [SubmitterName], [SubmitterMNV], [GuestRepName], [GuestReps],
            [GuestCount], [MeetingTopic], [Attendees], [AttendeesEmail],
            [AgendaInfo], [AgendaJsonData], [AgendaAttachUrl], [StatusId]
        )
        SELECT 
            @NewProjectId, [ParentId], 3, [Version] + 1,
            [Timestamp], [SubmitDate], [CustomerType], [CustomerName],
            [SubmitterEmail], [SubmitterName], ISNULL(@SubmitterMNV, [SubmitterMNV]), [GuestRepName], [GuestReps],
            [GuestCount], [MeetingTopic], [Attendees], [AttendeesEmail],
            [AgendaInfo], [AgendaJsonData], [AgendaAttachUrl], 9 -- 9 là Đã huỷ
        FROM [dbo].[CSR_Projects]
        WHERE [Project_id] = @ProjectId;

        -- 4. Copy Tasks với StatusId = 2 (Dừng/Huỷ)
        INSERT INTO [dbo].[CSR_Tasks] (
            [Task_id], [Project_id], [OnboardDate], [Destination],
            [TaskName], [TaskDetail], [Assignee], [AssigneeEmail],
            [Supervisor], [SupervisorEmail], [TaskAttendees], [TaskAttendeesEmail],
            [DeadlineDate], [ReminderDate],
            [Vehicle], [IncludeGuests], [PassengerCount], [FlightRoute], [ReturnDate],
            [MealOption], [MeetingRoom], [MeetingRoomEmail],
            [MeetingStartTime], [MeetingEndTime], [CalendarEventId], [ContentType],
            [StatusId]
        )
        SELECT 
            REPLACE([Task_id], @ProjectId, @NewProjectId), @NewProjectId, [OnboardDate], [Destination],
            [TaskName], [TaskDetail], [Assignee], [AssigneeEmail],
            [Supervisor], [SupervisorEmail], [TaskAttendees], [TaskAttendeesEmail],
            [DeadlineDate], [ReminderDate],
            [Vehicle], [IncludeGuests], [PassengerCount], [FlightRoute], [ReturnDate],
            [MealOption], [MeetingRoom], [MeetingRoomEmail],
            [MeetingStartTime], [MeetingEndTime], [CalendarEventId], [ContentType],
            2 -- 2 là Dừng/Huỷ
        FROM [dbo].[CSR_Tasks]
        WHERE [Project_id] = @ProjectId;

        COMMIT TRANSACTION;

        SELECT @NewProjectId AS [Project_id], N'Đã hủy đơn thành công' AS [Message];

    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        DECLARE @Err NVARCHAR(500) = ERROR_MESSAGE();
        THROW 50000, @Err, 1;
    END CATCH
END
GO
