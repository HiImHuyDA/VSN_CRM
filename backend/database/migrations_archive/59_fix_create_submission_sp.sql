USE CSR_DB;
GO

-- Cập nhật stored procedure usp_CreateSubmission để cấu hình khớp chính xác camelCase JSON path từ Frontend
CREATE OR ALTER PROCEDURE [dbo].[usp_CreateSubmission]
    @SubmitTimestamp    BIGINT,
    @CustomerType       NVARCHAR(20),
    @CustomerName       NVARCHAR(200),
    @SubmitterEmail     NVARCHAR(200),
    @SubmitterName      NVARCHAR(200),
    @SubmitterMNV       NVARCHAR(50)    = NULL,
    @GuestRepName       NVARCHAR(500)   = NULL,
    @GuestReps          NVARCHAR(MAX)   = NULL,
    @GuestCount         NVARCHAR(50)    = NULL,
    @MeetingTopic       NVARCHAR(500)   = NULL,
    @Attendees          NVARCHAR(MAX)   = NULL,
    @AttendeesEmail     NVARCHAR(MAX)   = NULL,
    @AgendaInfo         NVARCHAR(MAX)   = NULL,
    @AgendaJsonData     NVARCHAR(MAX)   = NULL,
    @AgendaAttachUrl    NVARCHAR(1000)  = NULL,
    @TasksJson          NVARCHAR(MAX),
    @ParentId           NVARCHAR(50)    = NULL,
    @RecordType         INT             = 1,
    @Version            INT             = 1
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;

    BEGIN TRY
        -- 0. Kiểm tra trùng
        IF @RecordType = 1 AND @Version = 1
        BEGIN
            IF EXISTS (
                SELECT 1 FROM [dbo].[CSR_Projects]
                WHERE [CustomerName] = @CustomerName
                  AND [SubmitDate] = CAST(
                      DATEADD(HOUR, 7,
                          DATEADD(SECOND, @SubmitTimestamp / 1000,
                              CAST('1970-01-01' AS DATETIME)))
                  AS DATE)
                  AND [StatusId] NOT IN (6, 9)
            )
            BEGIN
                SELECT 'DUPLICATE' AS [Project_id], N'Khách hàng và Ngày tiếp đón đã tồn tại!' AS [Message];
                ROLLBACK TRANSACTION;
                RETURN;
            END
        END

        -- 1. Sinh Project_id
        DECLARE @ProjectId NVARCHAR(100);
        SET @ProjectId = [dbo].[fn_GenerateProjectId](@SubmitTimestamp, @CustomerName);

        IF EXISTS (SELECT 1 FROM [dbo].[CSR_Projects] WHERE [Project_id] = @ProjectId)
        BEGIN
            SET @ProjectId = @ProjectId + '_' + RIGHT(CAST(@SubmitTimestamp AS NVARCHAR(20)), 4);
        END

        IF @ParentId IS NULL OR @ParentId = '' SET @ParentId = @ProjectId;

        -- 2. Lấy SubmitDate từ timestamp
        DECLARE @SubmitDate DATE;
        SET @SubmitDate = CAST(
            DATEADD(HOUR, 7,
                DATEADD(SECOND, @SubmitTimestamp / 1000,
                    CAST('1970-01-01' AS DATETIME)))
        AS DATE);

        -- 3. Insert vào CSR_Projects
        INSERT INTO [dbo].[CSR_Projects] (
            [Project_id], [ParentId], [RecordType], [Version],
            [Timestamp], [SubmitDate], [CustomerType], [CustomerName],
            [SubmitterEmail], [SubmitterName], [SubmitterMNV], [GuestRepName], [GuestReps],
            [GuestCount], [MeetingTopic], [Attendees], [AttendeesEmail],
            [AgendaInfo], [AgendaJsonData], [AgendaAttachUrl], [StatusId]
        )
        VALUES (
            @ProjectId, @ParentId, @RecordType, @Version,
            @SubmitTimestamp, @SubmitDate, @CustomerType, @CustomerName,
            @SubmitterEmail, @SubmitterName, @SubmitterMNV, @GuestRepName, @GuestReps,
            @GuestCount, @MeetingTopic, @Attendees, @AttendeesEmail,
            @AgendaInfo, @AgendaJsonData, @AgendaAttachUrl, 8 -- 8 is Chờ phản hồi
        );

        -- 4. Parse Tasks từ JSON và insert
        DECLARE @TaskIndex INT = 1;

        INSERT INTO [dbo].[CSR_Tasks] (
            [Task_id], [Project_id], [OnboardDate], [Destination],
            [TaskName], [TaskDetail], [Assignee], [AssigneeEmail],
            [Supervisor], [SupervisorEmail], [TaskAttendees], [TaskAttendeesEmail],
            [DeadlineDate], [ReminderDate],
            [Vehicle], [IncludeGuests], [PassengerCount], [FlightRoute], [ReturnDate],
            [MealOption], [MeetingRoom], [MeetingRoomEmail],
            [MeetingStartTime], [MeetingEndTime], [CalendarEventId], [ContentType], [StatusId]
        )
        SELECT
            [dbo].[fn_GenerateTaskId](@ProjectId, [Destination], ROW_NUMBER()
                OVER (ORDER BY [OnboardDate], [Destination], [TaskName])),
            @ProjectId,
            CAST([OnboardDate] AS DATE),
            [Destination],
            [TaskName],
            [TaskDetail],
            [Assignee],
            [AssigneeEmail],
            [Supervisor],
            [SupervisorEmail],
            [TaskAttendees],
            [TaskAttendeesEmail],
            [dbo].[fn_CalculateDeadline](
                CAST([OnboardDate] AS DATE),
                ISNULL(CAST([LeadTime] AS INT), 1)
            ),
            [dbo].[fn_GetReminderDate](
                [dbo].[fn_CalculateDeadline](
                    CAST([OnboardDate] AS DATE),
                    ISNULL(CAST([LeadTime] AS INT), 1)
                )
            ),
            [Vehicle],
            CASE WHEN [IncludeGuests] = 'true' OR [IncludeGuests] = '1' THEN 1 ELSE 0 END,
            [PassengerCount],
            [FlightRoute],
            CASE WHEN [ReturnDate] = '' THEN NULL ELSE CAST([ReturnDate] AS DATE) END,
            [MealOption],
            [MeetingRoom],
            [MeetingRoomEmail],
            [MeetingStartTime],
            [MeetingEndTime],
            [CalendarEventId],
            [ContentType],
            1 -- 1 is Hoạt động
        FROM OPENJSON(@TasksJson)
        WITH (
            [OnboardDate]           NVARCHAR(50)  '$.onboardDate',
            [Destination]           NVARCHAR(100) '$.destination',
            [TaskName]              NVARCHAR(200) '$.taskName',
            [TaskDetail]            NVARCHAR(MAX) '$.taskDetail',
            [Assignee]              NVARCHAR(200) '$.assignee',
            [AssigneeEmail]         NVARCHAR(500) '$.assigneeEmail',
            [Supervisor]            NVARCHAR(200) '$.supervisor',
            [SupervisorEmail]       NVARCHAR(500) '$.supervisorEmail',
            [TaskAttendees]         NVARCHAR(MAX) '$.taskAttendees',
            [TaskAttendeesEmail]    NVARCHAR(MAX) '$.taskAttendeesEmail',
            [LeadTime]              INT           '$.leadTime',
            [Vehicle]               NVARCHAR(200) '$.vehicle',
            [IncludeGuests]         NVARCHAR(10)  '$.includeGuests',
            [PassengerCount]        NVARCHAR(50)  '$.passengerCount',
            [FlightRoute]           NVARCHAR(200) '$.flightRoute',
            [ReturnDate]            NVARCHAR(50)  '$.returnDate',
            [MealOption]            NVARCHAR(500) '$.mealOption',
            [MeetingRoom]           NVARCHAR(200) '$.meetingRoom',
            [MeetingRoomEmail]      NVARCHAR(200) '$.meetingRoomEmail',
            [MeetingStartTime]      NVARCHAR(10)  '$.meetingStartTime',
            [MeetingEndTime]        NVARCHAR(10)  '$.meetingEndTime',
            [CalendarEventId]       NVARCHAR(200) '$.calendarEventId',
            [ContentType]           NVARCHAR(200) '$.contentType'
        );

        COMMIT TRANSACTION;
        SELECT @ProjectId AS [Project_id], N'SUCCESS' AS [Message];
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        SELECT 'ERROR' AS [Project_id], @ErrMsg AS [Message];
    END CATCH
END;
GO

PRINT 'Fix for usp_CreateSubmission SP (added camelCase JSON mappings) applied successfully!';
GO
