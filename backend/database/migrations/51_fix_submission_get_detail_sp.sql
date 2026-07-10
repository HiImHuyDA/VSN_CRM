USE CSR_DB;
GO

-- A. usp_Submission_GetDetail
CREATE OR ALTER PROCEDURE [dbo].[usp_Submission_GetDetail]
    @ProjectId NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

    -- Tự động cập nhật đơn này sang Hoàn thành nếu đủ điều kiện
    UPDATE p
    SET p.[StatusId] = 7, p.[UpdatedAt] = GETDATE() -- 7 is Hoàn thành
    FROM [dbo].[CSR_Projects] p
    WHERE p.[Project_id] = @ProjectId
      AND p.[StatusId] = 5 -- 5 is BOD đã duyệt
      AND p.[RecordType] = 1
      AND NOT EXISTS (
          SELECT 1 
          FROM [dbo].[CSR_Tasks] t
          WHERE t.[Project_id] = p.[Project_id]
            AND t.[StatusId] = 1
            AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)
      )
      AND EXISTS (
          SELECT 1 
          FROM [dbo].[CSR_Tasks] t
          WHERE t.[Project_id] = p.[Project_id]
            AND t.[StatusId] = 1
      );

    SELECT
        p.[Project_id], p.[Timestamp], p.[SubmitDate], p.[CustomerType], p.[CustomerName],
        p.[SubmitterEmail], p.[SubmitterName], p.[SubmitterMNV], p.[GuestRepName], p.[GuestReps],
        p.[GuestCount], p.[MeetingTopic], p.[Attendees], p.[AttendeesEmail],
        p.[AgendaInfo], p.[AgendaJsonData], p.[AgendaAttachUrl], s.TenTrangThai AS [Status], p.[CreatedAt], p.[UpdatedAt]
    FROM [dbo].[CSR_Projects] p
    INNER JOIN [dbo].[CSR_Statuses] s ON p.[StatusId] = s.[Id]
    WHERE p.[Project_id] = @ProjectId;

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

PRINT 'Fix for usp_Submission_GetDetail migration applied successfully!';
GO
