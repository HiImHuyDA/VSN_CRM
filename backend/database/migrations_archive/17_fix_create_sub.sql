USE CSR_DB;
GO

-- ============================================================
-- usp_CreateSubmission
-- Tạo đơn mới: sinh Project_id, tính Deadline cho mỗi task
-- Đây là SP quan trọng nhất - toàn bộ business logic tạo đơn
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_CreateSubmission]
    -- Thông tin chung
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
    -- Versioning Fields
    @ParentId           NVARCHAR(50)    = NULL,
    @RecordType         INT             = 1,
    @Version            INT             = 1
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;

    BEGIN TRY
        -- Kiểm tra trùng khách hàng + ngày tiếp đón nếu là tạo mới (RecordType = 1)
        IF @RecordType = 1
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM [dbo].[CSR_Projects] p
                JOIN [dbo].[CSR_Tasks] t ON p.[Project_id] = t.[Project_id]
                WHERE p.[CustomerName] = @CustomerName
                  AND p.[RecordType] != 3 -- Không tính đơn đã huỷ
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

        -- 1. Sinh Project_id
        DECLARE @ProjectId NVARCHAR(100);
        SET @ProjectId = [dbo].[fn_GenerateProjectId](@SubmitTimestamp, @CustomerName);

        -- Kiểm tra trùng (thêm suffix nếu trùng)
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
            [AgendaInfo], [AgendaJsonData], [AgendaAttachUrl], [Status]
        )
        VALUES (
            @ProjectId, @ParentId, @RecordType, @Version,
            @SubmitTimestamp, @SubmitDate, @CustomerType, @CustomerName,
            @SubmitterEmail, @SubmitterName, @SubmitterMNV, @GuestRepName, @GuestReps,
            @GuestCount, @MeetingTopic, @Attendees, @AttendeesEmail,
            @AgendaInfo, @AgendaJsonData, @AgendaAttachUrl, N'Chờ phản hồi'
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
            [MeetingStartTime], [MeetingEndTime], [CalendarEventId], [ContentType]
        )
        SELECT
            -- Task_id: sinh tự động trong SQL
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
            -- Tính Deadline bằng function SQL
            [dbo].[fn_CalculateDeadline](
                CAST([OnboardDate] AS DATE),
                ISNULL(CAST([LeadTime] AS INT), 1)
            ),
            -- Tính ReminderDate = Deadline - 1 ngày làm việc
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

        -- 5. Trả về Project_id để FE hiển thị xác nhận
        SELECT @ProjectId AS [Project_id], N'Đã tạo thành công' AS [Message];

    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        DECLARE @Err NVARCHAR(500) = ERROR_MESSAGE();
        THROW 50000, @Err, 1;
    END CATCH
END
GO
