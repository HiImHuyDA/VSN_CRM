-- ============================================================
-- usp_CreateSubmission
-- Tạo đơn mới: sinh Project_id dạng auto-increment (SEQUENCE)
-- ============================================================
ALTER PROCEDURE [dbo].[usp_CreateSubmission]
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
        IF @RecordType = 1
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM [dbo].[CSR_Projects] p
                JOIN [dbo].[CSR_Tasks] t ON p.[Project_id] = t.[Project_id]
                WHERE p.[CustomerName] = @CustomerName
                  AND p.[RecordType] != 3
                  AND p.[Status] NOT IN (N'PRD từ chối', N'BOD từ chối')
                  AND t.[OnboardDate] IN (
                      SELECT CAST(JSON_VALUE(value, '$.onboardDate') AS DATE)
                      FROM OPENJSON(@TasksJson)
                  )
            )
            BEGIN
                SELECT 'DUPLICATE' AS [Project_id], N'Khách hàng và Ngày tiếp đón đã tồn tại!' AS [Message];
                ROLLBACK TRANSACTION;
                RETURN;
            END
        END

        DECLARE @ProjectId NVARCHAR(100);
        
        -- Use the sequence for ID generation
        DECLARE @NextId INT = NEXT VALUE FOR [dbo].[seq_SubmissionId];
        SET @ProjectId = CAST(@NextId AS NVARCHAR(100));

        IF @ParentId IS NULL OR @ParentId = '' SET @ParentId = @ProjectId;

        DECLARE @SubmitDate DATE;
        SET @SubmitDate = CAST(
            DATEADD(HOUR, 7,
                DATEADD(SECOND, @SubmitTimestamp / 1000,
                    CAST('1970-01-01' AS DATETIME)))
        AS DATE);

        INSERT INTO [dbo].[CSR_Projects] (
            [Project_id], [ParentId], [RecordType], [Version],
            [Timestamp], [SubmitDate], [CustomerType], [CustomerName],
            [SubmitterEmail], [SubmitterName], [SubmitterMNV], [GuestRepName], [GuestReps],
            [GuestCount], [MeetingTopic], [Attendees], [AttendeesEmail],
            [AgendaInfo], [AgendaJsonData], [AgendaAttachUrl], [Status]
        )
        VALUES (
            @ProjectId, @ParentId, @RecordType, @Version,
            @SubmitTimestamp, @SubmitDate, @CustomerType, @CustomerName,
            @SubmitterEmail, @SubmitterName, @SubmitterMNV, @GuestRepName, @GuestReps,
            @GuestCount, @MeetingTopic, @Attendees, @AttendeesEmail,
            @AgendaInfo, @AgendaJsonData, @AgendaAttachUrl, N'Chờ phản hồi'
        );

        INSERT INTO [dbo].[CSR_Tasks] (
            [Task_id], [Project_id], [OnboardDate], [Destination],
            [TaskName], [TaskDetail], [Assignee], [AssigneeEmail],
            [Supervisor], [SupervisorEmail], [TaskAttendees], [TaskAttendeesEmail],
            [DeadlineDate], [ReminderDate],
            [Vehicle], [IncludeGuests], [PassengerCount], [FlightRoute], [ReturnDate],
            [MealOption], [MeetingRoom], [MeetingRoomEmail],
            [MeetingStartTime], [MeetingEndTime], [CalendarEventId], [ContentType]
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
            CAST(ISNULL([IncludeGuests], 0) AS BIT),
            [PassengerCount],
            [FlightRoute],
            CASE WHEN [ReturnDate] IS NOT NULL AND [ReturnDate] != ''
                 THEN CAST([ReturnDate] AS DATE) ELSE NULL END,
            [MealOption],
            [MeetingRoom],
            [MeetingRoomEmail],
            [MeetingStartTime],
            [MeetingEndTime],
            [CalendarEventId],
            [ContentType]
        FROM OPENJSON(@TasksJson)
        WITH (
            [OnboardDate]       NVARCHAR(20)    '$.onboardDate',
            [Destination]       NVARCHAR(100)   '$.destination',
            [TaskName]          NVARCHAR(200)   '$.taskName',
            [TaskDetail]        NVARCHAR(MAX)   '$.taskDetail',
            [Assignee]          NVARCHAR(200)   '$.assignee',
            [AssigneeEmail]     NVARCHAR(500)   '$.assigneeEmail',
            [Supervisor]        NVARCHAR(200)   '$.supervisor',
            [SupervisorEmail]   NVARCHAR(500)   '$.supervisorEmail',
            [TaskAttendees]     NVARCHAR(MAX)   '$.taskAttendees',
            [TaskAttendeesEmail] NVARCHAR(MAX)  '$.taskAttendeesEmail',
            [LeadTime]          NVARCHAR(10)    '$.leadTime',
            [Vehicle]           NVARCHAR(200)   '$.vehicle',
            [IncludeGuests]     NVARCHAR(5)     '$.includeGuests',
            [PassengerCount]    NVARCHAR(50)    '$.passengerCount',
            [FlightRoute]       NVARCHAR(200)   '$.flightRoute',
            [ReturnDate]        NVARCHAR(20)    '$.returnDate',
            [MealOption]        NVARCHAR(500)   '$.mealOption',
            [MeetingRoom]       NVARCHAR(200)   '$.meetingRoom',
            [MeetingRoomEmail]  NVARCHAR(200)   '$.meetingRoomEmail',
            [MeetingStartTime]  NVARCHAR(10)    '$.meetingStartTime',
            [MeetingEndTime]    NVARCHAR(10)    '$.meetingEndTime',
            [CalendarEventId]   NVARCHAR(200)   '$.calendarEventId',
            [ContentType]       NVARCHAR(200)   '$.contentType'
        );

        COMMIT TRANSACTION;
        SELECT @ProjectId AS [Project_id], N'Đã tạo thành công' AS [Message];
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        DECLARE @Err NVARCHAR(500) = ERROR_MESSAGE();
        THROW 50000, @Err, 1;
    END CATCH
END
