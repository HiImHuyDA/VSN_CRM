-- =============================================
-- 03_stored_procedures_master.sql — Consolidated Master Stored Procedures
-- =============================================

CREATE OR ALTER PROCEDURE [dbo].[usp_AddAuditLog]
    @Action NVARCHAR(100),
    @MNV NVARCHAR(50),
    @Role NVARCHAR(50) = NULL,
    @Department NVARCHAR(100) = NULL,
    @Details NVARCHAR(MAX) = NULL,
    @SubmissionId NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO [dbo].[CSR_AuditLogs] ([Action], [MNV], [Role], [Department], [Details], [SubmissionId], [CreatedAt])
    VALUES (@Action, @MNV, @Role, @Department, @Details, @SubmissionId, GETDATE());
END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_AddTaskAttachment]
    @TaskId     NVARCHAR(150),
    @FileName   NVARCHAR(500),
    @FilePath   NVARCHAR(1000),
    @FileSize   BIGINT,
    @UploadedBy NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO [dbo].[CSR_TaskAttachments] ([TaskId], [FileName], [FilePath], [FileSize], [UploadedBy], [CreatedAt])
    VALUES (@TaskId, @FileName, @FilePath, @FileSize, @UploadedBy, GETDATE());

    SELECT SCOPE_IDENTITY() AS [Id], @TaskId AS [TaskId], @FileName AS [FileName], 
           @FilePath AS [FilePath], @FileSize AS [FileSize], @UploadedBy AS [UploadedBy], GETDATE() AS [CreatedAt];
END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_AddTaskNote]
    @TaskId     NVARCHAR(150),
    @Content    NVARCHAR(MAX),
    @AuthorMNV  NVARCHAR(50),
    @AuthorName NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO [dbo].[CSR_TaskNotes] ([TaskId], [Content], [AuthorMNV], [AuthorName], [CreatedAt])
    VALUES (@TaskId, @Content, @AuthorMNV, @AuthorName, GETDATE());

    SELECT SCOPE_IDENTITY() AS [Id], @TaskId AS [TaskId], @Content AS [Content], 
           @AuthorMNV AS [AuthorMNV], @AuthorName AS [AuthorName], GETDATE() AS [CreatedAt];
END
GO

-- 1. usp_ApproveSubmission: thêm guard cho nhánh PRD duyệt (nhánh BOD đã có guard từ trước)
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
        DECLARE @CustomerType NVARCHAR(50);

        SELECT @OldStatus = s.TenTrangThai, @CustomerType = p.CustomerType
        FROM [dbo].[CSR_Projects] p
        INNER JOIN [dbo].[CSR_Statuses] s ON p.StatusId = s.Id
        WHERE p.[Project_id] = @ProjectId;

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
            -- GUARD MỚI: đơn chỉ được PRD duyệt khi đang ở "Chờ phản hồi".
            -- Nếu đơn đã tiến xa hơn (PRD đã duyệt/BOD đã duyệt/Hoàn thành/Đã hủy/bị từ chối...)
            -- thì đây là 1 lần duyệt trễ/duyệt trùng (VD: click thẻ Teams cũ) -> từ chối, KHÔNG ghi đè.
            IF @OldStatus <> N'Chờ phản hồi'
                RAISERROR(N'Đơn đã được xử lý trước đó (trạng thái hiện tại: %s). Yêu cầu duyệt này đã lỗi thời.', 16, 1, @OldStatus);

            -- Nếu loại khách hàng không phải Brand (Partner, Supplier, Khách vãng lai, Ứng viên phỏng vấn)
            -- thì PRD duyệt chuyển thẳng sang BOD đã duyệt để bỏ qua bước duyệt của BOD.
            IF @CustomerType IN (N'Partner', N'Supplier', N'Khách vãng lai', N'Ứng viên phỏng vấn')
                SET @NewStatus = N'BOD đã duyệt';
            ELSE
                SET @NewStatus = N'PRD đã duyệt';
        END

        UPDATE [dbo].[CSR_Projects]
        SET [StatusId] = (SELECT Id FROM [dbo].[CSR_Statuses] WHERE [TenTrangThai] = @NewStatus), [UpdatedAt] = GETDATE()
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

-- Stored Procedure: Đổi mật khẩu
CREATE OR ALTER PROCEDURE [dbo].[usp_ChangePassword]
    @MNV NVARCHAR(50),
    @NewPasswordHash NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE [dbo].[CSR_Users]
    SET 
        [PasswordHash] = @NewPasswordHash,
        [RequiresPasswordChange] = 0,
        [UpdatedAt] = GETDATE()
    WHERE [MNV] = @MNV;
END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_CopyEmailTemplate]
    @SourceId INT
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO [dbo].[CSR_EmailCampaignTemplates] (
        [Purpose], [TemplateName], [StartDate], [EndDate], [Location],
        [IsAllCustomer], [Customers], [SenderName], [SenderEmail],
        [RecipientName], [RecipientEmail], [EmailSubject], [EmailBody],
        [StatusId], [CreatedAt], [UpdatedAt]
    )
    SELECT
        [Purpose],
        [TemplateName] + ' (Copy)',
        [StartDate],
        [EndDate],
        [Location],
        [IsAllCustomer],
        [Customers],
        [SenderName],
        [SenderEmail],
        [RecipientName],
        [RecipientEmail],
        [EmailSubject],
        [EmailBody],
        2, -- Dừng
        GETDATE(),
        GETDATE()
    FROM [dbo].[CSR_EmailCampaignTemplates]
    WHERE [Id] = @SourceId;
    
    SELECT SCOPE_IDENTITY() AS NewId;
END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_CopyTaskConfig]
    @FromDestination NVARCHAR(100),
    @ToDestination NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO [dbo].[CSR_TaskConfig] (
        [Destination], [TaskName], [Description],
        [AssigneeId], [AssigneeName], [AssigneeEmail],
        [SupervisorId], [SupervisorName], [SupervisorEmail],
        [IsCompulsory], [LeadtimeDays], [StatusId]
    )
    SELECT 
        @ToDestination, t.[TaskName], t.[Description],
        t.[AssigneeId], t.[AssigneeName], t.[AssigneeEmail],
        t.[SupervisorId], t.[SupervisorName], t.[SupervisorEmail],
        t.[IsCompulsory], t.[LeadtimeDays], t.[StatusId]
    FROM [dbo].[CSR_TaskConfig] t
    WHERE t.[Destination] = @FromDestination
      AND NOT EXISTS (
          SELECT 1 FROM [dbo].[CSR_TaskConfig] t2 
          WHERE t2.[Destination] = @ToDestination AND t2.[TaskName] = t.[TaskName]
      );
END
GO

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
        -- 0. Kiem tra trung: cung CustomerName + cung OnboardDate (ngay tiep don) trong Tasks
        -- Chi kiem tra khi tao moi (RecordType=1, Version=1)
        -- Loai tru cac don da bi tu choi (6=BOD tu choi, 9=Da huy) khoi kiem tra
        IF @RecordType = 1 AND @Version = 1
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM [dbo].[CSR_Projects] p
                INNER JOIN [dbo].[CSR_Tasks] t ON t.Project_id = p.Project_id AND t.StatusId IS NOT NULL
                WHERE p.CustomerName = @CustomerName
                  AND p.StatusId NOT IN (6, 9)
                  AND p.RecordType = 1
                  AND CAST(t.OnboardDate AS DATE) IN (
                      SELECT DISTINCT CAST(j.OnboardDate AS DATE)
                      FROM OPENJSON(@TasksJson)
                      WITH (OnboardDate NVARCHAR(50) '$.onboardDate') j
                      WHERE j.OnboardDate IS NOT NULL AND j.OnboardDate <> ''
                  )
            )
            BEGIN
                SELECT 'DUPLICATE' AS [Project_id], N'Khach hang va Ngay tiep don da ton tai!' AS [Message];
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

        -- 2. Lay SubmitDate tu timestamp (UTC+7)
        DECLARE @SubmitDate DATE;
        SET @SubmitDate = CAST(
            DATEADD(HOUR, 7,
                DATEADD(SECOND, @SubmitTimestamp / 1000,
                    CAST('1970-01-01' AS DATETIME)))
        AS DATE);

        -- 3. Insert vao CSR_Projects
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
            @AgendaInfo, @AgendaJsonData, @AgendaAttachUrl, 8
        );

        -- 4. Parse Tasks tu JSON va insert vao CSR_Tasks
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
            CASE WHEN [ReturnDate] IS NULL OR [ReturnDate] = '' THEN NULL ELSE CAST([ReturnDate] AS DATE) END,
            [MealOption],
            [MeetingRoom],
            [MeetingRoomEmail],
            [MeetingStartTime],
            [MeetingEndTime],
            [CalendarEventId],
            [ContentType],
            1
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
END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_Dashboard_GetStats]
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

    -- 1. Tạo bảng tạm lưu các đơn bản ghi phiên bản mới nhất
    SELECT p.*
    INTO #LatestProjects
    FROM [dbo].[CSR_Projects] p
    INNER JOIN (
        SELECT [Project_id], ROW_NUMBER() OVER (PARTITION BY [ParentId] ORDER BY [Version] DESC) as rn
        FROM [dbo].[CSR_Projects]
    ) lv ON p.[Project_id] = lv.[Project_id] AND lv.rn = 1;

    -- 2. Tạo bảng tạm lưu thông tin ngày đi và địa điểm gộp từ cả đơn có Task và đơn không có Task
    SELECT
        p.[Project_id],
        t.[OnboardDate] AS [VisitDate],
        t.[Destination] COLLATE DATABASE_DEFAULT AS [Destination],
        t.[AssigneeEmail],
        t.[SupervisorEmail]
    INTO #DateDest
    FROM #LatestProjects p
    INNER JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1

    UNION ALL

    SELECT
        p.[Project_id],
        TRY_CAST(j.[VisitDateStr] AS DATE) AS [VisitDate],
        d.[key] COLLATE DATABASE_DEFAULT AS [Destination],
        NULL AS [AssigneeEmail],
        NULL AS [SupervisorEmail]
    FROM #LatestProjects p
    CROSS APPLY OPENJSON(p.[AgendaJsonData])
        WITH ([VisitDateStr] NVARCHAR(20) '$.date', [agenda] NVARCHAR(MAX) '$.agenda' AS JSON) j
    CROSS APPLY OPENJSON(j.[agenda]) d
    WHERE p.[AgendaJsonData] IS NOT NULL
        AND NOT EXISTS (
            SELECT 1
            FROM [dbo].[CSR_Tasks] t2
            WHERE t2.[Project_id] = p.[Project_id]
        );

    -- 3. Tính toán các Stats KPI (Tổng đơn tháng, Đang chờ, Lịch tuần này, Task gần deadline)
    -- Thẻ 1: Tổng đơn tháng
    DECLARE @TotalSubmissionsMonth INT;
    SELECT @TotalSubmissionsMonth = COUNT(DISTINCT p.[Project_id]) 
    FROM #LatestProjects p
    INNER JOIN #DateDest dd ON dd.[Project_id] = p.[Project_id]
    WHERE p.[StatusId] IN (8, 4, 5, 7) -- Chờ phản hồi (8), PRD đã duyệt (4), BOD đã duyệt (5), Hoàn thành (7)
      AND YEAR(dd.[VisitDate]) = YEAR(GETDATE()) 
      AND MONTH(dd.[VisitDate]) = MONTH(GETDATE())
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR p.[SubmitterMNV] = @ActorMNV
      );

    -- Đơn tháng trước (MoM) để so sánh
    DECLARE @PrevMonthCount INT;
    SELECT @PrevMonthCount = COUNT(DISTINCT p.[Project_id])
    FROM #LatestProjects p
    INNER JOIN #DateDest dd ON dd.[Project_id] = p.[Project_id]
    WHERE p.[StatusId] IN (8, 4, 5, 7) -- Chờ phản hồi (8), PRD đã duyệt (4), BOD đã duyệt (5), Hoàn thành (7)
      AND YEAR(dd.[VisitDate]) = YEAR(DATEADD(month, -1, GETDATE()))
      AND MONTH(dd.[VisitDate]) = MONTH(DATEADD(month, -1, GETDATE()))
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR p.[SubmitterMNV] = @ActorMNV
      );

    DECLARE @SubmissionsMonthMoM FLOAT = NULL;
    IF @PrevMonthCount > 0
        SET @SubmissionsMonthMoM = ROUND((CAST(@TotalSubmissionsMonth - @PrevMonthCount AS FLOAT) / @PrevMonthCount) * 100.0, 1);

    -- Thẻ 2: Đang chờ tiếp đón
    DECLARE @FutureReceptionsCount INT;
    SELECT @FutureReceptionsCount = COUNT(DISTINCT p.[Project_id])
    FROM #LatestProjects p
    INNER JOIN #DateDest dd ON dd.[Project_id] = p.[Project_id]
    WHERE p.[StatusId] IN (8, 4, 5, 7) -- Chờ phản hồi (8), PRD đã duyệt (4), BOD đã duyệt (5), Hoàn thành (7)
      AND dd.[VisitDate] > CAST(GETDATE() AS DATE)
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR p.[SubmitterMNV] = @ActorMNV
          OR dd.[AssigneeEmail] = @ActorEmail
          OR dd.[SupervisorEmail] = @ActorEmail
      );

    -- Thẻ 3: Lịch hẹn tuần này
    DECLARE @WeeklyScheduleCount INT;
    SELECT @WeeklyScheduleCount = COUNT(DISTINCT p.[Project_id])
    FROM #LatestProjects p
    INNER JOIN #DateDest dd ON dd.[Project_id] = p.[Project_id]
    WHERE p.[StatusId] IN (8, 4, 5, 7) -- Chờ phản hồi (8), PRD đã duyệt (4), BOD đã duyệt (5), Hoàn thành (7)
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR p.[SubmitterMNV] = @ActorMNV
          OR dd.[AssigneeEmail] = @ActorEmail
          OR dd.[SupervisorEmail] = @ActorEmail
      )
      AND dd.[VisitDate] >= DATEADD(wk, DATEDIFF(wk, 0, GETDATE()), 0)
      AND dd.[VisitDate] <= DATEADD(wk, DATEDIFF(wk, 0, GETDATE()), 6);

    -- Thẻ 4: Các task gần tới deadline
    DECLARE @TasksNearDeadlineCount INT;
    SELECT @TasksNearDeadlineCount = COUNT(*)
    FROM [dbo].[CSR_Tasks] t
    INNER JOIN #LatestProjects p ON p.[Project_id] = t.[Project_id]
    WHERE t.[StatusId] = 1
      AND t.[TaskStatus] != N'Hoàn thành'
      AND p.[StatusId] IN (8, 4, 5, 7) -- Chờ phản hồi (8), PRD đã duyệt (4), BOD đã duyệt (5), Hoàn thành (7)
      AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR t.[AssigneeEmail] = @ActorEmail
          OR t.[SupervisorEmail] = @ActorEmail
      )
      AND t.[DeadlineDate] >= CAST(GETDATE() AS DATE)
      AND t.[DeadlineDate] <= DATEADD(DAY, 3, CAST(GETDATE() AS DATE));

    -- OUTPUT 1: Stats KPI
    SELECT 
        ISNULL(@TotalSubmissionsMonth, 0) AS [TotalSubmissionsMonth],
        @SubmissionsMonthMoM AS [SubmissionsMonthMoM],
        ISNULL(@FutureReceptionsCount, 0) AS [FutureReceptionsCount],
        ISNULL(@WeeklyScheduleCount, 0) AS [WeeklyScheduleCount],
        ISNULL(@TasksNearDeadlineCount, 0) AS [TasksNearDeadlineCount];

    -- OUTPUT 2: Thống kê theo tháng (Dataset 1)
    SELECT
        m.[Month],
        COUNT(DISTINCT p.[Project_id]) AS [Total]
    FROM (
        SELECT 1 AS [Month] UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION 
        SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12
    ) m
    LEFT JOIN #LatestProjects p ON p.[StatusId] IN (8, 4, 5, 7) -- Chờ phản hồi (8), PRD đã duyệt (4), BOD đã duyệt (5), Hoàn thành (7)
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR p.[SubmitterMNV] = @ActorMNV
      )
      AND EXISTS (
          SELECT 1 FROM #DateDest dd 
          WHERE dd.[Project_id] = p.[Project_id]
            AND YEAR(dd.[VisitDate]) = YEAR(GETDATE()) 
            AND MONTH(dd.[VisitDate]) = m.[Month]
      )
    GROUP BY m.[Month]
    ORDER BY m.[Month] ASC;

    -- OUTPUT 3: Lịch tiếp đón trong tháng hiện tại (Dataset 2 - Lịch nhỏ)
    SELECT DISTINCT
        CONVERT(NVARCHAR(10), dd.[VisitDate], 23) AS [OnboardDate],
        CASE WHEN dd.[VisitDate] >= CAST(GETDATE() AS DATE) THEN 'green' ELSE 'gray' END AS [DotColor]
    FROM #LatestProjects p
    INNER JOIN #DateDest dd ON dd.[Project_id] = p.[Project_id]
    WHERE p.[StatusId] IN (8, 4, 5, 7) -- Chờ phản hồi (8), PRD đã duyệt (4), BOD đã duyệt (5), Hoàn thành (7)
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR p.[SubmitterMNV] = @ActorMNV
      )
      AND YEAR(dd.[VisitDate]) = YEAR(GETDATE()) 
      AND MONTH(dd.[VisitDate]) = MONTH(GETDATE());

    -- OUTPUT 4: Thông báo chờ phê duyệt (Dataset 3)
    SELECT DISTINCT TOP 20
        p.[Project_id] AS [ProjectId],
        p.[CustomerName],
        s.TenTrangThai AS [Status],
        p.[CreatedAt],
        [OnboardDates] = STUFF((
            SELECT DISTINCT ', ' + CONVERT(NVARCHAR(10), dd2.[VisitDate], 103)
            FROM #DateDest dd2
            WHERE dd2.[Project_id] = p.[Project_id]
            FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'), 1, 2, '')
    FROM #LatestProjects p
    INNER JOIN [dbo].[CSR_Statuses] s ON p.[StatusId] = s.[Id]
    WHERE p.[StatusId] IN (8, 4) -- Chờ phản hồi (8), PRD đã duyệt (4)
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR p.[SubmitterMNV] = @ActorMNV
      )
    ORDER BY p.[CreatedAt] DESC;

    -- OUTPUT 5: Danh sách khách trong tháng hiện tại (Dataset 4)
    SELECT DISTINCT
        p.[Project_id] AS [ProjectId],
        p.[CustomerName],
        p.[CustomerType],
        p.[SubmitterName],
        s.TenTrangThai AS [Status],
        CONVERT(NVARCHAR(10), p.[CreatedAt], 23) AS [CreatedAt],
        p.[MeetingTopic] AS [MeetingTopic],
        STUFF((
            SELECT DISTINCT ', ' + CONVERT(NVARCHAR(10), dd2.[VisitDate], 103)
            FROM #DateDest dd2
            WHERE dd2.[Project_id] = p.[Project_id]
            FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS [OnboardDates]
    FROM #LatestProjects p
    INNER JOIN [dbo].[CSR_Statuses] s ON p.[StatusId] = s.[Id]
    INNER JOIN #DateDest dd ON dd.[Project_id] = p.[Project_id]
    WHERE p.[StatusId] IN (8, 4, 5, 7) -- Chờ phản hồi (8), PRD đã duyệt (4), BOD đã duyệt (5), Hoàn thành (7)
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR p.[SubmitterMNV] = @ActorMNV
          OR dd.[AssigneeEmail] = @ActorEmail
          OR dd.[SupervisorEmail] = @ActorEmail
      )
      AND YEAR(dd.[VisitDate]) = YEAR(GETDATE())
      AND MONTH(dd.[VisitDate]) = MONTH(GETDATE())
    ORDER BY [ProjectId] DESC;

    -- OUTPUT 6: Lịch hoàn thành công việc chuẩn bị (Dataset 5)
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
    INNER JOIN #LatestProjects p ON t.[Project_id] = p.[Project_id]
    WHERE t.[StatusId] = 1
      AND p.[StatusId] IN (8, 4, 5, 7) -- Chờ phản hồi (8), PRD đã duyệt (4), BOD đã duyệt (5), Hoàn thành (7)
      AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR t.[AssigneeEmail] = @ActorEmail
          OR t.[SupervisorEmail] = @ActorEmail
      )
      AND YEAR(t.[DeadlineDate]) = YEAR(GETDATE())
      AND MONTH(t.[DeadlineDate]) = MONTH(GETDATE())
    ORDER BY t.[DeadlineDate] ASC;

    -- Dọn dẹp bảng tạm
    DROP TABLE #LatestProjects;
    DROP TABLE #DateDest;
END;
GO

-- 5b. DELETE /email-campaigns/:id
CREATE OR ALTER PROCEDURE [dbo].[usp_DeleteEmailTemplate]
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM [dbo].[CSR_EmailCampaignTemplates]
    WHERE [Id] = @Id;
END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_DeleteEvaluationCriteria]
    @CriteriaId INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        DELETE FROM [dbo].[CSR_ReviewCriteria] WHERE [Id] = @CriteriaId;
    END TRY
    BEGIN CATCH
        UPDATE [dbo].[CSR_ReviewCriteria] 
        SET [StatusId] = 2, [FormId] = NULL 
        WHERE [Id] = @CriteriaId;
    END CATCH
END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_DeleteTaskAttachment]
    @AttachmentId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @FilePath NVARCHAR(1000);
    SELECT @FilePath = [FilePath] FROM [dbo].[CSR_TaskAttachments] WHERE [Id] = @AttachmentId;

    DELETE FROM [dbo].[CSR_TaskAttachments]
    WHERE [Id] = @AttachmentId;

    SELECT @AttachmentId AS [AttachmentId], @FilePath AS [FilePath], N'Đã xoá file đính kèm thành công' AS [Message];
END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_DeleteTaskNote]
    @NoteId INT,
    @AuthorMNV NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Admin có quyền xoá bất kỳ note nào, còn lại chỉ xoá được note của chính mình
    DELETE FROM [dbo].[CSR_TaskNotes]
    WHERE [Id] = @NoteId
      AND (@AuthorMNV IS NULL OR [AuthorMNV] = @AuthorMNV);

    SELECT @NoteId AS [NoteId], N'Đã xoá ghi chú thành công' AS [Message];
END
GO

CREATE OR ALTER PROCEDURE usp_DeleteUploadedFile
                @Id INT
            AS
            BEGIN
                SET NOCOUNT ON;

                DELETE FROM CSR_UploadedFiles WHERE id = @Id;
            END
GO

-- ------------------------------------------------------------
-- Module: EmailTemplate (Mẫu Email chiến dịch)
-- ------------------------------------------------------------

-- A. usp_EmailTemplate_GetById (Cũ: usp_GetEmailTemplateById)
CREATE OR ALTER PROCEDURE [dbo].[usp_EmailTemplate_GetById]
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT *
    FROM [dbo].[CSR_EmailCampaignTemplates]
    WHERE [Id] = @Id;
END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_EmailTemplate_List]
    @Purpose      NVARCHAR(100) = NULL,
    @Location     NVARCHAR(100) = NULL,
    @Customer     NVARCHAR(200) = NULL,
    @IsActive     BIT = NULL,
    @SearchText   NVARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [Id], [Purpose], [TemplateName], [StartDate], [EndDate], [Location],
           [IsAllCustomer], [Customers], [SenderName], [SenderEmail],
           [RecipientName], [RecipientEmail], [EmailSubject], [EmailBody],
           CASE WHEN [StatusId] = 1 THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS [IsActive], 
           [CreatedAt], [UpdatedAt]
    FROM [dbo].[CSR_EmailCampaignTemplates]
    WHERE (@Purpose IS NULL OR [Purpose] = @Purpose)
      AND (@Location IS NULL OR [Location] = @Location OR [Location] = '')
      AND (@IsActive IS NULL OR (@IsActive = 1 AND [StatusId] = 1) OR (@IsActive = 0 AND [StatusId] <> 1))
      AND (@SearchText IS NULL OR [TemplateName] LIKE '%' + @SearchText + '%')
      AND (
          @Customer IS NULL OR 
          [IsAllCustomer] = 1 OR 
          [Customers] LIKE '%' + @Customer + '%'
      )
    ORDER BY [CreatedAt] DESC;
END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_Employee_UpdateSupervisorEmails]
    @SupervisorEmailsJson NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE e
    SET e.ManagerEmail = j.ManagerEmail
    FROM [dbo].[CSR_Employees] e
    INNER JOIN OPENJSON(@SupervisorEmailsJson)
    WITH (
        MNV NVARCHAR(50) '$.mnv',
        ManagerEmail NVARCHAR(200) '$.managerEmail'
    ) j ON e.MNV = j.MNV
    WHERE j.ManagerEmail IS NOT NULL AND j.ManagerEmail != '';

    PRINT 'Updated direct supervisor emails in CSR_Employees';
END;
GO

-- 3. Stored Procedure hủy thư mời
CREATE OR ALTER PROCEDURE [dbo].[usp_Feedback_Invitation_Cancel]
    @InvitationId   INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE [dbo].[CSR_FeedbackInvitations]
    SET [Status] = N'Cancelled'
    WHERE Id = @InvitationId;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO

-- Migration: Tạo các Stored Procedure quản lý Feedback tuân thủ quy tắc đặt tên dự án
-- 64_create_feedback_stored_procedures.sql

-- 1. Stored Procedure lấy danh sách thư mời
CREATE OR ALTER PROCEDURE [dbo].[usp_Feedback_Invitation_List]
    @Status         NVARCHAR(50) = NULL,
    @ProjectId      NVARCHAR(100) = NULL,
    @CustomerName   NVARCHAR(200) = NULL,
    @Host           NVARCHAR(200) = NULL,
    @DateStart      DATETIME = NULL,
    @DateEnd        DATETIME = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT i.Id, i.Token, i.ProjectId, i.VisitorId, i.CreatedDate, i.ExpireDate, i.UsedDate, i.Status, i.CreatedBy,
           p.CustomerName, p.SubmitterName, p.MeetingTopic, p.GuestReps
    FROM [dbo].[CSR_FeedbackInvitations] i
    INNER JOIN [dbo].[CSR_Projects] p ON i.ProjectId = p.Project_id
    WHERE 1=1
      AND (@Status IS NULL OR i.[Status] = @Status)
      AND (@ProjectId IS NULL OR i.ProjectId = @ProjectId)
      AND (@CustomerName IS NULL OR p.CustomerName LIKE '%' + @CustomerName + '%')
      AND (@Host IS NULL OR p.SubmitterName LIKE '%' + @Host + '%' OR p.SubmitterEmail LIKE '%' + @Host + '%')
      AND (@DateStart IS NULL OR i.CreatedDate >= @DateStart)
      AND (@DateEnd IS NULL OR i.CreatedDate <= @DateEnd)
    ORDER BY i.CreatedDate DESC;
END
GO

-- 2. Stored Procedure thực hiện resend và trả về thông tin gửi mail
CREATE OR ALTER PROCEDURE [dbo].[usp_Feedback_Invitation_Resend]
    @InvitationId   INT,
    @NewToken       NVARCHAR(128),
    @NewExpireDate  DATETIME
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;
    BEGIN TRY
        -- Cập nhật thông tin thư mời
        UPDATE [dbo].[CSR_FeedbackInvitations]
        SET [Token] = @NewToken,
            [ExpireDate] = @NewExpireDate,
            [Status] = N'Pending',
            [UsedDate] = NULL
        WHERE Id = @InvitationId;

        -- Trả về thông tin chi tiết thư mời để gọi Graph API
        SELECT i.Id, i.ProjectId, i.VisitorId, p.CustomerName, p.GuestReps, p.SubmitterName, p.SubmitDate
        FROM [dbo].[CSR_FeedbackInvitations] i
        INNER JOIN [dbo].[CSR_Projects] p ON i.ProjectId = p.Project_id
        WHERE i.Id = @InvitationId;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        DECLARE @Err NVARCHAR(500) = ERROR_MESSAGE();
        RAISERROR(@Err, 16, 1);
    END CATCH
END
GO

-- 4. Stored Procedure lấy danh sách phản hồi đánh giá
CREATE OR ALTER PROCEDURE [dbo].[usp_Feedback_Response_List]
    @Rating         INT = NULL,
    @CustomerName   NVARCHAR(200) = NULL,
    @Host           NVARCHAR(200) = NULL,
    @DateStart      DATETIME = NULL,
    @DateEnd        DATETIME = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT r.Id, r.InvitationId, r.ProjectId, r.OverallRating, r.AnswersJson, r.Comments, r.SubmittedAt,
           p.CustomerName, p.SubmitterName, p.MeetingTopic, i.VisitorId, p.GuestReps
    FROM [dbo].[CSR_FeedbackResponses] r
    INNER JOIN [dbo].[CSR_Projects] p ON r.ProjectId = p.Project_id
    INNER JOIN [dbo].[CSR_FeedbackInvitations] i ON r.InvitationId = i.Id
    WHERE 1=1
      AND (@Rating IS NULL OR r.OverallRating = @Rating)
      AND (@CustomerName IS NULL OR p.CustomerName LIKE '%' + @CustomerName + '%')
      AND (@Host IS NULL OR p.SubmitterName LIKE '%' + @Host + '%' OR p.SubmitterEmail LIKE '%' + @Host + '%')
      AND (@DateStart IS NULL OR r.SubmittedAt >= @DateStart)
      AND (@DateEnd IS NULL OR r.SubmittedAt <= @DateEnd)
    ORDER BY r.SubmittedAt DESC;
END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_Booking_Create]
    @RequesterMNV    NVARCHAR(50)   = NULL,
    @RequesterName   NVARCHAR(200),
    @RequesterEmail  NVARCHAR(200)  = NULL,
    @RequesterDept   NVARCHAR(200)  = NULL,
    @DepartureTime   DATETIME,
    @ReturnTime      DATETIME       = NULL,
    @Purpose         NVARCHAR(1000),
    @ParentBookingCode NVARCHAR(30) = NULL,
    @PickupLocation  NVARCHAR(500),
    @Destination     NVARCHAR(500),
    @Stops           NVARCHAR(MAX)  = NULL,
    @PassengerCount  INT            = 1,
    @Priority        NVARCHAR(20)   = N'Bình thường',
    @VehicleType     NVARCHAR(100)  = N'Xe công ty',
    @Attendees       NVARCHAR(MAX)  = NULL,
    @AttendeesEmail  NVARCHAR(MAX)  = NULL,
    @Notes           NVARCHAR(1000) = NULL,
    @VehicleId       INT            = NULL,
    @DriverId        INT            = NULL,
    @ReturnStops          NVARCHAR(MAX)  = NULL,
    @ReturnPassengerCount INT            = 1,
    @ReturnPriority       NVARCHAR(20)   = N'Bình thường',
    @ReturnVehicleType    NVARCHAR(100)  = N'Xe công ty',
    @ReturnAttendees      NVARCHAR(MAX)  = NULL,
    @ReturnAttendeesEmail NVARCHAR(MAX)  = NULL,
    @ReturnNotes          NVARCHAR(1000) = NULL,
    @ReturnVehicleId      INT            = NULL,
    @ReturnDriverId       INT            = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        DECLARE @Year CHAR(4) = CAST(YEAR(GETDATE()) AS CHAR(4));
        DECLARE @Seq INT;
        SELECT @Seq = COUNT(*) + 1
        FROM [dbo].[Fleet_Bookings]
        WHERE YEAR([CreatedAt]) = YEAR(GETDATE());
        DECLARE @Code NVARCHAR(30) = 'VE-' + @Year + '-' + RIGHT('0000' + CAST(@Seq AS NVARCHAR), 4);

        -- Auto-approve: chỉ khi chặng đi VIP+có xe, VÀ (không phải khứ hồi HOẶC chặng về cũng VIP+có xe)
        DECLARE @InitStatus NVARCHAR(50) = N'Chờ phản hồi';
        IF (@Priority = N'VIP' AND @VehicleId IS NOT NULL)
           AND (@ReturnTime IS NULL OR (@ReturnPriority = N'VIP' AND @ReturnVehicleId IS NOT NULL))
        BEGIN
            SET @InitStatus = N'Team Admin đã duyệt';
        END

        INSERT INTO [dbo].[Fleet_Bookings]
            ([BookingCode], [ParentBookingCode], [RequesterMNV], [RequesterName], [RequesterEmail], [RequesterDept],
             [DepartureTime], [ReturnTime], [Purpose], [Status], [ApprovedBy], [ApprovedAt])
        VALUES
            (@Code, @ParentBookingCode, @RequesterMNV, @RequesterName, @RequesterEmail, @RequesterDept,
             @DepartureTime, @ReturnTime, @Purpose, @InitStatus,
             CASE WHEN @InitStatus = N'Team Admin đã duyệt' THEN @RequesterName ELSE NULL END,
             CASE WHEN @InitStatus = N'Team Admin đã duyệt' THEN GETDATE() ELSE NULL END);

        DECLARE @NewId INT = SCOPE_IDENTITY();

        INSERT INTO [dbo].[Fleet_BookingsDetailed]
            ([BookingCode], [BookingCodeNo], [PickupLocation], [Destination], [Stops],
             [PassengerCount], [Priority], [VehicleId], [DriverId], [Notes],
             [Attendees], [AttendeesEmail], [VehicleType])
        VALUES
            (@Code, @Code + '-1', @PickupLocation, @Destination, @Stops,
             @PassengerCount, @Priority, @VehicleId, @DriverId, @Notes,
             @Attendees, @AttendeesEmail, @VehicleType);

        IF @ReturnTime IS NOT NULL
        BEGIN
            INSERT INTO [dbo].[Fleet_BookingsDetailed]
                ([BookingCode], [BookingCodeNo], [PickupLocation], [Destination], [Stops],
                 [PassengerCount], [Priority], [VehicleId], [DriverId], [Notes],
                 [Attendees], [AttendeesEmail], [VehicleType])
            VALUES
                (@Code, @Code + '-2', @Destination, @PickupLocation, @ReturnStops,
                 @ReturnPassengerCount, @ReturnPriority, @ReturnVehicleId, @ReturnDriverId, @ReturnNotes,
                 @ReturnAttendees, @ReturnAttendeesEmail, @ReturnVehicleType);
        END

        SELECT @NewId AS Id, @Code AS BookingCode, @InitStatus AS Status;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_Booking_Export]
    @Status        NVARCHAR(50)   = NULL,
    @RequesterMNV  NVARCHAR(50)   = NULL,
    @DateFrom      DATE           = NULL,
    @DateTo        DATE           = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        b.[BookingCode] AS N'Mã đặt xe',
        FORMAT(b.[CreatedAt], 'dd/MM/yyyy') AS N'Ngày tạo',
        b.[RequesterName] AS N'Người đặt',
        b.[RequesterDept] AS N'Phòng ban',
        bd.[PickupLocation] AS N'Điểm đón',
        bd.[Destination] AS N'Điểm đến',
        FORMAT(b.[DepartureTime], 'dd/MM/yyyy HH:mm') AS N'Giờ khởi hành',
        FORMAT(b.[ReturnTime], 'dd/MM/yyyy HH:mm') AS N'Giờ về',
        CAST(bd.[PassengerCount] AS NVARCHAR) AS N'Số người',
        bd.[Attendees] AS N'Người tham gia đi cùng',
        bd.[AttendeesEmail] AS N'Email người tham gia',
        bd.[VehicleType] AS N'Loại xe',
        b.[Purpose] AS N'Mục đích',
        b.[Status] AS N'Trạng thái',
        ISNULL(v.[PlateNumber] + ' - ' + v.[Brand], '') AS N'Xe phân công',
        ISNULL(d.[FullName], '') AS N'Tài xế',
        ISNULL(d.[Phone], '') AS N'SĐT tài xế',
        b.[ApprovedBy] AS N'Người duyệt',
        FORMAT(b.[ApprovedAt], 'dd/MM/yyyy HH:mm') AS N'Thời gian duyệt',
        ISNULL(b.[RejectedReason], '') AS N'Lý do từ chối',
        ISNULL(b.[Notes], '') AS N'Ghi chú'
    FROM [dbo].[Fleet_Bookings] b
    LEFT JOIN [dbo].[Fleet_BookingsDetailed] bd ON bd.[BookingCode] = b.[BookingCode] AND bd.[BookingCodeNo] = b.[BookingCode] + '-1'
    LEFT JOIN [dbo].[Fleet_Vehicles] v ON v.[Id] = bd.[VehicleId]
    LEFT JOIN [dbo].[Fleet_Drivers]  d ON d.[Id] = bd.[DriverId]
    WHERE
        (@Status IS NULL OR b.[Status] = @Status)
        AND (@RequesterMNV IS NULL OR b.[RequesterMNV] = @RequesterMNV)
        AND (@DateFrom IS NULL OR CAST(b.[DepartureTime] AS DATE) >= @DateFrom)
        AND (@DateTo   IS NULL OR CAST(b.[DepartureTime] AS DATE) <= @DateTo)
    ORDER BY b.[CreatedAt] DESC;
END
GO

-- =========================================================================
-- 6. Calendar Stored Procedure (leg level scheduling)
-- =========================================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_Booking_GetCalendar]
    @DateFrom   DATE,
    @DateTo     DATE,
    @VehicleId  INT  = NULL,
    @DriverId   INT  = NULL,
    @Status     NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT
        b.[Id],
        b.[BookingCode],
        bd.[BookingCodeNo],
        b.[RequesterName],
        b.[RequesterDept],
        bd.[PickupLocation],
        bd.[Destination],
        -- Map dates dynamically based on leg suffix (-1 is DepartureTime, -2 is ReturnTime)
        CASE WHEN bd.[BookingCodeNo] LIKE '%-2' THEN b.[ReturnTime] ELSE b.[DepartureTime] END AS [DepartureTime],
        CASE WHEN bd.[BookingCodeNo] LIKE '%-2' THEN NULL ELSE b.[ReturnTime] END AS [ReturnTime],
        b.[Purpose],
        bd.[PassengerCount],
        bd.[Priority],
        b.[Status],
        bd.[VehicleType],
        bd.[VehicleId],
        v.[PlateNumber] AS VehiclePlate, v.[Brand] AS VehicleBrand,
        v.[Model] AS VehicleModel, v.[Seats] AS VehicleSeats,
        v.[TypeId],
        vt.[TypeName] AS VehicleTypeName,
        bd.[DriverId],
        d.[FullName] AS DriverName, d.[Phone] AS DriverPhone,
        b.[AssignedNote],
        bd.[Notes],
        bd.[Attendees]
    FROM [dbo].[Fleet_BookingsDetailed] bd
    JOIN [dbo].[Fleet_Bookings] b ON b.[BookingCode] = bd.[BookingCode]
    LEFT JOIN [dbo].[Fleet_Vehicles]     v  ON v.[Id] = bd.[VehicleId]
    LEFT JOIN [dbo].[Fleet_VehicleTypes] vt ON vt.[Id] = v.[TypeId]
    LEFT JOIN [dbo].[Fleet_Drivers]      d  ON d.[Id] = bd.[DriverId]
    WHERE
        -- Date ranges checking based on dynamic leg dates
        CAST(CASE WHEN bd.[BookingCodeNo] LIKE '%-2' THEN b.[ReturnTime] ELSE b.[DepartureTime] END AS DATE) <= @DateTo
        AND CAST(CASE WHEN bd.[BookingCodeNo] LIKE '%-2' THEN b.[ReturnTime] ELSE b.[DepartureTime] END AS DATE) >= @DateFrom
        AND (@VehicleId IS NULL OR bd.[VehicleId] = @VehicleId)
        AND (@DriverId IS NULL OR bd.[DriverId] = @DriverId)
        AND (@Status IS NULL OR b.[Status] = @Status)
        AND b.[Status] NOT IN (N'Đã hủy', N'Từ chối', N'Giám sát từ chối', N'Team Admin từ chối')
    ORDER BY CASE WHEN bd.[BookingCodeNo] LIKE '%-2' THEN b.[ReturnTime] ELSE b.[DepartureTime] END ASC;
END;
GO

-- =========================================================================
-- 3. Detail Stored Procedure (dual recordset structure)
-- =========================================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_Booking_GetDetail]
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @BookingCode NVARCHAR(30);
    SELECT @BookingCode = [BookingCode] FROM [dbo].[Fleet_Bookings] WHERE [Id] = @Id;

    -- Recordset 1: Master joined with first leg (-1) for legacy backwards compatibility
    SELECT
        b.[Id], b.[BookingCode], b.[ParentBookingCode], b.[RequesterMNV], b.[RequesterName], b.[RequesterEmail],
        b.[RequesterDept], b.[DepartureTime], b.[ReturnTime], b.[Purpose], b.[Status],
        b.[AssignedNote], b.[ApprovedBy], b.[ApprovedAt],
        b.[RejectedReason], b.[CancelledReason], b.[CompletedAt],
        b.[CreatedAt], b.[UpdatedAt],
        
        -- Joined fields from first leg (-1)
        bd.[PickupLocation], bd.[Destination], bd.[Stops], bd.[PassengerCount], bd.[Priority], bd.[VehicleType],
        bd.[Attendees], bd.[AttendeesEmail], bd.[Notes],
        bd.[VehicleId], v.[PlateNumber] AS VehiclePlate, v.[Brand] AS VehicleBrand,
        v.[Model] AS VehicleModel, v.[Seats] AS VehicleSeats, v.[Color] AS VehicleColor,
        bd.[DriverId], d.[FullName] AS DriverName, d.[Phone] AS DriverPhone,
        d.[LicenseClass] AS DriverLicenseClass
    FROM [dbo].[Fleet_Bookings] b
    LEFT JOIN [dbo].[Fleet_BookingsDetailed] bd ON bd.[BookingCode] = b.[BookingCode] AND bd.[BookingCodeNo] = b.[BookingCode] + '-1'
    LEFT JOIN [dbo].[Fleet_Vehicles] v ON v.[Id] = bd.[VehicleId]
    LEFT JOIN [dbo].[Fleet_Drivers]  d ON d.[Id] = bd.[DriverId]
    WHERE b.[Id] = @Id;

    -- Recordset 2: Detailed legs
    SELECT
        bd.[Id], bd.[BookingCode], bd.[BookingCodeNo],
        bd.[PickupLocation], bd.[Destination], bd.[Stops],
        bd.[PassengerCount], bd.[Priority], bd.[VehicleType],
        bd.[Attendees], bd.[AttendeesEmail], bd.[Notes],
        bd.[VehicleId], v.[PlateNumber] AS VehiclePlate, v.[Brand] AS VehicleBrand,
        v.[Model] AS VehicleModel, v.[Seats] AS VehicleSeats, v.[Color] AS VehicleColor,
        bd.[DriverId], d.[FullName] AS DriverName, d.[Phone] AS DriverPhone,
        d.[LicenseClass] AS DriverLicenseClass,
        bd.[CreatedAt], bd.[UpdatedAt]
    FROM [dbo].[Fleet_BookingsDetailed] bd
    LEFT JOIN [dbo].[Fleet_Vehicles] v ON v.[Id] = bd.[VehicleId]
    LEFT JOIN [dbo].[Fleet_Drivers]  d ON d.[Id] = bd.[DriverId]
    WHERE bd.[BookingCode] = @BookingCode
    ORDER BY bd.[BookingCodeNo] ASC;
END;
GO

-- =========================================================================
-- 4. Dashboard List Stored Procedure
-- =========================================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_Booking_List]
    @SearchText    NVARCHAR(200)  = NULL,
    @Status        NVARCHAR(50)   = NULL,
    @RequesterMNV  NVARCHAR(50)   = NULL,
    @DateFrom      DATE           = NULL,
    @DateTo        DATE           = NULL,
    @PageNumber    INT            = 1,
    @PageSize      INT            = 20
AS
BEGIN
    SET NOCOUNT ON;

    -- Resolve ManagerEmail
    DECLARE @ManagerEmail NVARCHAR(200) = NULL;
    IF @RequesterMNV IS NOT NULL
    BEGIN
        SELECT TOP 1 @ManagerEmail = Email FROM [dbo].[CSR_Employees] WHERE [MNV] = @RequesterMNV;
    END

    -- Count total
    SELECT COUNT(*) AS TotalCount
    FROM [dbo].[Fleet_Bookings] b
    LEFT JOIN [dbo].[Fleet_BookingsDetailed] bd ON bd.[BookingCode] = b.[BookingCode] AND bd.[BookingCodeNo] = b.[BookingCode] + '-1'
    WHERE
        (@SearchText IS NULL OR
            b.[BookingCode] LIKE '%' + @SearchText + '%' OR
            b.[RequesterName] LIKE '%' + @SearchText + '%' OR
            bd.[Destination] LIKE '%' + @SearchText + '%' OR
            bd.[PickupLocation] LIKE '%' + @SearchText + '%'
        )
        AND (@Status IS NULL OR b.[Status] = @Status)
        AND (
            @RequesterMNV IS NULL 
            OR b.[RequesterMNV] = @RequesterMNV 
            OR (@ManagerEmail IS NOT NULL AND b.[RequesterMNV] IN (
                SELECT [MNV] FROM [dbo].[CSR_Employees] WHERE [ManagerEmail] = @ManagerEmail
            ))
        )
        AND (@DateFrom IS NULL OR CAST(b.[DepartureTime] AS DATE) >= @DateFrom)
        AND (@DateTo   IS NULL OR CAST(b.[DepartureTime] AS DATE) <= @DateTo);

    -- Select page rows
    SELECT
        b.[Id], b.[BookingCode], b.[ParentBookingCode], b.[RequesterMNV], b.[RequesterName], b.[RequesterEmail],
        b.[RequesterDept], b.[DepartureTime], b.[ReturnTime], b.[Purpose], b.[Status],
        b.[ApprovedBy], b.[ApprovedAt],
        b.[RejectedReason], b.[CancelledReason],
        b.[CreatedAt], b.[UpdatedAt],
        
        -- Primary details from departure leg (-1)
        bd.[PickupLocation], bd.[Destination], bd.[PassengerCount], bd.[Priority], bd.[VehicleType],
        bd.[Attendees], bd.[AttendeesEmail], bd.[Notes],
        v.[PlateNumber] AS VehiclePlate, v.[Brand] AS VehicleBrand, v.[Model] AS VehicleModel,
        d.[FullName] AS DriverName, d.[Phone] AS DriverPhone
    FROM [dbo].[Fleet_Bookings] b
    LEFT JOIN [dbo].[Fleet_BookingsDetailed] bd ON bd.[BookingCode] = b.[BookingCode] AND bd.[BookingCodeNo] = b.[BookingCode] + '-1'
    LEFT JOIN [dbo].[Fleet_Vehicles] v ON v.[Id] = bd.[VehicleId]
    LEFT JOIN [dbo].[Fleet_Drivers]  d ON d.[Id] = bd.[DriverId]
    WHERE
        (@SearchText IS NULL OR
            b.[BookingCode] LIKE '%' + @SearchText + '%' OR
            b.[RequesterName] LIKE '%' + @SearchText + '%' OR
            bd.[Destination] LIKE '%' + @SearchText + '%' OR
            bd.[PickupLocation] LIKE '%' + @SearchText + '%'
        )
        AND (@Status IS NULL OR b.[Status] = @Status)
        AND (
            @RequesterMNV IS NULL 
            OR b.[RequesterMNV] = @RequesterMNV 
            OR (@ManagerEmail IS NOT NULL AND b.[RequesterMNV] IN (
                SELECT [MNV] FROM [dbo].[CSR_Employees] WHERE [ManagerEmail] = @ManagerEmail
            ))
        )
        AND (@DateFrom IS NULL OR CAST(b.[DepartureTime] AS DATE) >= @DateFrom)
        AND (@DateTo   IS NULL OR CAST(b.[DepartureTime] AS DATE) <= @DateTo)
    ORDER BY b.[CreatedAt] DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END;
GO

-- usp_Fleet_Booking_Update: áp dụng đúng cùng logic auto-approve như trên
CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_Booking_Update]
    @Id              INT,
    @RequesterMNV    NVARCHAR(50)   = NULL,
    @RequesterName   NVARCHAR(200),
    @RequesterEmail  NVARCHAR(200)  = NULL,
    @RequesterDept   NVARCHAR(200)  = NULL,
    @DepartureTime   DATETIME,
    @ReturnTime      DATETIME       = NULL,
    @Purpose         NVARCHAR(1000),
    @PickupLocation  NVARCHAR(500),
    @Destination     NVARCHAR(500),
    @Stops           NVARCHAR(MAX)  = NULL,
    @PassengerCount  INT            = 1,
    @Priority        NVARCHAR(20)   = N'Bình thường',
    @VehicleType     NVARCHAR(100)  = N'Xe công ty',
    @Attendees       NVARCHAR(MAX)  = NULL,
    @AttendeesEmail  NVARCHAR(MAX)  = NULL,
    @Notes           NVARCHAR(1000) = NULL,
    @VehicleId       INT            = NULL,
    @DriverId        INT            = NULL,
    @ReturnStops          NVARCHAR(MAX)  = NULL,
    @ReturnPassengerCount INT            = 1,
    @ReturnPriority       NVARCHAR(20)   = N'Bình thường',
    @ReturnVehicleType    NVARCHAR(100)  = N'Xe công ty',
    @ReturnAttendees      NVARCHAR(MAX)  = NULL,
    @ReturnAttendeesEmail NVARCHAR(MAX)  = NULL,
    @ReturnNotes          NVARCHAR(1000) = NULL,
    @ReturnVehicleId      INT            = NULL,
    @ReturnDriverId       INT            = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        DECLARE @OldCode NVARCHAR(30);
        SELECT @OldCode = [BookingCode] FROM [dbo].[Fleet_Bookings] WHERE [Id] = @Id;
        IF @OldCode IS NULL
            THROW 50002, N'Booking không tồn tại', 1;

        UPDATE [dbo].[Fleet_Bookings]
        SET [Status] = N'Đã chỉnh sửa', [UpdatedAt] = GETDATE()
        WHERE [Id] = @Id;

        DECLARE @Year CHAR(4) = CAST(YEAR(GETDATE()) AS CHAR(4));
        DECLARE @Seq INT;
        SELECT @Seq = COUNT(*) + 1
        FROM [dbo].[Fleet_Bookings]
        WHERE YEAR([CreatedAt]) = YEAR(GETDATE());
        DECLARE @NewCode NVARCHAR(30) = 'VE-' + @Year + '-' + RIGHT('0000' + CAST(@Seq AS NVARCHAR), 4);

        -- Auto-approve: cùng logic với usp_Fleet_Booking_Create (xét đủ cả 2 chặng)
        DECLARE @InitStatus NVARCHAR(50) = N'Chờ phản hồi';
        IF (@Priority = N'VIP' AND @VehicleId IS NOT NULL)
           AND (@ReturnTime IS NULL OR (@ReturnPriority = N'VIP' AND @ReturnVehicleId IS NOT NULL))
        BEGIN
            SET @InitStatus = N'Team Admin đã duyệt';
        END

        INSERT INTO [dbo].[Fleet_Bookings]
            ([BookingCode], [ParentBookingCode], [RequesterMNV], [RequesterName], [RequesterEmail], [RequesterDept],
             [DepartureTime], [ReturnTime], [Purpose], [Status], [ApprovedBy], [ApprovedAt])
        VALUES
            (@NewCode, @OldCode, @RequesterMNV, @RequesterName, @RequesterEmail, @RequesterDept,
             @DepartureTime, @ReturnTime, @Purpose, @InitStatus,
             CASE WHEN @InitStatus = N'Team Admin đã duyệt' THEN @RequesterName ELSE NULL END,
             CASE WHEN @InitStatus = N'Team Admin đã duyệt' THEN GETDATE() ELSE NULL END);

        DECLARE @NewId INT = SCOPE_IDENTITY();

        INSERT INTO [dbo].[Fleet_BookingsDetailed]
            ([BookingCode], [BookingCodeNo], [PickupLocation], [Destination], [Stops],
             [PassengerCount], [Priority], [VehicleId], [DriverId], [Notes],
             [Attendees], [AttendeesEmail], [VehicleType])
        VALUES
            (@NewCode, @NewCode + '-1', @PickupLocation, @Destination, @Stops,
             @PassengerCount, @Priority, @VehicleId, @DriverId, @Notes,
             @Attendees, @AttendeesEmail, @VehicleType);

        IF @ReturnTime IS NOT NULL
        BEGIN
            INSERT INTO [dbo].[Fleet_BookingsDetailed]
                ([BookingCode], [BookingCodeNo], [PickupLocation], [Destination], [Stops],
                 [PassengerCount], [Priority], [VehicleId], [DriverId], [Notes],
                 [Attendees], [AttendeesEmail], [VehicleType])
            VALUES
                (@NewCode, @NewCode + '-2', @Destination, @PickupLocation, @ReturnStops,
                 @ReturnPassengerCount, @ReturnPriority, @ReturnVehicleId, @ReturnDriverId, @ReturnNotes,
                 @ReturnAttendees, @ReturnAttendeesEmail, @ReturnVehicleType);
        END

        SELECT @NewId AS Id, @NewCode AS BookingCode, @InitStatus AS Status;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- =========================================================================
-- 5. Status / Approval Update Stored Procedure (with copy history logic)
-- =========================================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_Booking_UpdateStatus]
    @Id                    INT,
    @NewStatus             NVARCHAR(50),
    @ActorName             NVARCHAR(200) = NULL,
    
    -- Departure Leg assignments
    @VehicleId             INT           = NULL,
    @DriverId              INT           = NULL,
    @AssignedNote          NVARCHAR(1000) = NULL,
    
    -- Return Leg assignments
    @ReturnVehicleId       INT           = NULL,
    @ReturnDriverId        INT           = NULL,
    @ReturnAssignedNote    NVARCHAR(1000) = NULL,
    
    -- Other
    @RejectedReason        NVARCHAR(1000) = NULL,
    @CancelledReason       NVARCHAR(1000) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        DECLARE @OldStatus NVARCHAR(50);
        DECLARE @OldCode NVARCHAR(30);
        SELECT @OldStatus = [Status], @OldCode = [BookingCode] FROM [dbo].[Fleet_Bookings] WHERE [Id] = @Id;

        IF @OldStatus IS NULL
            THROW 50001, N'Booking không tồn tại', 1;

        -- Guard state validations
        IF @NewStatus = N'Giám sát đã duyệt' AND @OldStatus <> N'Chờ phản hồi'
            THROW 50002, N'Booking đã được xử lý trước đó, không thể duyệt lại (Giám sát).', 1;
        IF @NewStatus = N'Giám sát từ chối' AND @OldStatus <> N'Chờ phản hồi'
            THROW 50002, N'Booking đã được xử lý trước đó, không thể từ chối lại (Giám sát).', 1;
        IF @NewStatus = N'Team Admin đã duyệt' AND @OldStatus <> N'Giám sát đã duyệt'
            THROW 50002, N'Booking chưa được Giám sát duyệt hoặc đã được xử lý trước đó.', 1;
        IF @NewStatus = N'Team Admin từ chối' AND @OldStatus <> N'Giám sát đã duyệt'
            THROW 50002, N'Booking chưa được Giám sát duyệt hoặc đã được xử lý trước đó.', 1;

        -- Handling cancellation "đẻ ra BookingCode mới"
        IF @NewStatus = N'Đã hủy'
        BEGIN
            -- Generate new BookingCode
            DECLARE @Year CHAR(4) = CAST(YEAR(GETDATE()) AS CHAR(4));
            DECLARE @Seq INT;
            SELECT @Seq = COUNT(*) + 1 FROM [dbo].[Fleet_Bookings] WHERE YEAR([CreatedAt]) = YEAR(GETDATE());
            DECLARE @NewCode NVARCHAR(30) = 'VE-' + @Year + '-' + RIGHT('0000' + CAST(@Seq AS NVARCHAR), 4);

            -- Get details of old booking
            DECLARE @ReqMNV NVARCHAR(50), @ReqName NVARCHAR(200), @ReqEmail NVARCHAR(200), @ReqDept NVARCHAR(200);
            DECLARE @DepTime DATETIME, @RetTime DATETIME, @Purp NVARCHAR(1000);
            SELECT 
                @ReqMNV = [RequesterMNV], @ReqName = [RequesterName], 
                @ReqEmail = [RequesterEmail], @ReqDept = [RequesterDept], @DepTime = [DepartureTime], 
                @RetTime = [ReturnTime], @Purp = [Purpose]
            FROM [dbo].[Fleet_Bookings]
            WHERE [Id] = @Id;

            -- Create new Master Booking with status 'Đã hủy'
            INSERT INTO [dbo].[Fleet_Bookings]
                ([BookingCode], [ParentBookingCode], [RequesterMNV], [RequesterName], [RequesterEmail], [RequesterDept],
                 [DepartureTime], [ReturnTime], [Purpose], [Status], [CancelledReason], [ApprovedBy], [ApprovedAt])
            VALUES
                (@NewCode, @OldCode, @ReqMNV, @ReqName, @ReqEmail, @ReqDept,
                 @DepTime, @RetTime, @Purp, N'Đã hủy', @CancelledReason, @ActorName, GETDATE());

            -- Duplicate legs from old to new BookingCode
            INSERT INTO [dbo].[Fleet_BookingsDetailed]
                ([BookingCode], [BookingCodeNo], [PickupLocation], [Destination], [Stops], [PassengerCount], [Priority],
                 [VehicleId], [DriverId], [Notes], [Attendees], [AttendeesEmail], [VehicleType], [CreatedAt], [UpdatedAt])
            SELECT
                @NewCode,
                REPLACE([BookingCodeNo], @OldCode, @NewCode),
                [PickupLocation], [Destination], [Stops], [PassengerCount], [Priority],
                [VehicleId], [DriverId], [Notes], [Attendees], [AttendeesEmail], [VehicleType], GETDATE(), GETDATE()
            FROM [dbo].[Fleet_BookingsDetailed]
            WHERE [BookingCode] = @OldCode;

            -- Update status of old booking to Đã hủy
            UPDATE [dbo].[Fleet_Bookings]
            SET [Status] = N'Đã hủy', [CancelledReason] = @CancelledReason, [UpdatedAt] = GETDATE()
            WHERE [Id] = @Id;

            COMMIT TRANSACTION;
            
            -- Call GetDetail SP on the new booking to return full result
            EXEC [dbo].[usp_Fleet_Booking_GetDetail] @Id = @Id; -- Return old/updated row or we can execute a simple select for compatibility
            RETURN;
        END

        -- Normal status updates (Approvals / Rejections)
        UPDATE [dbo].[Fleet_Bookings]
        SET
            [Status]          = @NewStatus,
            [UpdatedAt]       = GETDATE(),
            [AssignedNote]    = CASE WHEN @NewStatus = N'Team Admin đã duyệt' THEN @AssignedNote ELSE [AssignedNote] END,
            [ApprovedBy]      = CASE WHEN @NewStatus = N'Team Admin đã duyệt' THEN @ActorName    ELSE [ApprovedBy]   END,
            [ApprovedAt]      = CASE WHEN @NewStatus = N'Team Admin đã duyệt' THEN GETDATE()     ELSE [ApprovedAt]   END,
            [RejectedReason]  = CASE WHEN @NewStatus IN (N'Từ chối', N'Giám sát từ chối', N'Team Admin từ chối') THEN @RejectedReason ELSE [RejectedReason] END,
            [CompletedAt]     = CASE WHEN @NewStatus = N'Hoàn thành' THEN GETDATE()   ELSE [CompletedAt]  END
        WHERE [Id] = @Id;

        -- Update Departure Leg (-1) details
        IF @NewStatus = N'Team Admin đã duyệt'
        BEGIN
            UPDATE [dbo].[Fleet_BookingsDetailed]
            SET
                [VehicleId] = ISNULL(@VehicleId, [VehicleId]),
                [DriverId]  = ISNULL(@DriverId, [DriverId]),
                [Notes]     = @AssignedNote,
                [UpdatedAt] = GETDATE()
            WHERE [BookingCode] = @OldCode AND [BookingCodeNo] = @OldCode + '-1';

            -- Update Return Leg (-2) details if return leg exists
            IF EXISTS (SELECT 1 FROM [dbo].[Fleet_BookingsDetailed] WHERE [BookingCode] = @OldCode AND [BookingCodeNo] = @OldCode + '-2')
            BEGIN
                UPDATE [dbo].[Fleet_BookingsDetailed]
                SET
                    [VehicleId] = ISNULL(@ReturnVehicleId, [VehicleId]),
                    [DriverId]  = ISNULL(@ReturnDriverId, [DriverId]),
                    [Notes]     = @ReturnAssignedNote,
                    [UpdatedAt] = GETDATE()
                WHERE [BookingCode] = @OldCode AND [BookingCodeNo] = @OldCode + '-2';
            END
        END

        COMMIT TRANSACTION;

        -- Return full updated details
        EXEC [dbo].[usp_Fleet_Booking_GetDetail] @Id = @Id;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- SP: Lay danh sach tai xe
CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_Driver_List]
    @IsActive BIT = NULL,
    @Status   NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [Id],[FullName],[Phone],[LicenseNumber],[LicenseClass],[Status],[Notes],[IsActive],[CreatedAt],[UpdatedAt]
    FROM [dbo].[Fleet_Drivers]
    WHERE (@IsActive IS NULL OR [IsActive] = @IsActive)
      AND (@Status   IS NULL OR [Status]   = @Status)
    ORDER BY [FullName];
END
GO

-- SP: Luu thong tin tai xe
CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_Driver_Save]
    @Id             INT,
    @FullName       NVARCHAR(200),
    @Phone          NVARCHAR(20)  = NULL,
    @LicenseNumber  NVARCHAR(50)  = NULL,
    @LicenseClass   NVARCHAR(10)  = NULL,
    @Status         NVARCHAR(50)  = N'Sẵn sàng',
    @Notes          NVARCHAR(1000) = NULL,
    @IsActive       BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    IF @Id = 0
    BEGIN
        INSERT INTO [dbo].[Fleet_Drivers] ([FullName],[Phone],[LicenseNumber],[LicenseClass],[Status],[Notes],[IsActive])
        VALUES (@FullName,@Phone,@LicenseNumber,@LicenseClass,@Status,@Notes,@IsActive);
        SELECT SCOPE_IDENTITY() AS Id;
    END
    ELSE
    BEGIN
        UPDATE [dbo].[Fleet_Drivers]
        SET [FullName]=@FullName,[Phone]=@Phone,[LicenseNumber]=@LicenseNumber,
            [LicenseClass]=@LicenseClass,[Status]=@Status,[Notes]=@Notes,
            [IsActive]=@IsActive,[UpdatedAt]=GETDATE()
        WHERE [Id]=@Id;
        SELECT @Id AS Id;
    END
END
GO

-- 2. SP: Upsert Driver by Phone or FullName
CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_Driver_Upsert]
    @FullName       NVARCHAR(200),
    @Phone          NVARCHAR(20)  = NULL,
    @LicenseNumber  NVARCHAR(50)  = NULL,
    @LicenseClass   NVARCHAR(10)  = NULL,
    @Status         NVARCHAR(50)  = N'Sẵn sàng',
    @Notes          NVARCHAR(1000) = NULL,
    @IsActive       BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @ExistingId INT = NULL;

    -- Try to match by Phone first
    IF @Phone IS NOT NULL AND LTRIM(RTRIM(@Phone)) <> ''
    BEGIN
        SELECT TOP 1 @ExistingId = [Id] FROM [dbo].[Fleet_Drivers] WHERE [Phone] = LTRIM(RTRIM(@Phone));
    END

    -- Fallback to match by FullName if not matched by Phone
    IF @ExistingId IS NULL
    BEGIN
        SELECT TOP 1 @ExistingId = [Id] FROM [dbo].[Fleet_Drivers] WHERE [FullName] = LTRIM(RTRIM(@FullName));
    END

    IF @ExistingId IS NULL
    BEGIN
        INSERT INTO [dbo].[Fleet_Drivers] ([FullName],[Phone],[LicenseNumber],[LicenseClass],[Status],[Notes],[IsActive])
        VALUES (LTRIM(RTRIM(@FullName)),@Phone,@LicenseNumber,@LicenseClass,@Status,@Notes,@IsActive);
        SELECT SCOPE_IDENTITY() AS Id;
    END
    ELSE
    BEGIN
        UPDATE [dbo].[Fleet_Drivers]
        SET [FullName]=LTRIM(RTRIM(@FullName)),[Phone]=@Phone,[LicenseNumber]=@LicenseNumber,
            [LicenseClass]=@LicenseClass,[Status]=@Status,[Notes]=@Notes,
            [IsActive]=@IsActive,[UpdatedAt]=GETDATE()
        WHERE [Id]=@ExistingId;
        SELECT @ExistingId AS Id;
    END
END
GO

-- 2. Create new stored procedure filtering by TeamAdmin role
CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_GetTeamAdminEmails]
AS
BEGIN
    SET NOCOUNT ON;
    SELECT DISTINCT Email
    FROM [dbo].[CSR_Users]
    WHERE [Role] = 'TeamAdmin'
      AND [StatusId] = 1
      AND [Email] IS NOT NULL
      AND [Email] <> '';
END
GO

-- SP: Lay danh sach xe
CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_Vehicle_List]
    @IsActive BIT = NULL,
    @Status   NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        v.[Id], v.[PlateNumber], v.[Brand], v.[Model],
        v.[TypeId], t.[TypeName],
        v.[Seats], v.[Color], v.[FuelType],
        v.[Status], v.[Notes], v.[IsActive],
        v.[CreatedAt], v.[UpdatedAt]
    FROM [dbo].[Fleet_Vehicles] v
    LEFT JOIN [dbo].[Fleet_VehicleTypes] t ON t.[Id] = v.[TypeId]
    WHERE (@IsActive IS NULL OR v.[IsActive] = @IsActive)
      AND (@Status   IS NULL OR v.[Status]   = @Status)
    ORDER BY v.[PlateNumber];
END
GO

-- SP: Luu thong tin xe
CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_Vehicle_Save]
    @Id          INT,
    @PlateNumber NVARCHAR(20),
    @Brand       NVARCHAR(100),
    @Model       NVARCHAR(100) = NULL,
    @TypeId      INT = NULL,
    @Seats       INT = 4,
    @Color       NVARCHAR(50) = NULL,
    @FuelType    NVARCHAR(50) = N'Xăng',
    @Status      NVARCHAR(50) = N'Sẵn sàng',
    @Notes       NVARCHAR(1000) = NULL,
    @IsActive    BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    IF @Id = 0
    BEGIN
        INSERT INTO [dbo].[Fleet_Vehicles]
            ([PlateNumber],[Brand],[Model],[TypeId],[Seats],[Color],[FuelType],[Status],[Notes],[IsActive])
        VALUES
            (@PlateNumber,@Brand,@Model,@TypeId,@Seats,@Color,@FuelType,@Status,@Notes,@IsActive);
        SELECT SCOPE_IDENTITY() AS Id;
    END
    ELSE
    BEGIN
        UPDATE [dbo].[Fleet_Vehicles]
        SET [PlateNumber]=@PlateNumber,[Brand]=@Brand,[Model]=@Model,[TypeId]=@TypeId,
            [Seats]=@Seats,[Color]=@Color,[FuelType]=@FuelType,[Status]=@Status,
            [Notes]=@Notes,[IsActive]=@IsActive,[UpdatedAt]=GETDATE()
        WHERE [Id]=@Id;
        SELECT @Id AS Id;
    END
END
GO

-- 1. SP: Upsert Vehicle by PlateNumber
CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_Vehicle_UpsertByPlate]
    @PlateNumber NVARCHAR(20),
    @Brand       NVARCHAR(100),
    @Model       NVARCHAR(100) = NULL,
    @TypeName    NVARCHAR(100) = NULL,
    @Seats       INT = 4,
    @Color       NVARCHAR(50) = NULL,
    @FuelType    NVARCHAR(50) = N'Xăng',
    @Status      NVARCHAR(50) = N'Sẵn sàng',
    @Notes       NVARCHAR(1000) = NULL,
    @IsActive    BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @TypeId INT = NULL;

    -- Lookup TypeId if TypeName is provided
    IF @TypeName IS NOT NULL AND LTRIM(RTRIM(@TypeName)) <> ''
    BEGIN
        SELECT TOP 1 @TypeId = [Id] FROM [dbo].[Fleet_VehicleTypes] WHERE [TypeName] = LTRIM(RTRIM(@TypeName));
        
        -- If vehicle type doesn't exist, create it automatically
        IF @TypeId IS NULL
        BEGIN
            INSERT INTO [dbo].[Fleet_VehicleTypes] ([TypeName], [Description], [IsActive])
            VALUES (LTRIM(RTRIM(@TypeName)), N'Tự động tạo từ import Excel', 1);
            SET @TypeId = SCOPE_IDENTITY();
        END
    END

    -- Check if PlateNumber already exists
    DECLARE @ExistingId INT = NULL;
    SELECT @ExistingId = [Id] FROM [dbo].[Fleet_Vehicles] WHERE [PlateNumber] = LTRIM(RTRIM(@PlateNumber));

    IF @ExistingId IS NULL
    BEGIN
        INSERT INTO [dbo].[Fleet_Vehicles]
            ([PlateNumber],[Brand],[Model],[TypeId],[Seats],[Color],[FuelType],[Status],[Notes],[IsActive])
        VALUES
            (LTRIM(RTRIM(@PlateNumber)),@Brand,@Model,@TypeId,@Seats,@Color,@FuelType,@Status,@Notes,@IsActive);
        SELECT SCOPE_IDENTITY() AS Id;
    END
    ELSE
    BEGIN
        UPDATE [dbo].[Fleet_Vehicles]
        SET [Brand]=@Brand,[Model]=@Model,[TypeId]=@TypeId,
            [Seats]=@Seats,[Color]=@Color,[FuelType]=@FuelType,[Status]=@Status,
            [Notes]=@Notes,[IsActive]=@IsActive,[UpdatedAt]=GETDATE()
        WHERE [Id]=@ExistingId;
        SELECT @ExistingId AS Id;
    END
END
GO

-- ============================================================
-- SECTION 3: STORED PROCEDURES
-- ============================================================

-- SP: Lay danh sach loai xe
CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_VehicleType_List]
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [Id], [TypeName], [Description], [IsActive], [CreatedAt]
    FROM [dbo].[Fleet_VehicleTypes]
    ORDER BY [TypeName];
END
GO

-- SP: Luu loai xe (them moi / cap nhat)
CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_VehicleType_Save]
    @Id          INT,
    @TypeName    NVARCHAR(100),
    @Description NVARCHAR(500) = NULL,
    @IsActive    BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    IF @Id = 0
    BEGIN
        INSERT INTO [dbo].[Fleet_VehicleTypes] ([TypeName], [Description], [IsActive])
        VALUES (@TypeName, @Description, @IsActive);
        SELECT SCOPE_IDENTITY() AS Id;
    END
    ELSE
    BEGIN
        UPDATE [dbo].[Fleet_VehicleTypes]
        SET [TypeName] = @TypeName, [Description] = @Description, [IsActive] = @IsActive
        WHERE [Id] = @Id;
        SELECT @Id AS Id;
    END
END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_GetAllUsers]
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [UserId] AS [Id], [MNV], [FullName], [Email], [Role], [Department], [StatusId],
           CAST(CASE WHEN [StatusId] = 1 THEN 1 ELSE 0 END AS BIT) AS [IsActive]
    FROM [dbo].[CSR_Users]
    ORDER BY [FullName] ASC;
END
GO

-- 3. Stored Procedure doc internetMessageId cua email approval goc
CREATE OR ALTER PROCEDURE [dbo].[usp_GetApprovalEmailMessageId]
    @ParentId NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP 1 [ApprovalEmailMessageId]
    FROM [dbo].[CSR_Projects]
    WHERE ([ParentId] = @ParentId OR [Project_id] = @ParentId)
      AND [ApprovalEmailMessageId] IS NOT NULL
    ORDER BY [Version] ASC;
END
GO

-- ============================================================
-- SP: usp_GetApprovalLogs
-- Lấy lịch sử phê duyệt của 1 đơn
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_GetApprovalLogs]
    @ProjectId  NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        [Id], [ProjectId], [Action], [ActorMNV], [ActorName],
        [Reason], [OldStatus], [NewStatus], [CreatedAt]
    FROM [dbo].[CSR_ApprovalLogs]
    WHERE [ProjectId] = @ProjectId
    ORDER BY [CreatedAt] DESC;
END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_GetAuditLogs]
    @MNV NVARCHAR(50) = NULL,
    @Department NVARCHAR(100) = NULL,
    @Role NVARCHAR(50) = NULL,
    @Action NVARCHAR(100) = NULL,
    @StartDate DATETIME = NULL,
    @EndDate DATETIME = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [Id], [Action], [MNV], [Role], [Department], [Details], [SubmissionId], [CreatedAt]
    FROM [dbo].[CSR_AuditLogs]
    WHERE (@MNV IS NULL OR [MNV] = @MNV)
      AND (@Department IS NULL OR [Department] = @Department)
      AND (@Role IS NULL OR [Role] = @Role)
      AND (@Action IS NULL OR [Action] = @Action)
      AND (@StartDate IS NULL OR [CreatedAt] >= @StartDate)
      AND (@EndDate IS NULL OR [CreatedAt] <= @EndDate)
    ORDER BY [CreatedAt] DESC;
END
GO

-- B. usp_GetConfigList
CREATE OR ALTER PROCEDURE [dbo].[usp_GetConfigList]
    @Category NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 
        [Id], [Category], [Name], [Email], [JsonData], [StatusId],
        CAST(CASE WHEN [StatusId] = 1 THEN 1 ELSE 0 END AS BIT) AS [IsActive]
    FROM [dbo].[CSR_ConfigLists]
    WHERE (@Category IS NULL OR [Category] = @Category)
    ORDER BY [Category], [Name];
END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_GetCustomerConfigReps]
    @Category NVARCHAR(50),
    @Name     NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [Id], [JsonData], [StatusId]
    FROM [dbo].[CSR_ConfigLists]
    WHERE [Category] = @Category AND [Name] = @Name;
END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_GetDinnerRestaurants]
AS
BEGIN
    SET NOCOUNT ON;

    -- Recordset 0: Danh sách nhà hàng tối
    SELECT 
        c.Id, c.Category, c.Name, c.Email, c.JsonData,
        CASE WHEN c.StatusId = 1 THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS IsActive,
        UsageCount = (SELECT COUNT(DISTINCT t.Project_id) FROM CSR_Tasks t WHERE t.Destination = c.Name AND t.StatusId = 1),
        AvgRating = (
            SELECT ROUND(AVG(CAST(r.Rating AS FLOAT)), 1)
            FROM CSR_Reviews r
            INNER JOIN CSR_ReviewCriteria rc ON r.CriteriaId = rc.Id
            INNER JOIN CSR_Tasks t ON t.Project_id = r.ProjectId AND t.StatusId = 1
            WHERE rc.CriteriaGroup = N'Ăn uống' AND t.Destination = c.Name
        ),
        ReviewCount = (
            SELECT COUNT(r.Id)
            FROM CSR_Reviews r
            INNER JOIN CSR_ReviewCriteria rc ON r.CriteriaId = rc.Id
            INNER JOIN CSR_Tasks t ON t.Project_id = r.ProjectId AND t.StatusId = 1
            WHERE rc.CriteriaGroup = N'Ăn uống' AND t.Destination = c.Name
        )
    FROM CSR_ConfigLists c
    WHERE c.Category = 'DinnerRestaurant'
    ORDER BY c.Name;

    -- Recordset 1: Bình luận, đánh giá của các nhà hàng
    SELECT 
        t.Destination AS RestaurantName,
        r.Comment,
        r.Rating,
        r.ReviewerName,
        r.CreatedAt
    FROM CSR_Reviews r
    INNER JOIN CSR_ReviewCriteria rc ON r.CriteriaId = rc.Id
    INNER JOIN CSR_Tasks t ON t.Project_id = r.ProjectId AND t.StatusId = 1
    WHERE rc.CriteriaGroup = N'Ăn uống' AND r.Comment IS NOT NULL AND r.Comment != ''
    ORDER BY r.CreatedAt DESC;
END
GO

-- ============================================================
-- 3. usp_GetEvaluationCriteriaIds — Lấy danh sách Id tiêu chí theo FormId
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_GetEvaluationCriteriaIds]
    @FormId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [Id] 
    FROM [dbo].[CSR_ReviewCriteria] 
    WHERE [FormId] = @FormId;
END
GO

-- ============================================================
-- 2. usp_GetEvaluationFormDetail — Lấy chi tiết form đánh giá và tiêu chí
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_GetEvaluationFormDetail]
    @FormId INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Recordset 0: Thông tin biểu mẫu
    SELECT * 
    FROM [dbo].[CSR_EvaluationForms] 
    WHERE [Id] = @FormId;

    -- Recordset 1: Danh sách tiêu chí sắp xếp theo thứ tự hiển thị
    SELECT * 
    FROM [dbo].[CSR_ReviewCriteria] 
    WHERE [FormId] = @FormId 
    ORDER BY [SortOrder] ASC;
END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_GetEvaluationForms]
    @SearchText NVARCHAR(200) = NULL,
    @IsActive   BIT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 
        f.[Id], f.[FormName], f.[SendToCustomer], f.[SendToPrd], f.[SendToSubmitter], f.[SendToBod],
        CASE WHEN f.[StatusId] = 1 THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS [IsActive],
        f.[CreatedAt], f.[UpdatedAt],
        CriteriaCount = (SELECT COUNT(*) FROM [dbo].[CSR_ReviewCriteria] WHERE [FormId] = f.[Id])
    FROM [dbo].[CSR_EvaluationForms] f
    WHERE (@SearchText IS NULL OR f.[FormName] LIKE '%' + @SearchText + '%')
      AND (@IsActive IS NULL OR (@IsActive = 1 AND f.[StatusId] = 1) OR (@IsActive = 0 AND f.[StatusId] <> 1))
    ORDER BY f.[FormName] ASC;
END
GO

-- 1. usp_GetFilterOptions
CREATE OR ALTER PROCEDURE [dbo].[usp_GetFilterOptions]
AS
BEGIN
    SET NOCOUNT ON;

    -- 1. Năm tạo đơn
    SELECT DISTINCT YEAR([CreatedAt]) AS [Year]
    FROM [dbo].[CSR_Projects]
    WHERE [RecordType] = 1
    ORDER BY [Year] DESC;

    -- 2. Tháng trong năm (1-12)
    SELECT [Id] AS [Month], [Name] AS [MonthName]
    FROM (
                                                                                                    SELECT 1 AS [Id], N'Tháng 1' AS [Name]
        UNION
            SELECT 2, N'Tháng 2'
        UNION
            SELECT 3, N'Tháng 3'
        UNION
            SELECT 4, N'Tháng 4'
        UNION
            SELECT 5, N'Tháng 5'
        UNION
            SELECT 6, N'Tháng 6'
        UNION
            SELECT 7, N'Tháng 7'
        UNION
            SELECT 8, N'Tháng 8'
        UNION
            SELECT 9, N'Tháng 9'
        UNION
            SELECT 10, N'Tháng 10'
        UNION
            SELECT 11, N'Tháng 11'
        UNION
            SELECT 12, N'Tháng 12'
    ) m
    ORDER BY [Id];

    -- 3. Tuần trong năm (1-53)
    SELECT DISTINCT DATEPART(WEEK, t.[OnboardDate]) AS [Week]
    FROM [dbo].[CSR_Tasks] t
    WHERE t.[StatusId] = 1
    ORDER BY [Week] ASC;

    -- 4. Loại khách hàng (CustomerType)
    SELECT DISTINCT [CustomerType]
    FROM [dbo].[CSR_Projects]
    WHERE [CustomerType] IS NOT NULL AND [CustomerType] != '' AND [RecordType] = 1;

    -- 5. Tên khách hàng (CustomerName)
    SELECT DISTINCT [CustomerName]
    FROM [dbo].[CSR_Projects]
    WHERE [CustomerName] IS NOT NULL AND [CustomerName] != '' AND [RecordType] = 1;

    -- 6. Địa điểm tiếp đón (Destination)
    SELECT DISTINCT [Destination]
    FROM [dbo].[CSR_Tasks]
    WHERE [Destination] IS NOT NULL AND [Destination] != '' AND [StatusId] = 1;

    -- 7. Bộ phận phụ trách (Bộ phận của Assignee - lấy từ CSR_Employees)
    SELECT DISTINCT COALESCE(e.[Department], N'Chưa phân loại') AS [Department]
    FROM [dbo].[CSR_Tasks] t
        LEFT JOIN [dbo].[CSR_Employees] e ON t.[AssigneeEmail] = e.[Email]
    WHERE t.[StatusId] = 1;

    -- 8. Trạng thái dự án (Status)
    SELECT DISTINCT s.[TenTrangThai] AS [Status]
    FROM [dbo].[CSR_Projects] p
        INNER JOIN [dbo].[CSR_Statuses] s ON p.[StatusId] = s.[Id]
    WHERE p.[RecordType] = 1;
END;
GO

-- 1. Định nghĩa lại usp_GetGuestCalendar
CREATE OR ALTER PROCEDURE [dbo].[usp_GetGuestCalendar]
    @StartDate NVARCHAR(10),
    @EndDate   NVARCHAR(10)
AS
BEGIN
    SET NOCOUNT ON;

    -- Tự động cập nhật trạng thái Hoàn thành trước khi truy vấn (áp dụng cho phiên bản mới nhất của đơn có Task)
    ;WITH LatestVersions AS (
        SELECT [Project_id], ROW_NUMBER() OVER (PARTITION BY [ParentId] ORDER BY [Version] DESC) as rn
        FROM [dbo].[CSR_Projects]
    )
    UPDATE p
    SET p.[StatusId] = 7, p.[UpdatedAt] = GETDATE() -- 7 is Hoàn thành
    FROM [dbo].[CSR_Projects] p
    INNER JOIN LatestVersions lv ON p.[Project_id] = lv.[Project_id] AND lv.rn = 1
    WHERE p.[StatusId] = 5 -- 5 is BOD đã duyệt
        AND p.[RecordType] IN (1, 2)
        AND NOT EXISTS (
            SELECT 1
            FROM [dbo].[CSR_Tasks] t
            WHERE t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1
              AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)
        )
        AND EXISTS (
            SELECT 1
            FROM [dbo].[CSR_Tasks] t
            WHERE t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1
        );

    -- Lấy thông tin ngày/địa điểm từ phiên bản mới nhất của đơn
    ;WITH LatestProjects AS (
        SELECT p.*
        FROM [dbo].[CSR_Projects] p
        INNER JOIN (
            SELECT [Project_id], ROW_NUMBER() OVER (PARTITION BY [ParentId] ORDER BY [Version] DESC) as rn
            FROM [dbo].[CSR_Projects]
        ) lv ON p.[Project_id] = lv.[Project_id] AND lv.rn = 1
    ),
    DateDest AS (
        -- Đơn có Task
        SELECT
            p.[Project_id],
            t.[OnboardDate] AS [VisitDate],
            t.[Destination] COLLATE DATABASE_DEFAULT AS [Destination]
        FROM LatestProjects p
            INNER JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1

        UNION ALL

        -- Đơn KHÔNG có Task (lấy từ AgendaJsonData)
        SELECT
            p.[Project_id],
            TRY_CAST(j.[VisitDateStr] AS DATE) AS [VisitDate],
            d.[key] COLLATE DATABASE_DEFAULT AS [Destination]
        FROM LatestProjects p
            CROSS APPLY OPENJSON(p.[AgendaJsonData])
                WITH ([VisitDateStr] NVARCHAR(20) '$.date', [agenda] NVARCHAR(MAX) '$.agenda' AS JSON) j
            CROSS APPLY OPENJSON(j.[agenda]) d
        WHERE p.[AgendaJsonData] IS NOT NULL
            AND NOT EXISTS (
                SELECT 1
                FROM [dbo].[CSR_Tasks] t2
                WHERE t2.[Project_id] = p.[Project_id]
            )
    )
    SELECT DISTINCT
        p.[Project_id],
        p.[CustomerName],
        p.[CustomerType],
        p.[MeetingTopic],
        p.[SubmitterName],
        s.TenTrangThai AS [Status],
        p.[CreatedAt],
        CONVERT(NVARCHAR(10), dd.[VisitDate], 23) AS OnboardDate,
        dd.[Destination]
    FROM LatestProjects p
        INNER JOIN [dbo].[CSR_Statuses] s ON p.[StatusId] = s.[Id]
        INNER JOIN DateDest dd ON dd.[Project_id] = p.[Project_id]
    WHERE p.[StatusId] IN (8, 4, 5, 7) -- Chờ phản hồi (8), PRD đã duyệt (4), BOD đã duyệt (5), Hoàn thành (7)
        AND dd.[VisitDate] IS NOT NULL
        AND CONVERT(NVARCHAR(10), dd.[VisitDate], 23) >= @StartDate
        AND CONVERT(NVARCHAR(10), dd.[VisitDate], 23) <= @EndDate
    ORDER BY CONVERT(NVARCHAR(10), dd.[VisitDate], 23) ASC, p.[Project_id] ASC;
END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_GetLocations]
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [Id], [Name], [NotificationEmails], [StatusId],
           CAST(CASE WHEN [StatusId] = 1 THEN 1 ELSE 0 END AS BIT) AS [IsActive]
    FROM [dbo].[CSR_Locations]
    ORDER BY [Name] ASC;
END
GO

-- 2. Cap nhat stored procedure usp_GetMenuPermissionsMatrix de khong tra ve cot Icon
CREATE OR ALTER PROCEDURE [dbo].[usp_GetMenuPermissionsMatrix]
AS
BEGIN
    SET NOCOUNT ON;

    SELECT m.[Id], m.[ParentId], m.[MenuKey], m.[MenuName], m.[Path], m.[SortOrder], m.[IsActive]
    FROM [dbo].[CSR_Menus] m
    ORDER BY m.[SortOrder];

    SELECT [MenuId], [Role]
    FROM [dbo].[CSR_RolePermissions];
END
GO

-- 1. Cap nhat stored procedure usp_GetMyMenu de khong tra ve cot Icon
CREATE OR ALTER PROCEDURE [dbo].[usp_GetMyMenu]
    @Role NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Neu la Admin, tra ve toan bo menu dang hoat dong ma khong can check bang phan quyen
    IF @Role = 'Admin'
    BEGIN
        SELECT [Id], [ParentId], [MenuKey], [MenuName], [Path], [SortOrder]
        FROM [dbo].[CSR_Menus]
        WHERE [IsActive] = 1
        ORDER BY [SortOrder];
    END
    ELSE
    BEGIN
        SELECT DISTINCT m.[Id], m.[ParentId], m.[MenuKey], m.[MenuName], m.[Path], m.[SortOrder]
        FROM [dbo].[CSR_Menus] m
            INNER JOIN [dbo].[CSR_RolePermissions] rp ON rp.[MenuId] = m.[Id]
        WHERE rp.[Role] = @Role AND m.[IsActive] = 1
        ORDER BY m.[SortOrder];
    END
END
GO

-- ============================================================
-- 6. notifications.js — 2 inline queries
-- ============================================================

-- 6a. GET /notifications
CREATE OR ALTER PROCEDURE [dbo].[usp_GetNotifications]
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP 50 *
    FROM [dbo].[CSR_Notifications]
    ORDER BY [CreatedAt] DESC;
END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_GetPRDUsersEmails]
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [Email] 
    FROM [dbo].[CSR_Users] 
    WHERE [Role] = 'PRD' AND [StatusId] = 1;
END
GO

-- 1c. PUT /submissions/:projectId — lấy thông tin gốc để edit
CREATE OR ALTER PROCEDURE [dbo].[usp_GetProjectForEdit]
    @ProjectId NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        stt.[TenTrangThai] as [Status],
        StatusId,
        [ParentId],
        [Version],
        [SubmitterName],
        [SubmitterEmail],
        [SubmitterMNV],
        [CustomerType],
        [CustomerName]
    FROM [dbo].[CSR_Projects] a
    LEFT JOIN CSR_Statuses AS stt ON a.StatusId = stt.Id
    WHERE [Project_id] = @ProjectId;
END
GO

-- 1f. syncNewCustomerReps — lấy info dự án để sync
CREATE OR ALTER PROCEDURE [dbo].[usp_GetProjectForSync]
    @ProjectId NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [CustomerType], [CustomerName], [GuestReps]
    FROM [dbo].[CSR_Projects]
    WHERE [Project_id] = @ProjectId;
END
GO

-- 1e. POST /submissions/:projectId/approve — lấy thông tin gửi Teams card (khi PRD duyệt)
CREATE OR ALTER PROCEDURE [dbo].[usp_GetProjectForTeams]
    @ProjectId NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [Project_id], [SubmitterName], [CustomerName], [MeetingTopic]
    FROM [dbo].[CSR_Projects]
    WHERE [Project_id] = @ProjectId;
END
GO

-- 1b. GET /submissions/:projectId/history — lấy toàn bộ lịch sử theo ParentId
CREATE OR ALTER PROCEDURE [dbo].[usp_GetProjectHistory]
    @ParentId NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        p.[Project_id],
        p.[RecordType],
        p.[Version],
        s.TenTrangThai AS [Status],
        p.[CreatedAt],
        p.[UpdatedAt],
        p.[MeetingTopic],
        p.[SubmitterName],
        p.[CustomerName]
    FROM [dbo].[CSR_Projects] p
    INNER JOIN [dbo].[CSR_Statuses] s ON p.[StatusId] = s.[Id]
    WHERE p.[ParentId] = @ParentId
    ORDER BY p.[Version] DESC;
END
GO

-- ============================================================
-- 1. submissions.js — inline queries
-- ============================================================

-- 1a. GET /submissions/:projectId/history — lấy ParentId
CREATE OR ALTER PROCEDURE [dbo].[usp_GetProjectParentId]
    @ProjectId NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT ISNULL([ParentId], @ProjectId) AS [ParentId]
    FROM [dbo].[CSR_Projects]
    WHERE [Project_id] = @ProjectId;
END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_GetProjectReviews]
    @ProjectId NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT r.[Id], r.[ProjectId], r.[CriteriaId], c.[CriteriaName], c.[CriteriaGroup], 
           r.[Rating], r.[Comment], r.[ReviewerName], r.[CreatedAt]
    FROM [dbo].[CSR_Reviews] r
    INNER JOIN [dbo].[CSR_ReviewCriteria] c ON r.[CriteriaId] = c.[Id]
    WHERE r.[ProjectId] = @ProjectId
    ORDER BY c.[SortOrder] ASC;
END
GO

-- Cập nhật stored procedure usp_GetProjectStatus để đọc tên trạng thái từ bảng CSR_Statuses thay vì cột Status đã bị xóa
CREATE OR ALTER PROCEDURE [dbo].[usp_GetProjectStatus]
    @ProjectId NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT s.TenTrangThai AS [Status]
    FROM [dbo].[CSR_Projects] p
    INNER JOIN [dbo].[CSR_Statuses] s ON p.StatusId = s.Id
    WHERE p.[Project_id] = @ProjectId;
END
GO

-- 4. usp_GetReportsProgress
CREATE OR ALTER PROCEDURE [dbo].[usp_GetReportsProgress]
    @Year NVARCHAR(500) = NULL,
    @Month NVARCHAR(500) = NULL,
    @Week NVARCHAR(500) = NULL,
    @CustomerType NVARCHAR(MAX) = NULL,
    @CustomerName NVARCHAR(MAX) = NULL,
    @Destination NVARCHAR(MAX) = NULL,
    @Department NVARCHAR(MAX) = NULL,
    @ProjectStatus NVARCHAR(500) = NULL,
    @TaskStatus NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Tạo bảng tạm lọc danh sách Project
    SELECT DISTINCT p.[Project_id], p.[CustomerName], p.[SubmitterMNV], p.[CreatedAt]
    INTO #FilteredProjects
    FROM [dbo].[CSR_Projects] p
        INNER JOIN [dbo].[CSR_Statuses] s ON p.[StatusId] = s.[Id]
        LEFT JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1
        LEFT JOIN [dbo].[CSR_Employees] e ON p.[SubmitterMNV] = e.[MNV]
    WHERE p.[RecordType] = 1
        AND p.[StatusId] != 9 -- Khác Đã huỷ
        AND (@Year IS NULL OR @Year = '' OR YEAR(p.[CreatedAt]) IN (SELECT CAST(value AS INT)
        FROM STRING_SPLIT(@Year, ',')))
        AND (@Month IS NULL OR @Month = '' OR MONTH(p.[CreatedAt]) IN (SELECT CAST(value AS INT)
        FROM STRING_SPLIT(@Month, ',')))
        AND (@Week IS NULL OR @Week = '' OR DATEPART(WEEK, p.[CreatedAt]) IN (SELECT CAST(value AS INT)
        FROM STRING_SPLIT(@Week, ',')))
        AND (@CustomerType IS NULL OR @CustomerType = '' OR p.[CustomerType] IN (SELECT value
        FROM STRING_SPLIT(@CustomerType, ',')))
        AND (@CustomerName IS NULL OR @CustomerName = '' OR p.[CustomerName] IN (SELECT value
        FROM STRING_SPLIT(@CustomerName, ',')))
        AND (@Destination IS NULL OR @Destination = '' OR t.[Destination] IN (SELECT value
        FROM STRING_SPLIT(@Destination, ',')))
        AND (@Department IS NULL OR @Department = '' OR e.[Department] IN (SELECT value
        FROM STRING_SPLIT(@Department, ',')))
        AND (@ProjectStatus IS NULL OR @ProjectStatus = '' OR (
          (CHARINDEX(N'Hoàn thành', @ProjectStatus) > 0 AND p.[StatusId] IN (5, 7))
        OR (CHARINDEX(N'Đang xử lý', @ProjectStatus) > 0 AND p.[StatusId] IN (4, 6, 10))
        OR (CHARINDEX(N'Chờ phản hồi', @ProjectStatus) > 0 AND p.[StatusId] = 8)
      ))
        AND (@TaskStatus IS NULL OR @TaskStatus = '' OR EXISTS (
          SELECT 1
        FROM STRING_SPLIT(@TaskStatus, ',')
        WHERE value = CASE 
              WHEN t.[TaskStatus] = N'Hoàn thành' OR t.[OnboardDate] < CAST(GETDATE() AS DATE) THEN N'Hoàn thành'
              WHEN t.[TaskStatus] = N'Đang xử lý' OR (t.[TaskStatus] != N'Hoàn thành' AND t.[DeadlineDate] >= CAST(GETDATE() AS DATE) AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)) THEN N'Đang xử lý'
              ELSE N'Delay'
          END
      ));

    -- Tạo bảng chứa thông tin task của các project đã lọc kèm Computed Status
    SELECT
        t.[Task_id],
        t.[Project_id],
        p.[CustomerName],
        t.[TaskName],
        t.[Destination],
        t.[Assignee],
        t.[DeadlineDate],
        ISNULL(e.[Department], N'Không xác định') AS [Department],
        CASE 
            WHEN t.[TaskStatus] = N'Hoàn thành' OR t.[OnboardDate] < CAST(GETDATE() AS DATE) THEN N'Hoàn thành'
            WHEN t.[TaskStatus] = N'Đang xử lý' OR (t.[TaskStatus] != N'Hoàn thành' AND t.[DeadlineDate] >= CAST(GETDATE() AS DATE) AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)) THEN N'Đang xử lý'
            ELSE N'Delay'
        END AS [ComputedStatus]
    INTO #FilteredTasks
    FROM [dbo].[CSR_Tasks] t
        INNER JOIN #FilteredProjects p ON t.[Project_id] = p.[Project_id]
        LEFT JOIN [dbo].[CSR_Employees] e ON t.[AssigneeEmail] = e.[Email]
    WHERE t.[StatusId] = 1;

    -- 1. Tiến độ gửi đơn tiếp đón: Ontime (gửi trước 7 ngày) vs Delay (trong vòng 7 ngày)
    -- Tính từ ngày làm đơn (CreatedAt) đến ngày tiếp đón (OnboardDate) đầu tiên của đơn đó
    SELECT
        SUM(CASE WHEN DATEDIFF(DAY, p.[CreatedAt], t.MinOnboardDate) >= 7 THEN 1 ELSE 0 END) AS [OntimeCount],
        SUM(CASE WHEN DATEDIFF(DAY, p.[CreatedAt], t.MinOnboardDate) < 7 THEN 1 ELSE 0 END) AS [DelayCount]
    FROM #FilteredProjects p
        INNER JOIN (
        SELECT [Project_id], MIN([OnboardDate]) AS MinOnboardDate
        FROM [dbo].[CSR_Tasks]
        WHERE [StatusId] = 1
        GROUP BY [Project_id]
    ) t ON p.[Project_id] = t.[Project_id];

    -- 2. Tiến độ công việc: Ontime (Hoàn thành + Đang xử lý) vs Delay (Trễ hạn)
    SELECT
        SUM(CASE WHEN [ComputedStatus] != N'Delay' THEN 1 ELSE 0 END) AS [OntimeCount],
        SUM(CASE WHEN [ComputedStatus] = N'Delay' THEN 1 ELSE 0 END) AS [DelayCount]
    FROM #FilteredTasks;

    -- 3. Tỉ lệ Ontime và Delay của các phòng ban (team)
    SELECT
        [Department],
        COUNT(*) AS [TotalTasks],
        SUM(CASE WHEN [ComputedStatus] != N'Delay' THEN 1 ELSE 0 END) AS [OntimeTasks],
        SUM(CASE WHEN [ComputedStatus] = N'Delay' THEN 1 ELSE 0 END) AS [DelayTasks],
        ROUND(SUM(CASE WHEN [ComputedStatus] != N'Delay' THEN 1.0 ELSE 0.0 END) * 100.0 / COUNT(*), 1) AS [OntimeRate],
        ROUND(SUM(CASE WHEN [ComputedStatus] = N'Delay' THEN 1.0 ELSE 0.0 END) * 100.0 / COUNT(*), 1) AS [DelayRate]
    FROM #FilteredTasks
    GROUP BY [Department]
    ORDER BY [OntimeRate] DESC;

    DROP TABLE #FilteredProjects;
    DROP TABLE #FilteredTasks;
END;
GO

-- 3. usp_GetReportsReview
CREATE OR ALTER PROCEDURE [dbo].[usp_GetReportsReview]
    @Year NVARCHAR(500) = NULL,
    @Month NVARCHAR(500) = NULL,
    @Week NVARCHAR(500) = NULL,
    @CustomerType NVARCHAR(MAX) = NULL,
    @CustomerName NVARCHAR(MAX) = NULL,
    @Destination NVARCHAR(MAX) = NULL,
    @Department NVARCHAR(MAX) = NULL,
    @ProjectStatus NVARCHAR(500) = NULL,
    @TaskStatus NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Tạo bảng tạm lọc danh sách Project
    SELECT DISTINCT p.[Project_id], p.[CustomerName], p.[SubmitterMNV]
    INTO #FilteredProjects
    FROM [dbo].[CSR_Projects] p
        INNER JOIN [dbo].[CSR_Statuses] s ON p.[StatusId] = s.[Id]
        LEFT JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1
        LEFT JOIN [dbo].[CSR_Employees] e ON p.[SubmitterMNV] = e.[MNV]
    WHERE p.[RecordType] = 1
        AND p.[StatusId] != 9 -- Khác Đã huỷ
        AND (@Year IS NULL OR @Year = '' OR YEAR(p.[CreatedAt]) IN (SELECT CAST(value AS INT)
        FROM STRING_SPLIT(@Year, ',')))
        AND (@Month IS NULL OR @Month = '' OR MONTH(p.[CreatedAt]) IN (SELECT CAST(value AS INT)
        FROM STRING_SPLIT(@Month, ',')))
        AND (@Week IS NULL OR @Week = '' OR DATEPART(WEEK, p.[CreatedAt]) IN (SELECT CAST(value AS INT)
        FROM STRING_SPLIT(@Week, ',')))
        AND (@CustomerType IS NULL OR @CustomerType = '' OR p.[CustomerType] IN (SELECT value
        FROM STRING_SPLIT(@CustomerType, ',')))
        AND (@CustomerName IS NULL OR @CustomerName = '' OR p.[CustomerName] IN (SELECT value
        FROM STRING_SPLIT(@CustomerName, ',')))
        AND (@Destination IS NULL OR @Destination = '' OR t.[Destination] IN (SELECT value
        FROM STRING_SPLIT(@Destination, ',')))
        AND (@Department IS NULL OR @Department = '' OR e.[Department] IN (SELECT value
        FROM STRING_SPLIT(@Department, ',')))
        AND (@ProjectStatus IS NULL OR @ProjectStatus = '' OR (
          (CHARINDEX(N'Hoàn thành', @ProjectStatus) > 0 AND p.[StatusId] IN (5, 7))
        OR (CHARINDEX(N'Đang xử lý', @ProjectStatus) > 0 AND p.[StatusId] IN (4, 6, 10))
        OR (CHARINDEX(N'Chờ phản hồi', @ProjectStatus) > 0 AND p.[StatusId] = 8)
      ))
        AND (@TaskStatus IS NULL OR @TaskStatus = '' OR EXISTS (
          SELECT 1
        FROM STRING_SPLIT(@TaskStatus, ',')
        WHERE value = CASE 
              WHEN t.[TaskStatus] = N'Hoàn thành' OR t.[OnboardDate] < CAST(GETDATE() AS DATE) THEN N'Hoàn thành'
              WHEN t.[TaskStatus] = N'Đang xử lý' OR (t.[TaskStatus] != N'Hoàn thành' AND t.[DeadlineDate] >= CAST(GETDATE() AS DATE) AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)) THEN N'Đang xử lý'
              ELSE N'Delay'
          END
      ));

    -- 1. Điểm đánh giá trung bình tổng thể
    SELECT
        ROUND(AVG(CAST(r.[Rating] AS FLOAT)), 2) AS [AverageRating],
        COUNT(r.[Id]) AS [TotalReviews],
        (
            SELECT TOP 1
            c.[CriteriaName]
        FROM [dbo].[CSR_Reviews] r2
            INNER JOIN #FilteredProjects f2 ON r2.[ProjectId] = f2.[Project_id]
            INNER JOIN [dbo].[CSR_ReviewCriteria] c ON r2.[CriteriaId] = c.[Id]
        GROUP BY c.[CriteriaName]
        ORDER BY AVG(CAST(r2.[Rating] AS FLOAT)) DESC, c.[CriteriaName]
        ) AS [TopCriteriaName],
        (
            SELECT TOP 1
            c.[CriteriaName]
        FROM [dbo].[CSR_Reviews] r2
            INNER JOIN #FilteredProjects f2 ON r2.[ProjectId] = f2.[Project_id]
            INNER JOIN [dbo].[CSR_ReviewCriteria] c ON r2.[CriteriaId] = c.[Id]
        GROUP BY c.[CriteriaName]
        ORDER BY AVG(CAST(r2.[Rating] AS FLOAT)) ASC, c.[CriteriaName]
        ) AS [BottomCriteriaName]
    FROM [dbo].[CSR_Reviews] r
        INNER JOIN #FilteredProjects p ON r.[ProjectId] = p.[Project_id];

    -- 2. Điểm trung bình theo từng tiêu chí (Để frontend xếp Top tiêu chí cao nhất và thấp nhất)
    SELECT
        c.[CriteriaName],
        c.[CriteriaGroup],
        ROUND(AVG(CAST(r.[Rating] AS FLOAT)), 2) AS [AverageRating]
    FROM [dbo].[CSR_Reviews] r
        INNER JOIN [dbo].[CSR_ReviewCriteria] c ON r.[CriteriaId] = c.[Id]
        INNER JOIN #FilteredProjects p ON r.[ProjectId] = p.[Project_id]
    GROUP BY c.[CriteriaName], c.[CriteriaGroup]
    ORDER BY [AverageRating] DESC;

    -- 3. Điểm trung bình theo địa điểm
    SELECT
        ISNULL(t.[Destination], N'Không xác định') AS [Destination],
        ROUND(AVG(CAST(r.[Rating] AS FLOAT)), 2) AS [AverageRating]
    FROM [dbo].[CSR_Reviews] r
        INNER JOIN #FilteredProjects p ON r.[ProjectId] = p.[Project_id]
        INNER JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1
    GROUP BY t.[Destination]
    ORDER BY [AverageRating] DESC;

    -- 4. Chi tiết các phản hồi / bình luận của khách hàng
    SELECT
        r.[Id],
        r.[ProjectId],
        p.[CustomerName],
        r.[ReviewerName],
        r.[Rating],
        r.[Comment],
        r.[CreatedAt],
        [OnboardDates] = STUFF((
            SELECT DISTINCT ', ' + CONVERT(NVARCHAR(10), t2.[OnboardDate], 103)
        FROM [dbo].[CSR_Tasks] t2
        WHERE t2.[Project_id] = p.[Project_id] AND t2.[StatusId] = 1
        FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'), 1, 2, ''),
        [Destinations] = STUFF((
            SELECT DISTINCT ', ' + t2.[Destination]
        FROM [dbo].[CSR_Tasks] t2
        WHERE t2.[Project_id] = p.[Project_id] AND t2.[StatusId] = 1
        FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'), 1, 2, '')
    FROM [dbo].[CSR_Reviews] r
        INNER JOIN #FilteredProjects pr ON r.[ProjectId] = pr.[Project_id]
        INNER JOIN [dbo].[CSR_Projects] p ON pr.[Project_id] = p.[Project_id]
    ORDER BY r.[CreatedAt] DESC;

    DROP TABLE #FilteredProjects;
END;
GO

-- 2. usp_GetReportsSummary
CREATE OR ALTER PROCEDURE [dbo].[usp_GetReportsSummary]
    @Year NVARCHAR(500) = NULL,
    @Month NVARCHAR(500) = NULL,
    @Week NVARCHAR(500) = NULL,
    @CustomerType NVARCHAR(MAX) = NULL,
    @CustomerName NVARCHAR(MAX) = NULL,
    @Destination NVARCHAR(MAX) = NULL,
    @Department NVARCHAR(MAX) = NULL,
    @ProjectStatus NVARCHAR(500) = NULL,
    @TaskStatus NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Lấy giá trị target đầu tiên để so sánh MoM/YoY nếu có truyền bộ lọc đơn lẻ, hoặc dùng ngày hiện tại làm mặc định
    DECLARE @TargetMonth INT = MONTH(GETDATE());
    DECLARE @TargetYear INT = YEAR(GETDATE());

    IF @Month IS NOT NULL AND @Month != '' AND CHARINDEX(',', @Month) = 0
        SET @TargetMonth = CAST(@Month AS INT);

    IF @Year IS NOT NULL AND @Year != '' AND CHARINDEX(',', @Year) = 0
        SET @TargetYear = CAST(@Year AS INT);

    -- Tạo bảng tạm lọc danh sách Project
    SELECT DISTINCT p.[Project_id], p.[SubmitDate], p.[CustomerType], p.[CustomerName],
        p.[SubmitterName], s.[TenTrangThai] AS [Status], p.[StatusId], p.[CreatedAt], p.[UpdatedAt], p.[SubmitterMNV]
    INTO #FilteredProjects
    FROM [dbo].[CSR_Projects] p
        INNER JOIN [dbo].[CSR_Statuses] s ON p.[StatusId] = s.[Id]
        LEFT JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1
        LEFT JOIN [dbo].[CSR_Employees] e ON p.[SubmitterMNV] = e.[MNV]
    WHERE p.[RecordType] = 1
        AND p.[StatusId] != 9 -- Khác Đã huỷ
        AND (@Year IS NULL OR @Year = '' OR YEAR(p.[CreatedAt]) IN (SELECT CAST(value AS INT)
        FROM STRING_SPLIT(@Year, ',')))
        AND (@Month IS NULL OR @Month = '' OR MONTH(p.[CreatedAt]) IN (SELECT CAST(value AS INT)
        FROM STRING_SPLIT(@Month, ',')))
        AND (@Week IS NULL OR @Week = '' OR DATEPART(WEEK, p.[CreatedAt]) IN (SELECT CAST(value AS INT)
        FROM STRING_SPLIT(@Week, ',')))
        AND (@CustomerType IS NULL OR @CustomerType = '' OR p.[CustomerType] IN (SELECT value
        FROM STRING_SPLIT(@CustomerType, ',')))
        AND (@CustomerName IS NULL OR @CustomerName = '' OR p.[CustomerName] IN (SELECT value
        FROM STRING_SPLIT(@CustomerName, ',')))
        AND (@Destination IS NULL OR @Destination = '' OR t.[Destination] IN (SELECT value
        FROM STRING_SPLIT(@Destination, ',')))
        AND (@Department IS NULL OR @Department = '' OR e.[Department] IN (SELECT value
        FROM STRING_SPLIT(@Department, ',')))
        -- Mapping trạng thái theo StatusId (bảng CSR_Statuses):
        -- Đang xử lý = StatusId 4 (PRD đã duyệt) hoặc 6 (BOD từ chối); Chờ phản hồi = StatusId 8; Hoàn thành = StatusId 7
        AND (@ProjectStatus IS NULL OR @ProjectStatus = '' OR (
          (CHARINDEX(N'Hoàn thành', @ProjectStatus) > 0 AND p.[StatusId] IN (5, 7))
        OR (CHARINDEX(N'Đang xử lý', @ProjectStatus) > 0 AND p.[StatusId] IN (4, 6, 10))
        OR (CHARINDEX(N'Chờ phản hồi', @ProjectStatus) > 0 AND p.[StatusId] = 8)
      ))
        AND (@TaskStatus IS NULL OR @TaskStatus = '' OR EXISTS (
          SELECT 1
        FROM STRING_SPLIT(@TaskStatus, ',')
        WHERE value = CASE 
              WHEN t.[TaskStatus] = N'Hoàn thành' OR t.[OnboardDate] < CAST(GETDATE() AS DATE) THEN N'Hoàn thành'
              WHEN t.[TaskStatus] = N'Đang xử lý' OR (t.[TaskStatus] != N'Hoàn thành' AND t.[DeadlineDate] >= CAST(GETDATE() AS DATE) AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)) THEN N'Đang xử lý'
              ELSE N'Delay'
          END
      ));

    -- KPI Cards (Cả % MoM và % YoY)
    DECLARE @CurrCount INT, @PrevMonthCount INT, @PrevYearCount INT;
    SELECT @CurrCount = COUNT(*)
    FROM #FilteredProjects;

    -- Đơn tháng trước (MoM)
    DECLARE @PrevMonth INT = CASE WHEN @TargetMonth = 1 THEN 12 ELSE @TargetMonth - 1 END;
    DECLARE @PrevMonthYear INT = CASE WHEN @TargetMonth = 1 THEN @TargetYear - 1 ELSE @TargetYear END;

    SELECT @PrevMonthCount = COUNT(DISTINCT p.[Project_id])
    FROM [dbo].[CSR_Projects] p
        LEFT JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1
        LEFT JOIN [dbo].[CSR_Employees] e ON p.[SubmitterMNV] = e.[MNV]
    WHERE p.[RecordType] = 1 AND p.[StatusId] != 9
        AND YEAR(p.[CreatedAt]) = @PrevMonthYear AND MONTH(p.[CreatedAt]) = @PrevMonth
        AND (@CustomerType IS NULL OR @CustomerType = '' OR p.[CustomerType] IN (SELECT value
        FROM STRING_SPLIT(@CustomerType, ',')))
        AND (@CustomerName IS NULL OR @CustomerName = '' OR p.[CustomerName] IN (SELECT value
        FROM STRING_SPLIT(@CustomerName, ',')))
        AND (@Destination IS NULL OR @Destination = '' OR t.[Destination] IN (SELECT value
        FROM STRING_SPLIT(@Destination, ',')))
        AND (@Department IS NULL OR @Department = '' OR e.[Department] IN (SELECT value
        FROM STRING_SPLIT(@Department, ',')));

    -- Đơn cùng kỳ năm trước (YoY)
    SELECT @PrevYearCount = COUNT(DISTINCT p.[Project_id])
    FROM [dbo].[CSR_Projects] p
        LEFT JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1
        LEFT JOIN [dbo].[CSR_Employees] e ON p.[SubmitterMNV] = e.[MNV]
    WHERE p.[RecordType] = 1 AND p.[StatusId] != 9
        AND YEAR(p.[CreatedAt]) = @TargetYear - 1 AND MONTH(p.[CreatedAt]) = @TargetMonth
        AND (@CustomerType IS NULL OR @CustomerType = '' OR p.[CustomerType] IN (SELECT value
        FROM STRING_SPLIT(@CustomerType, ',')))
        AND (@CustomerName IS NULL OR @CustomerName = '' OR p.[CustomerName] IN (SELECT value
        FROM STRING_SPLIT(@CustomerName, ',')))
        AND (@Destination IS NULL OR @Destination = '' OR t.[Destination] IN (SELECT value
        FROM STRING_SPLIT(@Destination, ',')))
        AND (@Department IS NULL OR @Department = '' OR e.[Department] IN (SELECT value
        FROM STRING_SPLIT(@Department, ',')));

    -- Rating trung bình kỳ hiện tại, MoM, YoY
    DECLARE @CurrRating FLOAT, @PrevMonthRating FLOAT, @PrevYearRating FLOAT;
    SELECT @CurrRating = AVG(CAST(r.[Rating] AS FLOAT))
    FROM [dbo].[CSR_Reviews] r
        INNER JOIN #FilteredProjects p ON r.[ProjectId] = p.[Project_id];

    SELECT @PrevMonthRating = AVG(CAST(r.[Rating] AS FLOAT))
    FROM [dbo].[CSR_Reviews] r
        INNER JOIN [dbo].[CSR_Projects] p ON r.[ProjectId] = p.[Project_id]
        LEFT JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1
        LEFT JOIN [dbo].[CSR_Employees] e ON p.[SubmitterMNV] = e.[MNV]
    WHERE p.[RecordType] = 1 AND p.[StatusId] != 9
        AND YEAR(p.[CreatedAt]) = @PrevMonthYear AND MONTH(p.[CreatedAt]) = @PrevMonth
        AND (@CustomerType IS NULL OR @CustomerType = '' OR p.[CustomerType] IN (SELECT value
        FROM STRING_SPLIT(@CustomerType, ',')))
        AND (@CustomerName IS NULL OR @CustomerName = '' OR p.[CustomerName] IN (SELECT value
        FROM STRING_SPLIT(@CustomerName, ',')))
        AND (@Destination IS NULL OR @Destination = '' OR t.[Destination] IN (SELECT value
        FROM STRING_SPLIT(@Destination, ',')))
        AND (@Department IS NULL OR @Department = '' OR e.[Department] IN (SELECT value
        FROM STRING_SPLIT(@Department, ',')));

    SELECT @PrevYearRating = AVG(CAST(r.[Rating] AS FLOAT))
    FROM [dbo].[CSR_Reviews] r
        INNER JOIN [dbo].[CSR_Projects] p ON r.[ProjectId] = p.[Project_id]
        LEFT JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1
        LEFT JOIN [dbo].[CSR_Employees] e ON p.[SubmitterMNV] = e.[MNV]
    WHERE p.[RecordType] = 1 AND p.[StatusId] != 9
        AND YEAR(p.[CreatedAt]) = @TargetYear - 1 AND MONTH(p.[CreatedAt]) = @TargetMonth
        AND (@CustomerType IS NULL OR @CustomerType = '' OR p.[CustomerType] IN (SELECT value
        FROM STRING_SPLIT(@CustomerType, ',')))
        AND (@CustomerName IS NULL OR @CustomerName = '' OR p.[CustomerName] IN (SELECT value
        FROM STRING_SPLIT(@CustomerName, ',')))
        AND (@Destination IS NULL OR @Destination = '' OR t.[Destination] IN (SELECT value
        FROM STRING_SPLIT(@Destination, ',')))
        AND (@Department IS NULL OR @Department = '' OR e.[Department] IN (SELECT value
        FROM STRING_SPLIT(@Department, ',')));

    -- Thống kê công việc chuẩn bị
    DECLARE @TotalTasks INT, @CompletedTasks INT, @ProcessingTasks INT, @DelayTasks INT;
    SELECT
        @TotalTasks = COUNT(*),
        @CompletedTasks = SUM(CASE WHEN [ComputedStatus] = N'Hoàn thành' THEN 1 ELSE 0 END),
        @ProcessingTasks = SUM(CASE WHEN [ComputedStatus] = N'Đang xử lý' THEN 1 ELSE 0 END),
        @DelayTasks = SUM(CASE WHEN [ComputedStatus] = N'Delay' THEN 1 ELSE 0 END)
    FROM (
        SELECT
            CASE 
                WHEN t.[TaskStatus] = N'Hoàn thành' OR t.[OnboardDate] < CAST(GETDATE() AS DATE) THEN N'Hoàn thành'
                WHEN t.[TaskStatus] = N'Đang xử lý' OR (t.[TaskStatus] != N'Hoàn thành' AND t.[DeadlineDate] >= CAST(GETDATE() AS DATE) AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)) THEN N'Đang xử lý'
                ELSE N'Delay'
            END AS [ComputedStatus]
        FROM [dbo].[CSR_Tasks] t
            INNER JOIN #FilteredProjects p ON t.[Project_id] = p.[Project_id]
        WHERE t.[StatusId] = 1
    ) t_status;

    -- Output 1: KPIs
    SELECT
        @CurrCount AS [TotalSubmissions],
        CASE WHEN @PrevMonthCount > 0 THEN ROUND((CAST(@CurrCount - @PrevMonthCount AS FLOAT) / @PrevMonthCount) * 100, 1) ELSE NULL END AS [TotalMoM],
        CASE WHEN @PrevYearCount > 0 THEN ROUND((CAST(@CurrCount - @PrevYearCount AS FLOAT) / @PrevYearCount) * 100, 1) ELSE NULL END AS [TotalYoY],

        ISNULL(SUM(CASE WHEN [StatusId] IN (5, 7) THEN 1 ELSE 0 END), 0) AS [CompletedSubmissions],
        ISNULL(SUM(CASE WHEN [StatusId] IN (4, 6, 10) THEN 1 ELSE 0 END), 0) AS [ProcessingSubmissions],
        ISNULL(SUM(CASE WHEN [StatusId] = 8 THEN 1 ELSE 0 END), 0) AS [PendingSubmissions],

        ROUND(ISNULL(@CurrRating, 0), 2) AS [AverageRating],
        CASE WHEN @PrevMonthRating > 0 THEN ROUND(((@CurrRating - @PrevMonthRating) / @PrevMonthRating) * 100, 1) ELSE NULL END AS [RatingMoM],
        CASE WHEN @PrevYearRating > 0 THEN ROUND(((@CurrRating - @PrevYearRating) / @PrevYearRating) * 100, 1) ELSE NULL END AS [RatingYoY],

        ISNULL(@TotalTasks, 0) AS [TotalTasks],
        ISNULL(@CompletedTasks, 0) AS [CompletedTasks],
        ISNULL(@ProcessingTasks, 0) AS [ProcessingTasks],
        ISNULL(@DelayTasks, 0) AS [DelayTasks]
    FROM #FilteredProjects;

    -- Output 2: Tổng số đơn tiếp đón chạy theo tình trạng đơn, trục Ox đi theo ngày tiếp đón
    -- LEFT JOIN (thay vì INNER JOIN) để không loại bỏ các đơn không phát sinh Task
    -- (VD: Partner, Supplier, Khách vãng lai, Ứng viên phỏng vấn — không bắt buộc có task).
    -- Với các đơn này, dùng ngày tạo đơn (CreatedAt) làm mốc trên trục Ox thay cho OnboardDate.
    SELECT
        CONVERT(NVARCHAR(10), ISNULL(t.[OnboardDate], CAST(p.[CreatedAt] AS DATE)), 23) AS [OnboardDate],
        SUM(CASE WHEN p.[StatusId] IN (5, 7) THEN 1 ELSE 0 END) AS [Completed],
        SUM(CASE WHEN p.[StatusId] IN (4, 6, 10) THEN 1 ELSE 0 END) AS [Processing],
        SUM(CASE WHEN p.[StatusId] = 8 THEN 1 ELSE 0 END) AS [Pending]
    FROM #FilteredProjects p
        LEFT JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1
    GROUP BY ISNULL(t.[OnboardDate], CAST(p.[CreatedAt] AS DATE))
    ORDER BY ISNULL(t.[OnboardDate], CAST(p.[CreatedAt] AS DATE)) ASC;

    -- Output 3: Tổng đơn tiếp đón từng phòng ban (Biểu đồ cột)
    SELECT
        ISNULL(e.[Department], N'Không xác định') AS [Department],
        COUNT(DISTINCT p.[Project_id]) AS [Total]
    FROM #FilteredProjects p
        LEFT JOIN [dbo].[CSR_Employees] e ON p.[SubmitterMNV] = e.[MNV]
    GROUP BY e.[Department]
    ORDER BY [Total] DESC;

    -- Output 4: Tổng đơn tiếp đón theo địa điểm (Biểu đồ thanh ngang)
    SELECT
        ISNULL(t.[Destination], N'Không xác định') AS [Destination],
        COUNT(DISTINCT p.[Project_id]) AS [Count]
    FROM #FilteredProjects p
        INNER JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1
    GROUP BY t.[Destination]
    ORDER BY [Count] DESC;

    -- Output 5: Tỷ lệ đơn tiếp đón theo tình trạng (Biểu đồ tròn)
    SELECT
        [Status],
        COUNT(*) AS [Count]
    FROM #FilteredProjects
    GROUP BY [Status]
    ORDER BY [Count] DESC;

    -- Output 6: Top khách hàng tiếp đón nhiều nhất và rating đánh giá trung bình
    SELECT TOP 10
        p.[CustomerName],
        p.[CustomerType],
        COUNT(DISTINCT p.[Project_id]) AS [VisitCount],
        ROUND(AVG(CAST(r.[Rating] AS FLOAT)), 2) AS [AverageRating]
    FROM #FilteredProjects p
        LEFT JOIN [dbo].[CSR_Reviews] r ON r.[ProjectId] = p.[Project_id]
    GROUP BY p.[CustomerName], p.[CustomerType]
    ORDER BY [VisitCount] DESC;

    -- Output 7: Chi tiết các đơn tiếp đón (Bảng)
    SELECT
        [Project_id],
        [CustomerName],
        [CustomerType],
        [MeetingTopic] = (SELECT TOP 1
            MeetingTopic
        FROM [dbo].[CSR_Projects]
        WHERE Project_id = p.Project_id),
        [SubmitterName],
        [Status],
        [CreatedAt],
        [OnboardDates] = STUFF((
            SELECT DISTINCT ', ' + CONVERT(NVARCHAR(10), t2.[OnboardDate], 103)
        FROM [dbo].[CSR_Tasks] t2
        WHERE t2.[Project_id] = p.[Project_id] AND t2.[StatusId] = 1
        FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'), 1, 2, '')
    FROM #FilteredProjects p
    ORDER BY p.[CreatedAt] DESC;

    DROP TABLE #FilteredProjects;
END;
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_GetReviewCriteria]
    @OnlyActive BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [Id], [CriteriaName], [Description], [CriteriaGroup], [SortOrder], [IsRequired], 
           CASE WHEN [StatusId] = 1 THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS [IsActive], 
           [CreatedAt]
    FROM [dbo].[CSR_ReviewCriteria]
    WHERE @OnlyActive = 0 OR [StatusId] = 1
    ORDER BY [SortOrder] ASC, [CriteriaGroup] ASC;
END
GO

-- L. usp_GetSubmission
CREATE OR ALTER PROCEDURE [dbo].[usp_GetSubmission]
    @ProjectId NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

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

CREATE OR ALTER PROCEDURE [dbo].[usp_GetSyncStatus]
      AS
      BEGIN
          SET NOCOUNT ON;

          -- Số nhân viên hiện có
          DECLARE @EmpCount INT;
          SELECT @EmpCount = COUNT(*) FROM [dbo].[CSR_Employees] WHERE [StatusId] = 1;

          -- Lần sync gần nhất
          SELECT TOP 1
              @EmpCount                   AS [EmployeeCount],
              [RowsAffected],
              [FileModifiedAt],
              [Message],
              [CreatedAt]                 AS [LastSyncAt],
              [Status]
          FROM [dbo].[CSR_SyncLog]
          WHERE [SyncType] = 'employees'
          ORDER BY [CreatedAt] DESC;
      END
GO

-- 1. usp_GetTaskManagement
CREATE OR ALTER PROCEDURE [dbo].[usp_GetTaskManagement]
    @ActorRole      NVARCHAR(50) = '',
    @ActorMNV       NVARCHAR(50) = '',
    @Department     NVARCHAR(MAX) = NULL,
    @Assignee       NVARCHAR(MAX) = NULL,
    @ProjectId      NVARCHAR(MAX) = NULL,
    @CustomerName   NVARCHAR(MAX) = NULL,
    @OnboardDate    NVARCHAR(MAX) = NULL,
    @Destination    NVARCHAR(MAX) = NULL
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
        e.[Department] AS [Department],
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
    WHERE t.[StatusId] = 1 -- thay thế IsActive = 1
      AND p.[StatusId] IN (5, 7) -- 5 = BOD đã duyệt, 7 = Hoàn thành (thay thế p.Status)
      AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR t.[AssigneeEmail] = @ActorEmail
          OR t.[SupervisorEmail] = @ActorEmail
          OR p.[SubmitterMNV] = @ActorMNV
      )
      AND (@Department IS NULL OR @Department = '' OR e.[Department] IN (SELECT value FROM STRING_SPLIT(@Department, ',')))
      AND (@Assignee IS NULL OR @Assignee = '' OR t.[Assignee] IN (SELECT value FROM STRING_SPLIT(@Assignee, ',')) OR t.[AssigneeEmail] IN (SELECT value FROM STRING_SPLIT(@Assignee, ',')))
      AND (@ProjectId IS NULL OR @ProjectId = '' OR p.[Project_id] IN (SELECT value FROM STRING_SPLIT(@ProjectId, ',')))
      AND (@CustomerName IS NULL OR @CustomerName = '' OR p.[CustomerName] IN (SELECT value FROM STRING_SPLIT(@CustomerName, ',')))
      AND (@OnboardDate IS NULL OR @OnboardDate = '' OR CONVERT(NVARCHAR(10), t.[OnboardDate], 23) IN (SELECT value FROM STRING_SPLIT(@OnboardDate, ',')))
      AND (@Destination IS NULL OR @Destination = '' OR t.[Destination] IN (SELECT value FROM STRING_SPLIT(@Destination, ',')))
    ORDER BY t.[OnboardDate] ASC, t.[DeadlineDate] ASC;
END;
GO

-- ============================================================
-- 8. Stored Procedures cho Task Notes
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_GetTaskNotes]
    @TaskId NVARCHAR(150)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [Id], [TaskId], [Content], [AuthorMNV], [AuthorName], [CreatedAt]
    FROM [dbo].[CSR_TaskNotes]
    WHERE [TaskId] = @TaskId
    ORDER BY [CreatedAt] DESC;
END
GO

CREATE OR ALTER PROCEDURE usp_GetUploadedFileById
                @Id INT
            AS
            BEGIN
                SET NOCOUNT ON;
                
                SELECT * FROM CSR_UploadedFiles WHERE id = @Id;
            END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_GetUserByMNV]
    @MNV NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [UserId] AS [Id], [MNV], [FullName], [Email], [Role], [Department], [StatusId],
           CAST(CASE WHEN [StatusId] = 1 THEN 1 ELSE 0 END AS BIT) AS [IsActive]
    FROM [dbo].[CSR_Users]
    WHERE [MNV] = @MNV;
END
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

CREATE OR ALTER PROCEDURE [dbo].[usp_InsertCustomerConfigReps]
    @Category NVARCHAR(50),
    @Name     NVARCHAR(200),
    @JsonData NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO [dbo].[CSR_ConfigLists] ([Category], [Name], [JsonData], [StatusId])
    VALUES (@Category, @Name, @JsonData, 1); -- 1 = Hoạt động (Active)
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

CREATE OR ALTER PROCEDURE usp_InsertUploadedFile
                @OriginalName NVARCHAR(255),
                @StoredName NVARCHAR(255),
                @FilePath NVARCHAR(MAX),
                @FileExtension NVARCHAR(50),
                @MimeType NVARCHAR(100),
                @FileSize BIGINT,
                @UploadedBy NVARCHAR(50) = NULL
            AS
            BEGIN
                SET NOCOUNT ON;

                INSERT INTO CSR_UploadedFiles 
                (original_name, stored_name, file_path, file_extension, mime_type, file_size, uploaded_by)
                OUTPUT INSERTED.id
                VALUES 
                (@OriginalName, @StoredName, @FilePath, @FileExtension, @MimeType, @FileSize, @UploadedBy);
            END
GO

-- 6b. PUT /notifications/mark-read
CREATE OR ALTER PROCEDURE [dbo].[usp_MarkNotificationsRead]
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE [dbo].[CSR_Notifications]
    SET [IsRead] = 1
    WHERE [IsRead] = 0;
END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_MenuPermission_Check]
    @Role NVARCHAR(50),
    @MenuKey NVARCHAR(100),
    @HasPermission INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    
    IF EXISTS (
        SELECT 1 
        FROM [dbo].[CSR_RolePermissions] rp
        INNER JOIN [dbo].[CSR_Menus] m ON rp.MenuId = m.Id
        WHERE rp.Role = @Role AND m.MenuKey = @MenuKey AND m.IsActive = 1
    )
    BEGIN
        SET @HasPermission = 1;
    END
    ELSE
    BEGIN
        SET @HasPermission = 0;
    END
END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_RejectSubmission]
    @ProjectId   NVARCHAR(100),
    @ActorRole   NVARCHAR(50)    = NULL,
    @ActorMNV    NVARCHAR(50)    = NULL,
    @ActorName   NVARCHAR(200)   = NULL,
    @ActorEmail  NVARCHAR(200)   = NULL,
    @Reason      NVARCHAR(MAX)   = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        DECLARE @CurrentStatusId INT;
        DECLARE @CurrentStatusName NVARCHAR(100);

        SELECT @CurrentStatusId = p.StatusId, @CurrentStatusName = s.TenTrangThai
    FROM [dbo].[CSR_Projects] p
        LEFT JOIN [dbo].[CSR_Statuses] s ON s.Id = p.StatusId
    WHERE p.[Project_id] = @ProjectId;

        IF @CurrentStatusId IS NULL
            RAISERROR(N'Không tìm thấy đơn: %s', 16, 1, @ProjectId);

        -- Map Actor Role -> StatusId mới trực tiếp (không lookup text)
        -- StatusId 8  = Chờ phản hồi (chờ PRD duyệt)
        -- StatusId 4  = PRD đã duyệt (chờ BOD duyệt)
        -- StatusId 6  = BOD từ chối
        -- StatusId 10 = PRD từ chối (thêm ở migration 67)
        DECLARE @NewStatusId INT;
        DECLARE @NewStatusName NVARCHAR(100);

        IF @ActorRole = N'PRD' AND @CurrentStatusId = 8
        BEGIN
        SET @NewStatusId = 10;
        -- PRD từ chối
        SET @NewStatusName = N'PRD từ chối';
    END
        ELSE IF @ActorRole = N'BOD' AND @CurrentStatusId = 4
        BEGIN
        SET @NewStatusId = 6;
        -- BOD từ chối
        SET @NewStatusName = N'BOD từ chối';
    END
        ELSE IF @ActorRole = N'Admin'
        BEGIN
        IF @CurrentStatusId = 8
            BEGIN
            SET @NewStatusId = 10;
            SET @NewStatusName = N'PRD từ chối';
        END
            ELSE IF @CurrentStatusId = 4
            BEGIN
            SET @NewStatusId = 6;
            SET @NewStatusName = N'BOD từ chối';
        END
            ELSE
                RAISERROR(N'Đơn này không ở trạng thái chờ duyệt. Không thể từ chối.', 16, 1);
    END
        ELSE
        BEGIN
        RAISERROR(N'Đơn này không ở trạng thái chờ duyệt. Không thể từ chối.', 16, 1);
    END

        UPDATE [dbo].[CSR_Projects]
        SET [StatusId] = @NewStatusId,
            [UpdatedAt] = GETDATE()
        WHERE [Project_id] = @ProjectId;

        INSERT INTO [dbo].[CSR_ApprovalLogs]
        ([ProjectId], [Action], [Role], [ActorMNV], [ActorName], [Reason], [OldStatus], [NewStatus])
    VALUES
        (@ProjectId, N'Reject', @ActorRole, @ActorMNV, @ActorName, @Reason, @CurrentStatusName, @NewStatusName);

        COMMIT TRANSACTION;
        SELECT @ProjectId AS [Project_id], @NewStatusName AS [NewStatus], N'Đã từ chối đơn thành công.' AS [Message];
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        DECLARE @Err NVARCHAR(500) = ERROR_MESSAGE();
        RAISERROR(@Err, 16, 1);
    END CATCH
END
GO

-- 2. Stored Procedure luu internetMessageId cua email approval goc
-- Luu theo ParentId de tat ca version cua cung 1 don dung chung 1 Message-ID
CREATE OR ALTER PROCEDURE [dbo].[usp_SaveApprovalEmailMessageId]
    @ParentId           NVARCHAR(100),
    @InternetMessageId  NVARCHAR(500)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE [dbo].[CSR_Projects]
    SET [ApprovalEmailMessageId] = @InternetMessageId
    WHERE [ParentId] = @ParentId
       OR ([ParentId] IS NULL AND [Project_id] = @ParentId);
END
GO

-- 1. usp_SearchEmployees
CREATE OR ALTER PROCEDURE [dbo].[usp_SearchEmployees]
    @Query      NVARCHAR(200) = '',
    @TopN       INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP (@TopN)
        [FullName], [Email], [MNV]
    FROM [dbo].[CSR_Employees]
    WHERE [StatusId] = 1 -- 1 = Hoạt động (thay thế IsActive = 1)
        AND (
            @Query = ''
            OR [FullName] LIKE '%' + @Query + '%'
            OR [Email]    LIKE '%' + @Query + '%'
        )
    ORDER BY
        CASE WHEN [FullName] LIKE @Query + '%' THEN 0 ELSE 1 END,
        [FullName];
END;
GO

-- 2. Định nghĩa lại usp_Submission_GetDetail
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
      AND p.[RecordType] IN (1, 2)
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

-- =========================================================================
-- 1. Update stored procedure: usp_Submission_List
-- =========================================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_Submission_List]
    @SearchText     NVARCHAR(200)   = '',
    @Status         NVARCHAR(50)    = '',
    @ActorRole      NVARCHAR(50)    = '',
    @ActorMNV       NVARCHAR(50)    = '',
    @PageNumber     INT             = 1,
    @PageSize       INT             = 20,
    @Tab            NVARCHAR(50)    = 'tracking'
AS
BEGIN
    SET NOCOUNT ON;

    -- Resolve ManagerEmail
    DECLARE @ManagerEmail NVARCHAR(200) = NULL;
    SELECT TOP 1 @ManagerEmail = Email FROM [dbo].[CSR_Employees] WHERE [MNV] = @ActorMNV;

    -- Auto complete eligible guest submissions
    UPDATE p
    SET p.[StatusId] = 7, p.[UpdatedAt] = GETDATE()
    FROM [dbo].[CSR_Projects] p
    WHERE p.[StatusId] = 5
      AND p.[RecordType] IN (1, 2)
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

    WITH LatestVersions AS (
        SELECT 
            [Project_id], 
            ROW_NUMBER() OVER (PARTITION BY [ParentId] ORDER BY [Version] DESC) as rn,
            MIN([CreatedAt]) OVER (PARTITION BY [ParentId]) as OriginalCreatedAt
        FROM [dbo].[vw_SubmissionSummary]
    )
    SELECT
        v.[Project_id], v.[ParentId], v.[RecordType], v.[Version], v.[SubmitDate], v.[CustomerType], v.[CustomerName],
        v.[SubmitterName], v.[MeetingTopic], v.[Status],
        lv.OriginalCreatedAt AS [CreatedAt],
        CASE 
            WHEN v.[RecordType] = 1 THEN v.[UpdatedAt]
            ELSE v.[CreatedAt] 
        END AS [UpdatedAt],
        v.[TotalDays], v.[OnboardDates], v.[Destinations], v.[TotalTasks], v.[UrgentTasks]
    FROM [dbo].[vw_SubmissionSummary] v
    INNER JOIN LatestVersions lv ON v.[Project_id] = lv.[Project_id] AND lv.rn = 1
    WHERE
        (
            -- User: only see own submissions or their managed employees' submissions
            (@ActorRole = 'User' AND (
                v.[SubmitterMNV] = @ActorMNV
                OR (@ManagerEmail IS NOT NULL AND v.[SubmitterEmail] IN (
                    SELECT Email FROM [dbo].[CSR_Employees] WHERE ManagerEmail = @ManagerEmail
                ))
            ))
            -- Other roles: see all
            OR (@ActorRole != 'User')
        )
        AND (@SearchText = '' OR [CustomerName] LIKE '%' + @SearchText + '%'
                         OR [SubmitterName] LIKE '%' + @SearchText + '%'
                         OR v.[Project_id]   LIKE '%' + @SearchText + '%')
        AND (@Status = '' OR [Status] = @Status)
        AND (
            -- Tab Theo dõi yêu cầu
            (@Tab = 'tracking' AND (
                (@ActorRole = 'BOD' AND [Status] = N'PRD đã duyệt')
                OR (@ActorRole != 'BOD' AND [Status] IN (N'Chờ phản hồi', N'PRD đã duyệt'))
            ))
            -- Tab Tra cứu yêu cầu
            OR (ISNULL(@Tab, '') != 'tracking' AND (
                -- Admin/PRD/TeamAdmin: see all
                (@ActorRole NOT IN ('BOD', 'User'))
                -- BOD: see own creations or those waiting/approved/rejected by BOD
                OR (@ActorRole = 'BOD' AND (
                    v.[SubmitterMNV] = @ActorMNV
                    OR [Status] IN (N'PRD đã duyệt', N'BOD đã duyệt', N'BOD từ chối', N'Hoàn thành')
                ))
                -- User: see own or managed employees'
                OR (@ActorRole = 'User' AND (
                    v.[SubmitterMNV] = @ActorMNV
                    OR (@ManagerEmail IS NOT NULL AND v.[SubmitterEmail] IN (
                        SELECT Email FROM [dbo].[CSR_Employees] WHERE ManagerEmail = @ManagerEmail
                    ))
                ))
            ))
        )
    ORDER BY lv.OriginalCreatedAt DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;

    -- Record count
    WITH LatestVersions AS (
        SELECT [Project_id], ROW_NUMBER() OVER (PARTITION BY [ParentId] ORDER BY [Version] DESC) as rn
        FROM [dbo].[vw_SubmissionSummary]
    )
    SELECT COUNT(*) AS [TotalCount]
    FROM [dbo].[vw_SubmissionSummary] v
    INNER JOIN LatestVersions lv ON v.[Project_id] = lv.[Project_id] AND lv.rn = 1
    WHERE
        (
            (@ActorRole = 'User' AND (
                v.[SubmitterMNV] = @ActorMNV
                OR (@ManagerEmail IS NOT NULL AND v.[SubmitterEmail] IN (
                    SELECT Email FROM [dbo].[CSR_Employees] WHERE ManagerEmail = @ManagerEmail
                ))
            ))
            OR (@ActorRole != 'User')
        )
        AND (@SearchText = '' OR [CustomerName] LIKE '%' + @SearchText + '%'
                         OR [SubmitterName] LIKE '%' + @SearchText + '%'
                         OR v.[Project_id]   LIKE '%' + @SearchText + '%')
        AND (@Status = '' OR [Status] = @Status)
        AND (
            (@Tab = 'tracking' AND (
                (@ActorRole = 'BOD' AND [Status] = N'PRD đã duyệt')
                OR (@ActorRole != 'BOD' AND [Status] IN (N'Chờ phản hồi', N'PRD đã duyệt'))
            ))
            OR (ISNULL(@Tab, '') != 'tracking' AND (
                (@ActorRole NOT IN ('BOD', 'User'))
                OR (@ActorRole = 'BOD' AND (
                    v.[SubmitterMNV] = @ActorMNV
                    OR [Status] IN (N'PRD đã duyệt', N'BOD đã duyệt', N'BOD từ chối', N'Hoàn thành')
                ))
                OR (@ActorRole = 'User' AND (
                    v.[SubmitterMNV] = @ActorMNV
                    OR (@ManagerEmail IS NOT NULL AND v.[SubmitterEmail] IN (
                        SELECT Email FROM [dbo].[CSR_Employees] WHERE ManagerEmail = @ManagerEmail
                    ))
                ))
            ))
        );
END;
GO

-- 3. Cập nhật Stored Procedure nộp phản hồi đánh giá
CREATE OR ALTER PROCEDURE [dbo].[usp_SubmitFeedback]
    @Token          NVARCHAR(128),
    @OverallRating  INT,
    @AnswersJson    NVARCHAR(MAX),
    @Comments       NVARCHAR(1000) = NULL,
    @VisitorName    NVARCHAR(200) = NULL,
    @ResponseId     NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        DECLARE @InvitationId INT;
        DECLARE @ProjectId NVARCHAR(100);
        DECLARE @Status NVARCHAR(50);
        DECLARE @ExpireDate DATETIME;

        SELECT 
            @InvitationId = Id,
            @ProjectId = ProjectId,
            @Status = [Status],
            @ExpireDate = ExpireDate
        FROM [dbo].[CSR_FeedbackInvitations]
        WHERE [Token] = @Token;

        -- Validate lại trạng thái và hạn dùng
        IF @InvitationId IS NULL
            RAISERROR(N'Mã xác thực không hợp lệ', 16, 1);
        
        IF @Status = N'Completed'
            RAISERROR(N'Đánh giá này đã được nộp trước đó', 16, 1);

        IF @Status = N'Cancelled'
            RAISERROR(N'Đường dẫn đánh giá này đã bị hủy bỏ', 16, 1);

        IF GETDATE() > @ExpireDate
            RAISERROR(N'Yêu cầu đánh giá đã hết hạn sử dụng', 16, 1);

        -- 1. Lưu kết quả thô vào CSR_FeedbackResponses
        INSERT INTO [dbo].[CSR_FeedbackResponses]
            ([InvitationId], [ProjectId], [OverallRating], [AnswersJson], [Comments], [SubmittedAt])
        VALUES
            (@InvitationId, @ProjectId, @OverallRating, @AnswersJson, @Comments, GETDATE());

        -- 2. Phân tách AnswersJson và chèn vào bảng kết quả chi tiết CSR_FeedbackResultsDetail
        -- Chỉ thực hiện nếu AnswersJson là một chuỗi JSON hợp lệ dạng mảng hoặc đối tượng
        IF ISJSON(@AnswersJson) > 0
        BEGIN
            INSERT INTO [dbo].[CSR_FeedbackResultsDetail]
                ([Token], [ParentId], [Name], [RatingStars], [Comment], [SubmittedAt], [VisitorName], [ResponseId], [ProjectId])
            SELECT 
                @Token,
                [parentId],
                [name],
                [rating],
                [comment],
                GETDATE(),
                COALESCE(@VisitorName, N'Khách'),
                @ResponseId,
                @ProjectId
            FROM OPENJSON(@AnswersJson)
            WITH (
                [parentId] INT            '$.parentId',
                [name]     NVARCHAR(200)  '$.name',
                [rating]   INT            '$.rating',
                [comment]  NVARCHAR(1000) '$.comment'
            );
        END

        -- 3. Cập nhật trạng thái thư mời
        UPDATE [dbo].[CSR_FeedbackInvitations]
        SET [Status] = N'Completed',
            [UsedDate] = GETDATE()
        WHERE Id = @InvitationId;

        COMMIT TRANSACTION;
        SELECT N'Success' AS [ResultStatus], N'Đã lưu đánh giá thành công' AS [Message];
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        DECLARE @Err NVARCHAR(500) = ERROR_MESSAGE();
        RAISERROR(@Err, 16, 1);
    END CATCH
END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_SubmitReviews]
    @ProjectId      NVARCHAR(100),
    @ReviewerName   NVARCHAR(200) = NULL,
    @ReviewsJson    NVARCHAR(MAX)   -- JSON array: [{"criteriaId": 1, "rating": 5, "comment": "Tốt"}, ...]
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        -- Xoá đánh giá cũ cho dự án này nếu có
        DELETE FROM [dbo].[CSR_Reviews] WHERE [ProjectId] = @ProjectId;

        -- Insert đánh giá mới từ JSON
        INSERT INTO [dbo].[CSR_Reviews] ([ProjectId], [CriteriaId], [Rating], [Comment], [ReviewerName], [CreatedAt])
        SELECT 
            @ProjectId,
            [criteriaId],
            [rating],
            [comment],
            @ReviewerName,
            GETDATE()
        FROM OPENJSON(@ReviewsJson)
        WITH (
            [criteriaId] INT            '$.criteriaId',
            [rating]     INT            '$.rating',
            [comment]    NVARCHAR(MAX)  '$.comment'
        );

        COMMIT TRANSACTION;
        SELECT @ProjectId AS [ProjectId], N'Gửi đánh giá thành công' AS [Message];
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        DECLARE @Err NVARCHAR(500) = ERROR_MESSAGE();
        RAISERROR(@Err, 16, 1);
    END CATCH
END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_SyncEmployees]
    @EmployeesJson  NVARCHAR(MAX),
    @FileModifiedAt DATETIME
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        -- Tạo bảng tạm từ JSON
        DECLARE @NewData TABLE (
            [FullName] NVARCHAR(200),
            [Email]    NVARCHAR(200),
            [MNV]      NVARCHAR(50),
            [Department] NVARCHAR(200)
        );

        INSERT INTO @NewData ([FullName], [Email], [MNV], [Department])
        SELECT [FullName], [Email], [MNV], [Department]
        FROM OPENJSON(@EmployeesJson)
        WITH (
            [FullName] NVARCHAR(200) '$.fullName',
            [Email]    NVARCHAR(200) '$.email',
            [MNV]      NVARCHAR(50)  '$.mnv',
            [Department] NVARCHAR(200) '$.department'
        );

        -- Lấy danh sách nhân viên hiện tại đang Active nhưng KHÔNG CÓ trong Excel
        DECLARE @MissingEmployees TABLE (
            [MNV] NVARCHAR(50),
            [FullName] NVARCHAR(200),
            [Department] NVARCHAR(200)
        );
        INSERT INTO @MissingEmployees ([MNV], [FullName], [Department])
        SELECT [MNV], [FullName], [Department]
        FROM [dbo].[CSR_Employees]
        WHERE [StatusId] = 1 -- 1 = Hoạt động
          AND [MNV] NOT IN (SELECT [MNV] FROM @NewData);

        -- Đánh dấu tất cả inactive (StatusId = 2) trước (2 = Dừng)
        UPDATE [dbo].[CSR_Employees] SET [StatusId] = 2;

        -- Dùng OUTPUT để lấy danh sách nhân viên mới (Action = 'INSERT')
        DECLARE @MergedOutput TABLE (
            [ActionType] NVARCHAR(10),
            [MNV] NVARCHAR(50),
            [FullName] NVARCHAR(200),
            [Email]    NVARCHAR(200),
            [Department] NVARCHAR(200)
        );

        -- Upsert: cập nhật nếu đã có (theo MNV), thêm mới nếu chưa có
        MERGE [dbo].[CSR_Employees] AS target
        USING @NewData AS source ON target.[MNV] = source.[MNV]
        WHEN MATCHED THEN
            UPDATE SET
                [FullName]       = source.[FullName],
                [Email]          = source.[Email],
                [Department]     = source.[Department],
                [StatusId]       = 1, -- 1 = Hoạt động
                [FileModifiedAt] = @FileModifiedAt,
                [SyncedAt]       = GETDATE()
        WHEN NOT MATCHED THEN
            INSERT ([FullName], [Email], [MNV], [Department], [StatusId], [FileModifiedAt], [SyncedAt])
            VALUES (source.[FullName], source.[Email], source.[MNV], source.[Department],
                    1, @FileModifiedAt, GETDATE())
        OUTPUT $action, inserted.[MNV], inserted.[FullName], inserted.[Email], inserted.[Department] 
        INTO @MergedOutput;

        DECLARE @Rows INT = @@ROWCOUNT;

        -- KHOÁ TÀI KHOẢN (CSR_Users) CỦA CÁC NHÂN VIÊN ĐÃ NGHỈ VIỆC
        UPDATE U
        SET U.[StatusId] = 2, -- 2 = Dừng
            U.[UpdatedAt] = GETDATE()
        FROM [dbo].[CSR_Users] U
        WHERE U.[Role] NOT IN ('Admin', 'BOD', 'PRD')
          AND U.[MNV] NOT IN (SELECT [MNV] FROM @NewData);

        -- Ghi log
        INSERT INTO [dbo].[CSR_SyncLog] ([SyncType], [Status], [RowsAffected], [FileModifiedAt], [Message])
        VALUES ('employees', 'success', @Rows, @FileModifiedAt,
                CAST(@Rows AS NVARCHAR) + N' nhân viên đã được đồng bộ (theo mã MNV)');

        COMMIT TRANSACTION;

        -- Tạo chuỗi JSON trả về
        DECLARE @MissingJson NVARCHAR(MAX) = (
            SELECT [MNV], [FullName], [Department] 
            FROM @MissingEmployees FOR JSON AUTO
        );
        DECLARE @NewJson NVARCHAR(MAX) = (
            SELECT [MNV], [FullName], [Email], [Department] 
            FROM @MergedOutput WHERE [ActionType] = 'INSERT' FOR JSON AUTO
        );

        SELECT @Rows AS [RowsAffected], 
               @FileModifiedAt AS [FileModifiedAt],
               N'Đồng bộ thành công theo mã MNV' AS [Message],
               ISNULL(@MissingJson, '[]') AS [MissingEmployees],
               ISNULL(@NewJson, '[]') AS [NewEmployees];

    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        DECLARE @Err NVARCHAR(500) = ERROR_MESSAGE();
        INSERT INTO [dbo].[CSR_SyncLog] ([SyncType], [Status], [Message])
        VALUES ('employees', 'error', @Err);
        RAISERROR(@Err, 16, 1);
    END CATCH
END;
GO

-- ------------------------------------------------------------
-- Module: TaskAttachment (File đính kèm)
-- ------------------------------------------------------------

-- A. usp_TaskAttachment_GetById (Cũ: usp_GetTaskAttachmentById)
CREATE OR ALTER PROCEDURE [dbo].[usp_TaskAttachment_GetById]
    @AttachmentId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [FilePath], [FileName] 
    FROM [dbo].[CSR_TaskAttachments] 
    WHERE [Id] = @AttachmentId;
END
GO

-- B. usp_TaskAttachment_ListByTaskId (Cũ: usp_GetTaskAttachments)
CREATE OR ALTER PROCEDURE [dbo].[usp_TaskAttachment_ListByTaskId]
    @TaskId NVARCHAR(150)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [Id], [TaskId], [FileName], [FilePath], [FileSize], [UploadedBy], [CreatedAt]
    FROM [dbo].[CSR_TaskAttachments]
    WHERE [TaskId] = @TaskId
    ORDER BY [CreatedAt] DESC;
END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_TaskConfig_GetDefaultsByDestinations]
    @Destinations NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;

    CREATE TABLE #Dests (Dest NVARCHAR(100));
    INSERT INTO #Dests (Dest)
    SELECT LTRIM(RTRIM(value))
    FROM STRING_SPLIT(@Destinations, ',');

    SELECT
        d.Dest AS RequestedDestination,
        tc.Id,
        tc.Destination,
        tc.TaskName,
        tc.Description,
        tc.AssigneeName,
        tc.AssigneeEmail,
        tc.SupervisorName,
        tc.SupervisorEmail,
        tc.IsCompulsory,
        tc.LeadtimeDays,
        CAST(CASE WHEN tc.StatusId = 1 THEN 1 ELSE 0 END AS BIT) AS IsActive
    FROM #Dests d
    JOIN dbo.CSR_TaskConfig tc ON tc.Destination = d.Dest
    WHERE tc.StatusId = 1
    ORDER BY d.Dest, tc.Id;

    DROP TABLE #Dests;
END
GO

-- F. usp_TaskConfig_List
CREATE OR ALTER PROCEDURE [dbo].[usp_TaskConfig_List]
    @Destination NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 
        [Id], [Destination], [TaskName], [Description], 
        [AssigneeId], [AssigneeName], [AssigneeEmail], 
        [SupervisorId], [SupervisorName], [SupervisorEmail],
        [IsCompulsory], [LeadtimeDays], [StatusId],
        CAST(CASE WHEN [StatusId] = 1 THEN 1 ELSE 0 END AS BIT) AS [IsActive]
    FROM [dbo].[CSR_TaskConfig]
    WHERE (@Destination IS NULL OR [Destination] = @Destination)
    ORDER BY [Destination], [TaskName];
END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_ToggleEvaluationForm]
    @Id       INT,
    @IsActive BIT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @StatusId INT = CASE WHEN @IsActive = 1 THEN 1 ELSE 2 END;
    UPDATE [dbo].[CSR_EvaluationForms] 
    SET [StatusId] = @StatusId, [UpdatedAt] = GETDATE() 
    WHERE [Id] = @Id;
END
GO

-- 1i. syncNewCustomerReps — cập nhật customer reps trong config
CREATE OR ALTER PROCEDURE [dbo].[usp_UpdateCustomerConfigReps]
    @Id       INT,
    @JsonData NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE [dbo].[CSR_ConfigLists]
    SET [JsonData] = @JsonData
    WHERE [Id] = @Id;
END
GO

-- 6. usp_UpdateMenuRolePermissions: thay toàn bộ danh sách Role được phép cho 1 MenuId
--    @RolesCSV dạng "Admin,BOD,PRD" (rỗng = xoá hết quyền, không role nào được vào)
CREATE OR ALTER PROCEDURE [dbo].[usp_UpdateMenuRolePermissions]
    @MenuId    INT,
    @RolesCSV  NVARCHAR(200) = ''
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        DELETE FROM [dbo].[CSR_RolePermissions] WHERE [MenuId] = @MenuId;

        IF @RolesCSV IS NOT NULL AND @RolesCSV <> ''
        BEGIN
        INSERT INTO [dbo].[CSR_RolePermissions]
            (MenuId, Role)
        SELECT @MenuId, value
        FROM STRING_SPLIT(@RolesCSV, ',')
        WHERE value <> '';
    END

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        DECLARE @Err NVARCHAR(500) = ERROR_MESSAGE();
        RAISERROR(@Err, 16, 1);
    END CATCH
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

-- 2. usp_UpdateTaskStatus
CREATE OR ALTER PROCEDURE [dbo].[usp_UpdateTaskStatus]
    @TaskId     NVARCHAR(150),
    @NewStatus  NVARCHAR(50),
    @ActorMNV   NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    IF NOT EXISTS (SELECT 1 FROM [dbo].[CSR_Tasks] WHERE [Task_id] = @TaskId AND [StatusId] = 1)
    BEGIN
        RAISERROR('Không tìm thấy công việc', 16, 1);
        RETURN;
    END

    UPDATE [dbo].[CSR_Tasks]
    SET [TaskStatus] = @NewStatus
    WHERE [Task_id] = @TaskId AND [StatusId] = 1;

    -- Thêm log audit (nếu bảng CSR_AuditLogs có tồn tại)
    IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CSR_AuditLogs]') AND type = N'U')
    BEGIN
        INSERT INTO [dbo].[CSR_AuditLogs] ([Action], [Details], [MNV], [CreatedAt])
        VALUES ('UPDATE_TASK_STATUS', N'Cập nhật trạng thái Task ' + @TaskId + N' sang ' + @NewStatus, ISNULL(@ActorMNV, 'SYSTEM'), GETDATE());
    END

    -- Tự động hoàn thành / cập nhật trạng thái đơn tiếp đón chính nếu tất cả các task của đơn đó đã hoàn thành
    DECLARE @ProjectId NVARCHAR(150);
    SELECT @ProjectId = [Project_id] FROM [dbo].[CSR_Tasks] WHERE [Task_id] = @TaskId;

    IF @ProjectId IS NOT NULL
    BEGIN
        -- Đếm số lượng task chưa hoàn thành
        DECLARE @UncompletedCount INT;
        SELECT @UncompletedCount = COUNT(*)
        FROM [dbo].[CSR_Tasks]
        WHERE [Project_id] = @ProjectId 
          AND [StatusId] = 1 
          AND [TaskStatus] != N'Hoàn thành';

        -- Nếu tất cả task đã hoàn thành và đơn chính ở trạng thái 'BOD đã duyệt' (5), tự động chuyển thành 'Hoàn thành' (7)
        IF @UncompletedCount = 0
        BEGIN
            UPDATE [dbo].[CSR_Projects]
            SET [StatusId] = 7, -- Hoàn thành
                [UpdatedAt] = GETDATE()
            WHERE [Project_id] = @ProjectId 
              AND [RecordType] = 1 
              AND [StatusId] = 5; -- BOD đã duyệt
        END
    END

    SELECT @TaskId AS [TaskId], @NewStatus AS [TaskStatus], N'Cập nhật trạng thái thành công' AS [Message];
END;
GO

-- ============================================================
-- 7. Tái cấu trúc Stored Procedures
-- ============================================================

-- A. usp_UpsertConfigList
CREATE OR ALTER PROCEDURE [dbo].[usp_UpsertConfigList]
    @Id INT,
    @Category NVARCHAR(50),
    @Name NVARCHAR(200),
    @Email NVARCHAR(200),
    @JsonData NVARCHAR(MAX) = NULL,
    @StatusId INT = NULL,
    @IsActive BIT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @FinalStatusId INT = 1;
    IF @StatusId IS NOT NULL
        SET @FinalStatusId = @StatusId;
    ELSE IF @IsActive IS NOT NULL
        SET @FinalStatusId = CASE WHEN @IsActive = 1 THEN 1 ELSE 2 END;

    IF @Id = 0
    BEGIN
        INSERT INTO [dbo].[CSR_ConfigLists] ([Category], [Name], [Email], [JsonData], [StatusId])
        VALUES (@Category, @Name, @Email, @JsonData, @FinalStatusId);
    END
    ELSE
    BEGIN
        UPDATE [dbo].[CSR_ConfigLists]
        SET [Category] = @Category, [Name] = @Name, [Email] = @Email, [JsonData] = @JsonData, [StatusId] = @FinalStatusId
        WHERE [Id] = @Id;
    END
END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_UpsertEmailTemplate]
    @Id               INT,
    @Purpose          NVARCHAR(100),
    @TemplateName     NVARCHAR(200),
    @StartDate        DATE = NULL,
    @EndDate          DATE = NULL,
    @Location         NVARCHAR(100) = NULL,
    @IsAllCustomer    BIT,
    @Customers        NVARCHAR(MAX) = NULL,
    @SenderName       NVARCHAR(200) = NULL,
    @SenderEmail      NVARCHAR(200) = NULL,
    @RecipientName    NVARCHAR(200) = NULL,
    @RecipientEmail   NVARCHAR(200) = NULL,
    @EmailSubject     NVARCHAR(500) = NULL,
    @EmailBody        NVARCHAR(MAX) = NULL,
    @IsActive         BIT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @StatusId INT = CASE WHEN @IsActive = 1 THEN 1 ELSE 2 END;
    IF @Id = 0
    BEGIN
        INSERT INTO [dbo].[CSR_EmailCampaignTemplates] (
            [Purpose], [TemplateName], [StartDate], [EndDate], [Location],
            [IsAllCustomer], [Customers], [SenderName], [SenderEmail],
            [RecipientName], [RecipientEmail], [EmailSubject], [EmailBody],
            [StatusId], [CreatedAt], [UpdatedAt]
        ) VALUES (
            @Purpose, @TemplateName, @StartDate, @EndDate, @Location,
            @IsAllCustomer, @Customers, @SenderName, @SenderEmail,
            @RecipientName, @RecipientEmail, @EmailSubject, @EmailBody,
            @StatusId, GETDATE(), GETDATE()
        );
        SELECT SCOPE_IDENTITY() AS NewId;
    END
    ELSE
    BEGIN
        UPDATE [dbo].[CSR_EmailCampaignTemplates]
        SET [Purpose] = @Purpose,
            [TemplateName] = @TemplateName,
            [StartDate] = @StartDate,
            [EndDate] = @EndDate,
            [Location] = @Location,
            [IsAllCustomer] = @IsAllCustomer,
            [Customers] = @Customers,
            [SenderName] = @SenderName,
            [SenderEmail] = @SenderEmail,
            [RecipientName] = @RecipientName,
            [RecipientEmail] = @RecipientEmail,
            [EmailSubject] = @EmailSubject,
            [EmailBody] = @EmailBody,
            [StatusId] = @StatusId,
            [UpdatedAt] = GETDATE()
        WHERE [Id] = @Id;
        SELECT @Id AS NewId;
    END
END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_UpsertEvaluationForm]
    @Id                 INT,
    @FormName           NVARCHAR(200),
    @SendToCustomer     BIT,
    @SendToPrd          BIT,
    @SendToSubmitter    BIT,
    @SendToBod          BIT,
    @IsActive           BIT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @StatusId INT = CASE WHEN @IsActive = 1 THEN 1 ELSE 2 END;
    IF @Id > 0
    BEGIN
        UPDATE [dbo].[CSR_EvaluationForms]
        SET [FormName]       = @FormName,
            [SendToCustomer] = @SendToCustomer,
            [SendToPrd]      = @SendToPrd,
            [SendToSubmitter]= @SendToSubmitter,
            [SendToBod]      = @SendToBod,
            [StatusId]       = @StatusId,
            [UpdatedAt]      = GETDATE()
        WHERE [Id] = @Id;

        SELECT @Id AS [FormId], N'Cập nhật thành công' AS [Message];
    END
    ELSE
    BEGIN
        INSERT INTO [dbo].[CSR_EvaluationForms] 
            ([FormName], [SendToCustomer], [SendToPrd], [SendToSubmitter], [SendToBod], [StatusId], [CreatedAt], [UpdatedAt])
        VALUES 
            (@FormName, @SendToCustomer, @SendToPrd, @SendToSubmitter, @SendToBod, @StatusId, GETDATE(), GETDATE());

        SELECT SCOPE_IDENTITY() AS [FormId], N'Thêm mới thành công' AS [Message];
    END
END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_UpsertLocation]
    @Id INT,
    @Name NVARCHAR(100),
    @NotificationEmails NVARCHAR(MAX) = NULL,
    @IsActive BIT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @StatusId INT = CASE WHEN @IsActive = 1 THEN 1 ELSE 2 END;
    IF @Id = 0
    BEGIN
        INSERT INTO [dbo].[CSR_Locations] ([Name], [NotificationEmails], [StatusId]) 
        VALUES (@Name, @NotificationEmails, @StatusId);
    END
    ELSE
    BEGIN
        UPDATE [dbo].[CSR_Locations] 
        SET [Name] = @Name, [NotificationEmails] = @NotificationEmails, [StatusId] = @StatusId 
        WHERE [Id] = @Id;
    END
END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_UpsertReviewCriteria]
    @Id             INT,
    @FormId         INT,
    @CriteriaName   NVARCHAR(200),
    @Description    NVARCHAR(500),
    @CriteriaGroup  NVARCHAR(100),
    @SortOrder      INT,
    @IsRequired     BIT,
    @IsActive       BIT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @StatusId INT = CASE WHEN @IsActive = 1 THEN 1 ELSE 2 END;
    IF @Id > 0
    BEGIN
        UPDATE [dbo].[CSR_ReviewCriteria]
        SET [FormId]        = @FormId,
            [CriteriaName]  = @CriteriaName,
            [Description]   = @Description,
            [CriteriaGroup] = @CriteriaGroup,
            [SortOrder]     = @SortOrder,
            [IsRequired]    = @IsRequired,
            [StatusId]      = @StatusId
        WHERE [Id] = @Id;
    END
    ELSE
    BEGIN
        INSERT INTO [dbo].[CSR_ReviewCriteria] 
            ([FormId], [CriteriaName], [Description], [CriteriaGroup], [SortOrder], [IsRequired], [StatusId])
        VALUES 
            (@FormId, @CriteriaName, @Description, @CriteriaGroup, @SortOrder, @IsRequired, @StatusId);
    END
END
GO

-- E. usp_UpsertTaskConfig
CREATE OR ALTER PROCEDURE [dbo].[usp_UpsertTaskConfig]
    @Id INT,
    @Destination NVARCHAR(100),
    @TaskName NVARCHAR(200),
    @Description NVARCHAR(MAX),
    @AssigneeId NVARCHAR(50),
    @AssigneeName NVARCHAR(200),
    @AssigneeEmail NVARCHAR(200),
    @SupervisorId NVARCHAR(50),
    @SupervisorName NVARCHAR(200),
    @SupervisorEmail NVARCHAR(200),
    @IsCompulsory BIT,
    @LeadtimeDays INT,
    @IsActive BIT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @StatusId INT = CASE WHEN @IsActive = 1 THEN 1 ELSE 2 END;
    IF @Id = 0
    BEGIN
        INSERT INTO [dbo].[CSR_TaskConfig] (
            [Destination], [TaskName], [Description], 
            [AssigneeId], [AssigneeName], [AssigneeEmail], 
            [SupervisorId], [SupervisorName], [SupervisorEmail],
            [IsCompulsory], [LeadtimeDays], [StatusId]
        ) VALUES (
            @Destination, @TaskName, @Description, 
            @AssigneeId, @AssigneeName, @AssigneeEmail, 
            @SupervisorId, @SupervisorName, @SupervisorEmail,
            @IsCompulsory, @LeadtimeDays, @StatusId
        );
    END
    ELSE
    BEGIN
        UPDATE [dbo].[CSR_TaskConfig]
        SET 
            [Destination] = @Destination, [TaskName] = @TaskName, [Description] = @Description,
            [AssigneeId] = @AssigneeId, [AssigneeName] = @AssigneeName, [AssigneeEmail] = @AssigneeEmail,
            [SupervisorId] = @SupervisorId, [SupervisorName] = @SupervisorName, [SupervisorEmail] = @SupervisorEmail,
            [IsCompulsory] = @IsCompulsory, [LeadtimeDays] = @LeadtimeDays, [StatusId] = @StatusId
        WHERE [Id] = @Id;
    END
END
GO

-- G. usp_UpsertUser
CREATE OR ALTER PROCEDURE [dbo].[usp_UpsertUser]
    @UserId INT,
    @MNV NVARCHAR(50),
    @FullName NVARCHAR(200),
    @Email NVARCHAR(200),
    @Role NVARCHAR(50),
    @IsActive BIT,
    @PasswordHash NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @StatusId INT = CASE WHEN @IsActive = 1 THEN 1 ELSE 2 END;
    IF @UserId = 0 OR @UserId IS NULL
    BEGIN
        INSERT INTO [dbo].[CSR_Users] ([MNV], [PasswordHash], [FullName], [Email], [Role], [StatusId])
        VALUES (@MNV, ISNULL(@PasswordHash, ''), @FullName, @Email, @Role, @StatusId);
    END
    ELSE
    BEGIN
        IF @PasswordHash IS NOT NULL AND @PasswordHash <> ''
        BEGIN
            UPDATE [dbo].[CSR_Users]
            SET 
                [MNV] = @MNV, [FullName] = @FullName, [Email] = @Email, [Role] = @Role, 
                [StatusId] = @StatusId, [PasswordHash] = @PasswordHash, [UpdatedAt] = GETDATE()
            WHERE [UserId] = @UserId;
        END
        ELSE
        BEGIN
            UPDATE [dbo].[CSR_Users]
            SET 
                [MNV] = @MNV, [FullName] = @FullName, [Email] = @Email, [Role] = @Role, 
                [StatusId] = @StatusId, [UpdatedAt] = GETDATE()
            WHERE [UserId] = @UserId;
        END
    END
END
GO

-- 3. Stored Procedure xác thực token
CREATE OR ALTER PROCEDURE [dbo].[usp_ValidateFeedbackToken]
    @Token NVARCHAR(128)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @InvitationId INT;
    DECLARE @Status NVARCHAR(50);
    DECLARE @ExpireDate DATETIME;
    DECLARE @ProjectId NVARCHAR(100);
    DECLARE @VisitorId INT;

    SELECT 
        @InvitationId = Id,
        @Status = [Status],
        @ExpireDate = ExpireDate,
        @ProjectId = ProjectId,
        @VisitorId = VisitorId
    FROM [dbo].[CSR_FeedbackInvitations]
    WHERE [Token] = @Token;

    -- Kiểm tra nếu không tìm thấy token
    IF @InvitationId IS NULL
    BEGIN
        SELECT N'Invalid' AS [ValidationStatus], N'Đường dẫn đánh giá không hợp lệ hoặc không tồn tại.' AS [Message];
        RETURN;
    END

    -- Kiểm tra nếu đã sử dụng
    IF @Status = N'Completed'
    BEGIN
        SELECT N'Used' AS [ValidationStatus], N'Đánh giá này đã được thực hiện trước đó.' AS [Message];
        RETURN;
    END

    -- Kiểm tra nếu bị hủy
    IF @Status = N'Cancelled'
    BEGIN
        SELECT N'Cancelled' AS [ValidationStatus], N'Đường dẫn đánh giá này đã bị hủy bỏ bởi quản trị viên.' AS [Message];
        RETURN;
    END

    -- Kiểm tra hết hạn
    IF GETDATE() > @ExpireDate
    BEGIN
        -- Cập nhật trạng thái sang Expired để đồng bộ dữ liệu
        UPDATE [dbo].[CSR_FeedbackInvitations]
        SET [Status] = N'Expired'
        WHERE Id = @InvitationId;

        SELECT N'Expired' AS [ValidationStatus], N'Yêu cầu đánh giá đã hết hạn sử dụng.' AS [Message];
        RETURN;
    END

    -- Nếu hợp lệ
    -- Lấy thông tin Tên khách hàng từ CSR_Projects
    DECLARE @CustomerName NVARCHAR(200);
    DECLARE @GuestReps NVARCHAR(MAX);

    SELECT 
        @CustomerName = CustomerName,
        @GuestReps = GuestReps
    FROM [dbo].[CSR_Projects]
    WHERE [Project_id] = @ProjectId;

    -- Trả về trạng thái hợp lệ cùng thông tin dự án
    SELECT 
        N'Valid' AS [ValidationStatus],
        N'Hợp lệ' AS [Message],
        @InvitationId AS [InvitationId],
        @ProjectId AS [ProjectId],
        @CustomerName AS [CustomerName],
        @VisitorId AS [VisitorId],
        @GuestReps AS [GuestReps];

    -- Trả về thêm recordset chứa danh sách tiêu chí đánh giá hoạt động
    SELECT [Id], [CriteriaName], [Description], [CriteriaGroup], [SortOrder], [IsRequired]
    FROM [dbo].[CSR_ReviewCriteria]
    WHERE [StatusId] = 1
    ORDER BY [SortOrder] ASC;
END
GO

