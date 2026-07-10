-- ============================================================
-- 04_create_procedures.sql
-- Stored Procedures - Toàn bộ business logic nằm ở đây
-- Node.js chỉ gọi EXEC và trả kết quả về FE
-- ============================================================
USE CSR_DB;
GO

-- ============================================================
-- usp_SearchEmployees
-- Tìm kiếm nhân viên cho autocomplete
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_SearchEmployees]
    @Query      NVARCHAR(200) = '',
    @TopN       INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP (@TopN)
        [FullName], [Email], [MNV]
    FROM [dbo].[CSR_Employees]
    WHERE [IsActive] = 1
        AND (
            @Query = ''
            OR [FullName] LIKE '%' + @Query + '%'
            OR [Email]    LIKE '%' + @Query + '%'
        )
    ORDER BY
        CASE WHEN [FullName] LIKE @Query + '%' THEN 0 ELSE 1 END,
        [FullName];
END
GO

-- ============================================================
-- usp_GetSuppliers
-- Lấy danh sách NCC từ BRAVO
-- Dùng 3-part name (cùng SQL Server instance, khác database)
-- Node.js backend gọi SP này qua connection pool riêng tới BRAVO_TRE DB
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_GetSuppliers]
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        -- Dùng 3-part name: [Database].[Schema].[Table]
        -- Không cần linked server nếu cùng SQL Server instance
        SELECT DISTINCT LTRIM(RTRIM([TenTat])) AS [SupplierName]
        FROM [BRAVO_TRE].[dbo].[vDM_KHACHHANG]
        WHERE [CustomerTypeList] = 'NCC'
            AND [TenTat] IS NOT NULL
            AND LTRIM(RTRIM([TenTat])) != ''
        ORDER BY [SupplierName];
    END TRY
    BEGIN CATCH
        -- Nếu không kết nối được BRAVO thì trả về rỗng, không báo lỗi
        SELECT CAST(NULL AS NVARCHAR(200)) AS [SupplierName] WHERE 1 = 0;
    END CATCH
END
GO

-- ============================================================
-- usp_GetTaskConfig
-- Lấy cấu hình task mặc định theo danh sách địa điểm
-- SQL tự xử lý fallback về VSN OFFICE nếu không tìm thấy
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_GetTaskConfig]
    @Destinations NVARCHAR(MAX)     -- Chuỗi địa điểm phân cách bởi dấu phẩy: "VSN OFFICE,VDC"
AS
BEGIN
    SET NOCOUNT ON;

    -- Parse chuỗi địa điểm thành bảng tạm
    DECLARE @DestTable TABLE ([Destination] NVARCHAR(100));
    INSERT INTO @DestTable
    SELECT LTRIM(RTRIM([value]))
    FROM STRING_SPLIT(@Destinations, ',')
    WHERE LTRIM(RTRIM([value])) != '';

    -- Lấy config cho từng địa điểm
    -- Nếu không có config riêng → dùng VSN OFFICE làm mặc định
    SELECT
        d.[Destination]                                     AS [RequestedDestination],
        COALESCE(tc.[Destination], 'VSN OFFICE')           AS [ConfigDestination],
        tc.[TaskName],
        tc.[DefaultAssignee],
        tc.[DefaultAssigneeEmail],
        tc.[DefaultSupervisor],
        tc.[DefaultSupervisorEmail],
        tc.[TaskDetail],
        ISNULL(tc.[Compulsory], '')                        AS [Compulsory],
        tc.[LeadTime]
    FROM @DestTable d
    LEFT JOIN [dbo].[CSR_TaskConfig] tc
        ON tc.[Destination] = d.[Destination]
    UNION ALL
    -- Fallback: địa điểm không có config riêng → dùng VSN OFFICE
    SELECT
        d.[Destination]                                     AS [RequestedDestination],
        'VSN OFFICE'                                        AS [ConfigDestination],
        tc.[TaskName],
        tc.[DefaultAssignee],
        tc.[DefaultAssigneeEmail],
        tc.[DefaultSupervisor],
        tc.[DefaultSupervisorEmail],
        tc.[TaskDetail],
        ''                                                  AS [Compulsory],
        tc.[LeadTime]
    FROM @DestTable d
    INNER JOIN [dbo].[CSR_TaskConfig] tc ON tc.[Destination] = 'VSN OFFICE'
    WHERE NOT EXISTS (
        SELECT 1 FROM [dbo].[CSR_TaskConfig] WHERE [Destination] = d.[Destination]
    )
    ORDER BY [RequestedDestination], [TaskName];
END
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
    -- Tasks dưới dạng JSON string
    -- Mỗi task object: { OnboardDate, Destination, TaskName, TaskDetail,
    --   Assignee, AssigneeEmail, Supervisor, SupervisorEmail,
    --   LeadTime, TaskAttendees, TaskAttendeesEmail,
    --   Vehicle, IncludeGuests, PassengerCount, FlightRoute, ReturnDate,
    --   MealOption, MeetingRoom, MeetingRoomEmail, MeetingStartTime,
    --   MeetingEndTime, CalendarEventId, ContentType }
    @TasksJson          NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;

    BEGIN TRY
        -- 1. Sinh Project_id
        DECLARE @ProjectId NVARCHAR(100);
        SET @ProjectId = [dbo].[fn_GenerateProjectId](@SubmitTimestamp, @CustomerName);

        -- Kiểm tra trùng (thêm suffix nếu trùng)
        IF EXISTS (SELECT 1 FROM [dbo].[CSR_Projects] WHERE [Project_id] = @ProjectId)
        BEGIN
            SET @ProjectId = @ProjectId + '_' + RIGHT(CAST(@SubmitTimestamp AS NVARCHAR(20)), 4);
        END

        -- 2. Lấy SubmitDate từ timestamp
        DECLARE @SubmitDate DATE;
        SET @SubmitDate = CAST(
            DATEADD(HOUR, 7,
                DATEADD(SECOND, @SubmitTimestamp / 1000,
                    CAST('1970-01-01' AS DATETIME)))
        AS DATE);

        -- 3. Insert vào CSR_Projects
        INSERT INTO [dbo].[CSR_Projects] (
            [Project_id], [Timestamp], [SubmitDate], [CustomerType], [CustomerName],
            [SubmitterEmail], [SubmitterName], [SubmitterMNV], [GuestRepName], [GuestReps],
            [GuestCount], [MeetingTopic], [Attendees], [AttendeesEmail],
            [AgendaInfo], [AgendaJsonData], [AgendaAttachUrl], [Status]
        )
        VALUES (
            @ProjectId, @SubmitTimestamp, @SubmitDate, @CustomerType, @CustomerName,
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
        RAISERROR(@Err, 16, 1);
    END CATCH
END
GO

-- ============================================================
-- usp_GetSubmission
-- Lấy chi tiết 1 đơn + danh sách task (để edit/resubmit)
-- Join trực tiếp CSR_Tasks + vw_ActiveTasks để lấy đủ cột
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_GetSubmission]
    @ProjectId NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

    -- Lấy thông tin chung của đơn
    SELECT
        [Project_id], [Timestamp], [SubmitDate], [CustomerType], [CustomerName],
        [SubmitterEmail], [SubmitterName], [SubmitterMNV], [GuestRepName], [GuestReps],
        [GuestCount], [MeetingTopic], [Attendees], [AttendeesEmail],
        [AgendaInfo], [AgendaJsonData], [AgendaAttachUrl], [Status], [CreatedAt], [UpdatedAt]
    FROM [dbo].[CSR_Projects]
    WHERE [Project_id] = @ProjectId;

    -- Lấy tasks: join CSR_Tasks (đủ cột) với vw_ActiveTasks (deadline info)
    -- vw_ActiveTasks không có TaskAttendees nên join thêm CSR_Tasks
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

-- ============================================================
-- usp_GetSubmissions
-- Danh sách đơn (phân trang) cho màn hình list
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_GetSubmissions]
    @SearchText     NVARCHAR(200)   = '',
    @Status         NVARCHAR(50)    = '',
    @PageNumber     INT             = 1,
    @PageSize       INT             = 20
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        [Project_id], [SubmitDate], [CustomerType], [CustomerName],
        [SubmitterName], [MeetingTopic], [Status],
        [TotalDays], [OnboardDates], [Destinations], [TotalTasks], [UrgentTasks]
    FROM [dbo].[vw_SubmissionSummary]
    WHERE
        (@SearchText = '' OR [CustomerName] LIKE '%' + @SearchText + '%'
                         OR [SubmitterName] LIKE '%' + @SearchText + '%'
                         OR [Project_id]   LIKE '%' + @SearchText + '%')
        AND
        (@Status = '' OR [Status] = @Status)
    ORDER BY [CreatedAt] DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;

    -- Tổng số bản ghi (để FE hiển thị phân trang)
    SELECT COUNT(*) AS [TotalCount]
    FROM [dbo].[vw_SubmissionSummary]
    WHERE
        (@SearchText = '' OR [CustomerName] LIKE '%' + @SearchText + '%'
                         OR [SubmitterName] LIKE '%' + @SearchText + '%'
                         OR [Project_id]   LIKE '%' + @SearchText + '%')
        AND
        (@Status = '' OR [Status] = @Status);
END
GO

-- ============================================================
-- usp_UpdateSubmission
-- Cập nhật đơn (resubmit): xóa task cũ, thêm task mới, tính lại deadline
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_UpdateSubmission]
    @ProjectId          NVARCHAR(100),
    @CustomerType       NVARCHAR(20)    = NULL,
    @CustomerName       NVARCHAR(200)   = NULL,
    @GuestRepName       NVARCHAR(500)   = NULL,
    @GuestReps          NVARCHAR(MAX)   = NULL,
    @GuestCount         NVARCHAR(50)    = NULL,
    @MeetingTopic       NVARCHAR(500)   = NULL,
    @Attendees          NVARCHAR(MAX)   = NULL,
    @AttendeesEmail     NVARCHAR(MAX)   = NULL,
    @AgendaInfo         NVARCHAR(MAX)   = NULL,
    @AgendaJsonData     NVARCHAR(MAX)   = NULL,
    @AgendaAttachUrl    NVARCHAR(1000)  = NULL,
    @TasksJson          NVARCHAR(MAX)   = NULL  -- NULL = không đổi tasks
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        -- Kiểm tra tồn tại
        IF NOT EXISTS (SELECT 1 FROM [dbo].[CSR_Projects] WHERE [Project_id] = @ProjectId)
        BEGIN
            RAISERROR(N'Không tìm thấy đơn: %s', 16, 1, @ProjectId);
        END

        -- Cập nhật thông tin chung (chỉ field được truyền vào)
        UPDATE [dbo].[CSR_Projects] SET
            [CustomerType]      = ISNULL(@CustomerType,    [CustomerType]),
            [CustomerName]      = ISNULL(@CustomerName,    [CustomerName]),
            [GuestRepName]      = ISNULL(@GuestRepName,    [GuestRepName]),
            [GuestReps]         = ISNULL(@GuestReps,       [GuestReps]),
            [GuestCount]        = ISNULL(@GuestCount,      [GuestCount]),
            [MeetingTopic]      = ISNULL(@MeetingTopic,    [MeetingTopic]),
            [Attendees]         = ISNULL(@Attendees,       [Attendees]),
            [AttendeesEmail]    = ISNULL(@AttendeesEmail,  [AttendeesEmail]),
            [AgendaInfo]        = ISNULL(@AgendaInfo,      [AgendaInfo]),
            [AgendaJsonData]    = ISNULL(@AgendaJsonData,  [AgendaJsonData]),
            [AgendaAttachUrl]   = ISNULL(@AgendaAttachUrl, [AgendaAttachUrl]),
            [Status]            = N'Đã cập nhật-Chờ phản hồi',
            [UpdatedAt]         = GETDATE()
        WHERE [Project_id] = @ProjectId;

        -- Nếu có tasks mới → xóa cũ, thêm mới (với deadline tính lại)
        IF @TasksJson IS NOT NULL AND LEN(@TasksJson) > 2
        BEGIN
            -- Đánh dấu task cũ là inactive (giữ lại lịch sử)
            UPDATE [dbo].[CSR_Tasks]
            SET [IsActive] = 0
            WHERE [Project_id] = @ProjectId;

            -- Insert tasks mới với deadline tính lại từ SQL
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
                [dbo].[fn_GenerateTaskId](@ProjectId, [Destination],
                    1000 + ROW_NUMBER() OVER (ORDER BY [OnboardDate], [Destination], [TaskName])),
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
                [dbo].[fn_CalculateDeadline](CAST([OnboardDate] AS DATE), ISNULL(CAST([LeadTime] AS INT), 1)),
                [dbo].[fn_GetReminderDate]([dbo].[fn_CalculateDeadline](
                    CAST([OnboardDate] AS DATE), ISNULL(CAST([LeadTime] AS INT), 1))),
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
        END

        COMMIT TRANSACTION;
        SELECT @ProjectId AS [Project_id], N'Đã cập nhật thành công' AS [Message];

    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        DECLARE @Err NVARCHAR(500) = ERROR_MESSAGE();
        RAISERROR(@Err, 16, 1);
    END CATCH
END
GO

PRINT '=== Stored Procedures created successfully ===';
GO
