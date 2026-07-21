-- ============================================================
-- 01_create_tables.sql
-- Tạo các bảng chính cho CSR App
-- ============================================================

USE CSR_DB;
GO

-- Tạo database nếu chưa có
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'CSR_DB')
BEGIN
    CREATE DATABASE CSR_DB;
END
GO

USE CSR_DB;
GO

-- ============================================================
-- Table: CSR_Projects (Thông tin chung của mỗi đơn tiếp khách)
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CSR_Projects]') AND type = N'U')
BEGIN
    CREATE TABLE [dbo].[CSR_Projects] (
        [Project_id]        NVARCHAR(100)   NOT NULL,
        [Timestamp]         BIGINT          NOT NULL,
        [SubmitDate]        DATE            NOT NULL,
        [CustomerType]      NVARCHAR(20)    NOT NULL,       -- Brand / Supplier / Partner
        [CustomerName]      NVARCHAR(200)   NOT NULL,
        [SubmitterEmail]    NVARCHAR(200)   NOT NULL,
        [SubmitterName]     NVARCHAR(200)   NOT NULL,
        [SubmitterMNV]      NVARCHAR(50)    NULL,
        [GuestRepName]      NVARCHAR(500)   NULL,           -- Tên đại diện khách
        [GuestCount]        NVARCHAR(50)    NULL,           -- Số lượng khách
        [MeetingTopic]      NVARCHAR(500)   NULL,           -- Chủ đề tiếp đón
        [Attendees]         NVARCHAR(MAX)   NULL,           -- Người tham gia (tên, dấu ;)
        [AttendeesEmail]    NVARCHAR(MAX)   NULL,           -- Email người tham gia (dấu ;)
        [AgendaInfo]        NVARCHAR(MAX)   NULL,           -- Thông tin lịch trình (text)
        [AgendaAttachUrl]   NVARCHAR(1000)  NULL,           -- URL file đính kèm SharePoint
        [Status]            NVARCHAR(50)    NOT NULL DEFAULT N'Đã gửi-Chờ phản hồi',
        [CreatedAt]         DATETIME        NOT NULL DEFAULT GETDATE(),
        [UpdatedAt]         DATETIME        NOT NULL DEFAULT GETDATE(),

        CONSTRAINT [PK_CSR_Projects] PRIMARY KEY ([Project_id])
    );
    PRINT 'Created table: CSR_Projects';
END
GO

-- ============================================================
-- Table: CSR_Tasks (Chi tiết công việc của từng đơn)
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CSR_Tasks]') AND type = N'U')
BEGIN
    CREATE TABLE [dbo].[CSR_Tasks] (
        [Task_id]               NVARCHAR(150)   NOT NULL,
        [Project_id]            NVARCHAR(100)   NOT NULL,
        [OnboardDate]           DATE            NOT NULL,       -- Ngày tiếp đón
        [Destination]           NVARCHAR(100)   NOT NULL,       -- Địa điểm
        [TaskName]              NVARCHAR(200)   NOT NULL,       -- Tên công việc
        [TaskDetail]            NVARCHAR(MAX)   NULL,           -- Chi tiết
        [Assignee]              NVARCHAR(200)   NULL,           -- Người đảm nhiệm
        [AssigneeEmail]         NVARCHAR(500)   NULL,
        [Supervisor]            NVARCHAR(200)   NULL,           -- Giám sát
        [SupervisorEmail]       NVARCHAR(500)   NULL,
        [TaskAttendees]         NVARCHAR(MAX)   NULL,           -- Người tham gia task
        [TaskAttendeesEmail]    NVARCHAR(MAX)   NULL,
        [DeadlineDate]          DATE            NULL,           -- Tính bởi fn_CalculateDeadline
        [ReminderDate]          DATE            NULL,
        -- Fields đặc biệt theo loại task
        [Vehicle]               NVARCHAR(200)   NULL,           -- Loại xe (Chuẩn bị xe)
        [IncludeGuests]         BIT             NULL DEFAULT 0, -- Khách đi cùng xe
        [PassengerCount]        NVARCHAR(50)    NULL,           -- Số người/vé
        [FlightRoute]           NVARCHAR(200)   NULL,           -- Chặng bay
        [ReturnDate]            DATE            NULL,           -- Ngày về (vé máy bay)
        [MealOption]            NVARCHAR(500)   NULL,           -- Loại bữa ăn
        [MeetingRoom]           NVARCHAR(200)   NULL,           -- Phòng họp
        [MeetingRoomEmail]      NVARCHAR(200)   NULL,           -- Email phòng họp
        [MeetingStartTime]      NVARCHAR(10)    NULL,           -- HH:MM
        [MeetingEndTime]        NVARCHAR(10)    NULL,
        [CalendarEventId]       NVARCHAR(200)   NULL,           -- Outlook Calendar ID
        [ContentType]           NVARCHAR(200)   NULL,           -- Loại nội dung họp
        [IsActive]              BIT             NOT NULL DEFAULT 1,
        [CreatedAt]             DATETIME        NOT NULL DEFAULT GETDATE(),

        CONSTRAINT [PK_CSR_Tasks] PRIMARY KEY ([Task_id]),
        CONSTRAINT [FK_CSR_Tasks_Projects] FOREIGN KEY ([Project_id])
            REFERENCES [dbo].[CSR_Projects] ([Project_id]) ON DELETE CASCADE
    );
    PRINT 'Created table: CSR_Tasks';
END
GO

-- ============================================================
-- Table: CSR_TaskConfig (Cấu hình task mặc định theo địa điểm)
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CSR_TaskConfig]') AND type = N'U')
BEGIN
    CREATE TABLE [dbo].[CSR_TaskConfig] (
        [Id]                    INT             NOT NULL IDENTITY(1,1),
        [Destination]           NVARCHAR(100)   NOT NULL,
        [TaskName]              NVARCHAR(200)   NOT NULL,
        [DefaultAssignee]       NVARCHAR(200)   NULL,
        [DefaultAssigneeEmail]  NVARCHAR(500)   NULL,
        [DefaultSupervisor]     NVARCHAR(200)   NULL,
        [DefaultSupervisorEmail] NVARCHAR(500)  NULL,
        [TaskDetail]            NVARCHAR(MAX)   NULL,
        [Compulsory]            NVARCHAR(5)     NULL DEFAULT '',   -- Y / N / ''
        [LeadTime]              INT             NOT NULL DEFAULT 1, -- Số ngày trước onboard

        CONSTRAINT [PK_CSR_TaskConfig] PRIMARY KEY ([Id])
    );
    CREATE INDEX [IX_CSR_TaskConfig_Destination] ON [dbo].[CSR_TaskConfig] ([Destination]);
    PRINT 'Created table: CSR_TaskConfig';
END
GO

-- ============================================================
-- Table: CSR_Employees (Danh sách nhân viên)
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CSR_Employees]') AND type = N'U')
BEGIN
    CREATE TABLE [dbo].[CSR_Employees] (
        [Id]        INT             NOT NULL IDENTITY(1,1),
        [FullName]  NVARCHAR(200)   NOT NULL,
        [Email]     NVARCHAR(200)   NOT NULL,
        [MNV]       NVARCHAR(50)    NULL,
        [IsActive]  BIT             NOT NULL DEFAULT 1,

        CONSTRAINT [PK_CSR_Employees] PRIMARY KEY ([Id]),
        CONSTRAINT [UQ_CSR_Employees_Email] UNIQUE ([Email])
    );
    CREATE INDEX [IX_CSR_Employees_FullName] ON [dbo].[CSR_Employees] ([FullName]);
    PRINT 'Created table: CSR_Employees';
END
GO

PRINT '=== Tables created successfully ===';
GO
