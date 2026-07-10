USE CSR_DB;
GO

-- ============================================================
-- 1. Cập nhật usp_CreateSubmission
-- Hỗ trợ chỉnh sửa và gán lại Project_id cho các task cũ đã có
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

        -- 4. Parse Tasks từ JSON và cập nhật / chèn mới
        DECLARE @TempTasks TABLE (
            [JsonIndex]         INT IDENTITY(1,1),
            [TaskId]            NVARCHAR(150),
            [OnboardDate]       DATE,
            [Destination]       NVARCHAR(100),
            [TaskName]          NVARCHAR(200),
            [TaskDetail]        NVARCHAR(MAX),
            [Assignee]          NVARCHAR(200),
            [AssigneeEmail]     NVARCHAR(500),
            [Supervisor]        NVARCHAR(200),
            [SupervisorEmail]   NVARCHAR(500),
            [TaskAttendees]     NVARCHAR(MAX),
            [TaskAttendeesEmail] NVARCHAR(MAX),
            [LeadTime]          INT,
            [Vehicle]           NVARCHAR(200),
            [IncludeGuests]     BIT,
            [PassengerCount]    NVARCHAR(50),
            [FlightRoute]       NVARCHAR(200),
            [ReturnDate]        DATE,
            [MealOption]        NVARCHAR(500),
            [MeetingRoom]       NVARCHAR(200),
            [MeetingRoomEmail]  NVARCHAR(200),
            [MeetingStartTime]  NVARCHAR(10),
            [MeetingEndTime]    NVARCHAR(10),
            [CalendarEventId]   NVARCHAR(200),
            [ContentType]       NVARCHAR(200)
        );

        INSERT INTO @TempTasks (
            [TaskId], [OnboardDate], [Destination], [TaskName], [TaskDetail],
            [Assignee], [AssigneeEmail], [Supervisor], [SupervisorEmail],
            [TaskAttendees], [TaskAttendeesEmail], [LeadTime],
            [Vehicle], [IncludeGuests], [PassengerCount], [FlightRoute], [ReturnDate],
            [MealOption], [MeetingRoom], [MeetingRoomEmail],
            [MeetingStartTime], [MeetingEndTime], [CalendarEventId], [ContentType]
        )
        SELECT
            [TaskId],
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
            ISNULL(CAST([LeadTime] AS INT), 1),
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
            [TaskId]            NVARCHAR(150)   '$.taskId',
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

        -- A. Cập nhật các task cũ có trong đơn chỉnh sửa: chuyển sang Project_id mới và cập nhật thông tin
        UPDATE t
        SET 
            t.[Project_id]          = @ProjectId,
            t.[OnboardDate]         = temp.[OnboardDate],
            t.[Destination]         = temp.[Destination],
            t.[TaskName]            = temp.[TaskName],
            t.[TaskDetail]          = temp.[TaskDetail],
            t.[Assignee]            = temp.[Assignee],
            t.[AssigneeEmail]       = temp.[AssigneeEmail],
            t.[Supervisor]          = temp.[Supervisor],
            t.[SupervisorEmail]     = temp.[SupervisorEmail],
            t.[TaskAttendees]       = temp.[TaskAttendees],
            t.[TaskAttendeesEmail]  = temp.[TaskAttendeesEmail],
            t.[DeadlineDate]        = [dbo].[fn_CalculateDeadline](temp.[OnboardDate], temp.[LeadTime]),
            t.[ReminderDate]        = [dbo].[fn_GetReminderDate]([dbo].[fn_CalculateDeadline](temp.[OnboardDate], temp.[LeadTime])),
            t.[Vehicle]             = temp.[Vehicle],
            t.[IncludeGuests]       = temp.[IncludeGuests],
            t.[PassengerCount]      = temp.[PassengerCount],
            t.[FlightRoute]         = temp.[FlightRoute],
            t.[ReturnDate]          = temp.[ReturnDate],
            t.[MealOption]          = temp.[MealOption],
            t.[MeetingRoom]         = temp.[MeetingRoom],
            t.[MeetingRoomEmail]    = temp.[MeetingRoomEmail],
            t.[MeetingStartTime]    = temp.[MeetingStartTime],
            t.[MeetingEndTime]      = temp.[MeetingEndTime],
            t.[CalendarEventId]     = temp.[CalendarEventId],
            t.[ContentType]         = temp.[ContentType]
        FROM [dbo].[CSR_Tasks] t
        INNER JOIN @TempTasks temp ON t.[Task_id] = temp.[TaskId]
        WHERE temp.[TaskId] IS NOT NULL 
          AND temp.[TaskId] != '';

        -- B. Chèn các task mới (chưa có trong DB)
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
            [dbo].[fn_GenerateTaskId](@ProjectId, temp.[Destination], temp.[JsonIndex]),
            @ProjectId,
            temp.[OnboardDate],
            temp.[Destination],
            temp.[TaskName],
            temp.[TaskDetail],
            temp.[Assignee],
            temp.[AssigneeEmail],
            temp.[Supervisor],
            temp.[SupervisorEmail],
            temp.[TaskAttendees],
            temp.[TaskAttendeesEmail],
            [dbo].[fn_CalculateDeadline](temp.[OnboardDate], temp.[LeadTime]),
            [dbo].[fn_GetReminderDate]([dbo].[fn_CalculateDeadline](temp.[OnboardDate], temp.[LeadTime])),
            temp.[Vehicle],
            temp.[IncludeGuests],
            temp.[PassengerCount],
            temp.[FlightRoute],
            temp.[ReturnDate],
            temp.[MealOption],
            temp.[MeetingRoom],
            temp.[MeetingRoomEmail],
            temp.[MeetingStartTime],
            temp.[MeetingEndTime],
            temp.[CalendarEventId],
            temp.[ContentType]
        FROM @TempTasks temp
        WHERE temp.[TaskId] IS NULL 
           OR temp.[TaskId] = '' 
           OR NOT EXISTS (
               SELECT 1 
               FROM [dbo].[CSR_Tasks] 
               WHERE [Task_id] = temp.[TaskId]
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
END;
GO

-- ============================================================
-- 2. Cập nhật usp_GetTaskManagement
-- Chỉ hiển thị đơn đã đc BOD duyệt & Không bao gồm các đơn đã qua ngày tiếp đón
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_GetTaskManagement]
    @ActorRole      NVARCHAR(50) = '',
    @ActorMNV       NVARCHAR(50) = '',
    @Department     NVARCHAR(MAX) = NULL,
    @Assignee       NVARCHAR(MAX) = NULL,
    @TaskStatus     NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ActorEmail NVARCHAR(200) = '';
    IF @ActorMNV IS NOT NULL AND @ActorMNV != ''
    BEGIN
        SELECT TOP 1 @ActorEmail = [Email] FROM [dbo].[CSR_Employees] WHERE [MNV] = @ActorMNV;
    END

    SELECT 
        t.[Task_id] AS [TaskId],
        t.[Project_id] AS [ProjectId],
        p.[CustomerName],
        p.[CustomerType],
        p.[MeetingTopic],
        p.[SubmitterName],
        t.[TaskName],
        t.[TaskDetail],
        t.[Destination],
        t.[Assignee],
        t.[AssigneeEmail],
        t.[Supervisor],
        t.[SupervisorEmail],
        CONVERT(NVARCHAR(10), t.[OnboardDate], 23) AS [OnboardDate],
        CONVERT(NVARCHAR(10), t.[DeadlineDate], 23) AS [DeadlineDate],
        t.[TaskStatus],
        CASE 
            WHEN t.[TaskStatus] = N'Hoàn thành' OR t.[OnboardDate] < CAST(GETDATE() AS DATE) THEN N'Hoàn thành'
            WHEN t.[DeadlineDate] < CAST(GETDATE() AS DATE) THEN N'Delay'
            WHEN t.[TaskStatus] = N'Chưa bắt đầu' THEN N'Chưa bắt đầu'
            ELSE N'Đang xử lý'
        END AS [ComputedStatus],
        (SELECT COUNT(*) FROM [dbo].[CSR_TaskNotes] WHERE [TaskId] = t.[Task_id]) AS [NotesCount],
        (SELECT COUNT(*) FROM [dbo].[CSR_TaskAttachments] WHERE [TaskId] = t.[Task_id]) AS [AttachmentsCount]
    FROM [dbo].[CSR_Tasks] t
    INNER JOIN [dbo].[CSR_Projects] p ON t.[Project_id] = p.[Project_id]
    LEFT JOIN [dbo].[CSR_Employees] e ON p.[SubmitterMNV] = e.[MNV]
    WHERE t.[IsActive] = 1
      AND p.[Status] IN (N'BOD đã duyệt', N'Hoàn thành')
      AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR t.[AssigneeEmail] = @ActorEmail
          OR t.[SupervisorEmail] = @ActorEmail
          OR p.[SubmitterMNV] = @ActorMNV
      )
      AND (@Department IS NULL OR @Department = '' OR e.[Department] IN (SELECT value FROM STRING_SPLIT(@Department, ',')))
      AND (@Assignee IS NULL OR @Assignee = '' OR t.[Assignee] IN (SELECT value FROM STRING_SPLIT(@Assignee, ',')) OR t.[AssigneeEmail] IN (SELECT value FROM STRING_SPLIT(@Assignee, ',')))
      AND (@TaskStatus IS NULL OR @TaskStatus = '' OR EXISTS (
          SELECT 1 FROM STRING_SPLIT(@TaskStatus, ',')
          WHERE value = CASE 
              WHEN t.[TaskStatus] = N'Hoàn thành' OR t.[OnboardDate] < CAST(GETDATE() AS DATE) THEN N'Hoàn thành'
              WHEN t.[DeadlineDate] < CAST(GETDATE() AS DATE) THEN N'Delay'
              WHEN t.[TaskStatus] = N'Chưa bắt đầu' THEN N'Chưa bắt đầu'
              ELSE N'Đang xử lý'
          END
      ))
    ORDER BY t.[OnboardDate] ASC, t.[DeadlineDate] ASC;
END;
GO

-- ============================================================
-- 3. Cập nhật usp_GetDashboardV2 (Dataset 5)
-- Lịch hoàn thành công việc chuẩn bị: chỉ hiển thị đơn đã đc BOD duyệt & Chưa qua ngày tiếp đón
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_GetDashboardV2]
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
    SELECT @TotalSubmissionsMonth = COUNT(*) 
    FROM [dbo].[CSR_Projects] 
    WHERE [RecordType] = 1 
      AND [Status] != N'Đã huỷ' 
      AND YEAR([CreatedAt]) = YEAR(GETDATE()) 
      AND MONTH([CreatedAt]) = MONTH(GETDATE())
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR [SubmitterMNV] = @ActorMNV
      );

    -- Đơn tháng trước (MoM) để so sánh
    DECLARE @PrevMonthCount INT;
    SELECT @PrevMonthCount = COUNT(*)
    FROM [dbo].[CSR_Projects]
    WHERE [RecordType] = 1 
      AND [Status] != N'Đã huỷ'
      AND YEAR([CreatedAt]) = YEAR(DATEADD(month, -1, GETDATE()))
      AND MONTH([CreatedAt]) = MONTH(DATEADD(month, -1, GETDATE()))
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR [SubmitterMNV] = @ActorMNV
      );

    DECLARE @SubmissionsMonthMoM FLOAT = NULL;
    IF @PrevMonthCount > 0
        SET @SubmissionsMonthMoM = ROUND((CAST(@TotalSubmissionsMonth - @PrevMonthCount AS FLOAT) / @PrevMonthCount) * 100.0, 1);

    -- Thẻ 2: Đang chờ
    DECLARE @FutureReceptionsCount INT;
    SELECT @FutureReceptionsCount = COUNT(DISTINCT p.[Project_id])
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
      AND NOT EXISTS (
          SELECT 1 FROM [dbo].[CSR_Tasks] t2 
          WHERE t2.[Project_id] = p.[Project_id] AND t2.[IsActive] = 1 
            AND t2.[OnboardDate] <= CAST(GETDATE() AS DATE)
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

    -- Thẻ 4: Các task gần tới deadline (task chưa hoàn thành)
    DECLARE @TasksNearDeadlineCount INT;
    SELECT @TasksNearDeadlineCount = COUNT(*)
    FROM [dbo].[CSR_Tasks] t
    INNER JOIN [dbo].[CSR_Projects] p ON p.[Project_id] = t.[Project_id]
    WHERE t.[IsActive] = 1
      AND t.[TaskStatus] != N'Hoàn thành'
      AND p.[Status] != N'Đã huỷ'
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
