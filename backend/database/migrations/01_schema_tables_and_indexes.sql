-- =============================================
-- 01_schema_tables_and_indexes.sql — Consolidated Master Table Definitions
-- =============================================

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CSR_ApprovalLogs')
BEGIN
    CREATE TABLE [dbo].[CSR_ApprovalLogs] (
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [ProjectId] [nvarchar](200) NOT NULL,
        [Action] [nvarchar](100) NOT NULL,
        [Role] [nvarchar](100) NOT NULL,
        [ActorMNV] [nvarchar](100) NOT NULL,
        [ActorName] [nvarchar](400) NOT NULL,
        [Reason] [nvarchar](MAX) NULL,
        [CreatedAt] [datetime] NULL DEFAULT (getdate()),
        [OldStatus] [nvarchar](100) NULL,
        [NewStatus] [nvarchar](100) NULL
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CSR_AuditLogs')
BEGIN
    CREATE TABLE [dbo].[CSR_AuditLogs] (
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [Action] [nvarchar](200) NOT NULL,
        [MNV] [nvarchar](100) NOT NULL,
        [Role] [nvarchar](100) NULL,
        [Department] [nvarchar](200) NULL,
        [Details] [nvarchar](MAX) NULL,
        [SubmissionId] [nvarchar](100) NULL,
        [CreatedAt] [datetime] NULL DEFAULT (getdate())
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CSR_ConfigLists')
BEGIN
    CREATE TABLE [dbo].[CSR_ConfigLists] (
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [Category] [nvarchar](100) NOT NULL,
        [Name] [nvarchar](400) NOT NULL,
        [Email] [nvarchar](400) NULL,
        [JsonData] [nvarchar](MAX) NULL,
        [StatusId] [int] NOT NULL DEFAULT ((1))
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CSR_EmailCampaignLogs')
BEGIN
    CREATE TABLE [dbo].[CSR_EmailCampaignLogs] (
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [TemplateId] [int] NOT NULL,
        [ProjectId] [nvarchar](200) NOT NULL,
        [SentAt] [datetime] NULL DEFAULT (getdate()),
        [Status] [nvarchar](100) NOT NULL,
        [ErrorMessage] [nvarchar](MAX) NULL
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CSR_EmailCampaignTemplates')
BEGIN
    CREATE TABLE [dbo].[CSR_EmailCampaignTemplates] (
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [Purpose] [nvarchar](200) NOT NULL,
        [TemplateName] [nvarchar](400) NOT NULL,
        [StartDate] [date] NULL,
        [EndDate] [date] NULL,
        [Location] [nvarchar](200) NULL,
        [IsAllCustomer] [bit] NOT NULL DEFAULT ((0)),
        [Customers] [nvarchar](MAX) NULL,
        [SenderName] [nvarchar](400) NULL,
        [SenderEmail] [nvarchar](400) NULL,
        [RecipientName] [nvarchar](400) NULL,
        [RecipientEmail] [nvarchar](400) NULL,
        [EmailSubject] [nvarchar](1000) NULL,
        [EmailBody] [nvarchar](MAX) NULL,
        [CreatedAt] [datetime] NULL DEFAULT (getdate()),
        [UpdatedAt] [datetime] NULL DEFAULT (getdate()),
        [StatusId] [int] NOT NULL DEFAULT ((1))
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CSR_Employees')
BEGIN
    CREATE TABLE [dbo].[CSR_Employees] (
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [FullName] [nvarchar](400) NOT NULL,
        [Email] [nvarchar](400) NOT NULL,
        [MNV] [nvarchar](100) NULL,
        [FileModifiedAt] [datetime] NULL,
        [SyncedAt] [datetime] NULL DEFAULT (getdate()),
        [Department] [nvarchar](200) NULL,
        [StatusId] [int] NOT NULL DEFAULT ((1)),
        [ManagerEmail] [nvarchar](400) NULL
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CSR_EvaluationForms')
BEGIN
    CREATE TABLE [dbo].[CSR_EvaluationForms] (
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [FormName] [nvarchar](400) NOT NULL,
        [SendToCustomer] [bit] NOT NULL DEFAULT ((0)),
        [SendToPrd] [bit] NOT NULL DEFAULT ((0)),
        [SendToSubmitter] [bit] NOT NULL DEFAULT ((0)),
        [SendToBod] [bit] NOT NULL DEFAULT ((0)),
        [CreatedAt] [datetime] NOT NULL DEFAULT (getdate()),
        [UpdatedAt] [datetime] NOT NULL DEFAULT (getdate()),
        [StatusId] [int] NOT NULL DEFAULT ((1))
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CSR_FeedbackCriteriaParent')
BEGIN
    CREATE TABLE [dbo].[CSR_FeedbackCriteriaParent] (
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [Name] [nvarchar](400) NOT NULL
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CSR_FeedbackInvitations')
BEGIN
    CREATE TABLE [dbo].[CSR_FeedbackInvitations] (
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [Token] [nvarchar](256) NOT NULL,
        [ProjectId] [nvarchar](200) NOT NULL,
        [VisitorId] [int] NOT NULL,
        [CreatedDate] [datetime] NOT NULL DEFAULT (getdate()),
        [ExpireDate] [datetime] NOT NULL,
        [UsedDate] [datetime] NULL,
        [Status] [nvarchar](100) NOT NULL DEFAULT (N'Pending'),
        [CreatedBy] [nvarchar](200) NULL
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CSR_FeedbackResponses')
BEGIN
    CREATE TABLE [dbo].[CSR_FeedbackResponses] (
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [InvitationId] [int] NOT NULL,
        [ProjectId] [nvarchar](200) NOT NULL,
        [OverallRating] [int] NOT NULL,
        [AnswersJson] [nvarchar](MAX) NOT NULL,
        [Comments] [nvarchar](2000) NULL,
        [SubmittedAt] [datetime] NOT NULL DEFAULT (getdate())
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CSR_FeedbackResultsDetail')
BEGIN
    CREATE TABLE [dbo].[CSR_FeedbackResultsDetail] (
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [Token] [nvarchar](256) NOT NULL,
        [ParentId] [int] NOT NULL,
        [Name] [nvarchar](400) NOT NULL,
        [RatingStars] [int] NOT NULL,
        [Comment] [nvarchar](2000) NULL,
        [SubmittedAt] [datetime] NOT NULL DEFAULT (getdate()),
        [VisitorName] [nvarchar](400) NULL,
        [ResponseId] [nvarchar](200) NULL,
        [ProjectId] [nvarchar](200) NOT NULL
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CSR_Locations')
BEGIN
    CREATE TABLE [dbo].[CSR_Locations] (
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [Name] [nvarchar](200) NOT NULL,
        [NotificationEmails] [nvarchar](MAX) NULL,
        [StatusId] [int] NOT NULL DEFAULT ((1))
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CSR_Menus')
BEGIN
    CREATE TABLE [dbo].[CSR_Menus] (
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [ParentId] [int] NULL,
        [MenuKey] [nvarchar](200) NOT NULL,
        [MenuName] [nvarchar](400) NOT NULL,
        [Path] [nvarchar](400) NULL,
        [SortOrder] [int] NOT NULL DEFAULT ((0)),
        [IsActive] [bit] NOT NULL DEFAULT ((1))
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CSR_Notifications')
BEGIN
    CREATE TABLE [dbo].[CSR_Notifications] (
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [Message] [nvarchar](MAX) NOT NULL,
        [ActorMNV] [nvarchar](100) NOT NULL,
        [ProjectId] [varchar](50) NULL,
        [CreatedAt] [datetime] NULL DEFAULT (getdate()),
        [IsRead] [bit] NULL DEFAULT ((0))
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CSR_Projects')
BEGIN
    CREATE TABLE [dbo].[CSR_Projects] (
        [Project_id] [nvarchar](200) NOT NULL,
        [Timestamp] [bigint] NOT NULL,
        [SubmitDate] [date] NOT NULL,
        [CustomerType] [nvarchar](40) NOT NULL,
        [CustomerName] [nvarchar](400) NOT NULL,
        [SubmitterEmail] [nvarchar](400) NOT NULL,
        [SubmitterName] [nvarchar](400) NOT NULL,
        [SubmitterMNV] [nvarchar](100) NULL,
        [GuestRepName] [nvarchar](1000) NULL,
        [GuestCount] [nvarchar](100) NULL,
        [MeetingTopic] [nvarchar](1000) NULL,
        [Attendees] [nvarchar](MAX) NULL,
        [AttendeesEmail] [nvarchar](MAX) NULL,
        [AgendaInfo] [nvarchar](MAX) NULL,
        [AgendaAttachUrl] [nvarchar](2000) NULL,
        [CreatedAt] [datetime] NOT NULL DEFAULT (getdate()),
        [UpdatedAt] [datetime] NOT NULL DEFAULT (getdate()),
        [GuestReps] [nvarchar](MAX) NULL,
        [AgendaJsonData] [nvarchar](MAX) NULL,
        [ParentId] [nvarchar](100) NULL,
        [RecordType] [int] NULL DEFAULT ((1)),
        [Version] [int] NULL DEFAULT ((1)),
        [StatusId] [int] NOT NULL DEFAULT ((8)),
        [ApprovalEmailMessageId] [nvarchar](1000) NULL
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CSR_ReviewCriteria')
BEGIN
    CREATE TABLE [dbo].[CSR_ReviewCriteria] (
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [CriteriaName] [nvarchar](400) NOT NULL,
        [Description] [nvarchar](1000) NULL,
        [CriteriaGroup] [nvarchar](200) NOT NULL,
        [SortOrder] [int] NOT NULL DEFAULT ((0)),
        [IsRequired] [bit] NOT NULL DEFAULT ((0)),
        [CreatedAt] [datetime] NOT NULL DEFAULT (getdate()),
        [FormId] [int] NULL,
        [StatusId] [int] NOT NULL DEFAULT ((1))
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CSR_Reviews')
BEGIN
    CREATE TABLE [dbo].[CSR_Reviews] (
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [ProjectId] [nvarchar](200) NOT NULL,
        [CriteriaId] [int] NOT NULL,
        [Rating] [int] NOT NULL,
        [Comment] [nvarchar](MAX) NULL,
        [ReviewerName] [nvarchar](400) NULL,
        [CreatedAt] [datetime] NOT NULL DEFAULT (getdate())
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CSR_RolePermissions')
BEGIN
    CREATE TABLE [dbo].[CSR_RolePermissions] (
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [MenuId] [int] NOT NULL,
        [Role] [nvarchar](100) NOT NULL
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CSR_ScheduledEmails')
BEGIN
    CREATE TABLE [dbo].[CSR_ScheduledEmails] (
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [ProjectId] [nvarchar](200) NOT NULL,
        [ParentId] [nvarchar](200) NOT NULL,
        [EmailType] [nvarchar](100) NOT NULL,
        [SendAt] [datetime] NOT NULL,
        [Status] [nvarchar](100) NOT NULL DEFAULT ('Pending'),
        [SentAt] [datetime] NULL,
        [ErrorMessage] [nvarchar](MAX) NULL,
        [CreatedAt] [datetime] NULL DEFAULT (getdate()),
        [UpdatedAt] [datetime] NULL DEFAULT (getdate())
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CSR_Statuses')
BEGIN
    CREATE TABLE [dbo].[CSR_Statuses] (
        [Id] [int] NOT NULL,
        [TenTrangThai] [nvarchar](200) NOT NULL,
        [Module] [nvarchar](40) NOT NULL DEFAULT ('All')
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CSR_SyncLog')
BEGIN
    CREATE TABLE [dbo].[CSR_SyncLog] (
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [SyncType] [nvarchar](100) NOT NULL,
        [Status] [nvarchar](40) NOT NULL,
        [RowsAffected] [int] NULL,
        [FileModifiedAt] [datetime] NULL,
        [Message] [nvarchar](1000) NULL,
        [CreatedAt] [datetime] NOT NULL DEFAULT (getdate())
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CSR_TaskAttachments')
BEGIN
    CREATE TABLE [dbo].[CSR_TaskAttachments] (
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [TaskId] [nvarchar](300) NOT NULL,
        [FileName] [nvarchar](1000) NOT NULL,
        [FilePath] [nvarchar](2000) NOT NULL,
        [FileSize] [bigint] NULL,
        [UploadedBy] [nvarchar](400) NULL,
        [CreatedAt] [datetime] NOT NULL DEFAULT (getdate())
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CSR_TaskConfig')
BEGIN
    CREATE TABLE [dbo].[CSR_TaskConfig] (
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [Destination] [nvarchar](200) NOT NULL,
        [TaskName] [nvarchar](400) NOT NULL,
        [Description] [nvarchar](MAX) NULL,
        [AssigneeId] [nvarchar](100) NULL,
        [AssigneeName] [nvarchar](400) NULL,
        [AssigneeEmail] [nvarchar](400) NULL,
        [SupervisorId] [nvarchar](100) NULL,
        [SupervisorName] [nvarchar](400) NULL,
        [SupervisorEmail] [nvarchar](400) NULL,
        [IsCompulsory] [bit] NOT NULL DEFAULT ((0)),
        [LeadtimeDays] [int] NOT NULL DEFAULT ((0)),
        [StatusId] [int] NOT NULL DEFAULT ((1))
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CSR_TaskNotes')
BEGIN
    CREATE TABLE [dbo].[CSR_TaskNotes] (
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [TaskId] [nvarchar](300) NOT NULL,
        [Content] [nvarchar](MAX) NOT NULL,
        [AuthorMNV] [nvarchar](100) NULL,
        [AuthorName] [nvarchar](400) NULL,
        [CreatedAt] [datetime] NOT NULL DEFAULT (getdate())
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CSR_Tasks')
BEGIN
    CREATE TABLE [dbo].[CSR_Tasks] (
        [Task_id] [nvarchar](300) NOT NULL,
        [Project_id] [nvarchar](200) NOT NULL,
        [OnboardDate] [date] NOT NULL,
        [Destination] [nvarchar](200) NOT NULL,
        [TaskName] [nvarchar](400) NOT NULL,
        [TaskDetail] [nvarchar](MAX) NULL,
        [Assignee] [nvarchar](400) NULL,
        [AssigneeEmail] [nvarchar](1000) NULL,
        [Supervisor] [nvarchar](400) NULL,
        [SupervisorEmail] [nvarchar](1000) NULL,
        [TaskAttendees] [nvarchar](MAX) NULL,
        [TaskAttendeesEmail] [nvarchar](MAX) NULL,
        [DeadlineDate] [date] NULL,
        [ReminderDate] [date] NULL,
        [Vehicle] [nvarchar](400) NULL,
        [IncludeGuests] [bit] NULL DEFAULT ((0)),
        [PassengerCount] [nvarchar](100) NULL,
        [FlightRoute] [nvarchar](400) NULL,
        [ReturnDate] [date] NULL,
        [MealOption] [nvarchar](1000) NULL,
        [MeetingRoom] [nvarchar](400) NULL,
        [MeetingRoomEmail] [nvarchar](400) NULL,
        [MeetingStartTime] [nvarchar](20) NULL,
        [MeetingEndTime] [nvarchar](20) NULL,
        [CalendarEventId] [nvarchar](400) NULL,
        [ContentType] [nvarchar](400) NULL,
        [CreatedAt] [datetime] NOT NULL DEFAULT (getdate()),
        [TaskStatus] [nvarchar](100) NOT NULL DEFAULT (N'Chưa bắt đầu'),
        [StatusId] [int] NOT NULL DEFAULT ((1))
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CSR_UploadedFiles')
BEGIN
    CREATE TABLE [dbo].[CSR_UploadedFiles] (
        [id] [int] IDENTITY(1,1) NOT NULL,
        [original_name] [nvarchar](510) NOT NULL,
        [stored_name] [nvarchar](510) NOT NULL,
        [file_path] [nvarchar](MAX) NOT NULL,
        [file_extension] [nvarchar](100) NULL,
        [mime_type] [nvarchar](200) NULL,
        [file_size] [bigint] NULL,
        [created_date] [datetime] NULL DEFAULT (getdate()),
        [uploaded_by] [nvarchar](100) NULL
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CSR_Users')
BEGIN
    CREATE TABLE [dbo].[CSR_Users] (
        [UserId] [int] IDENTITY(1,1) NOT NULL,
        [MNV] [nvarchar](100) NOT NULL,
        [PasswordHash] [nvarchar](510) NOT NULL,
        [FullName] [nvarchar](400) NOT NULL,
        [Email] [nvarchar](400) NULL,
        [Role] [nvarchar](100) NOT NULL DEFAULT ('PRD'),
        [RequiresPasswordChange] [bit] NOT NULL DEFAULT ((1)),
        [CreatedAt] [datetime] NULL DEFAULT (getdate()),
        [UpdatedAt] [datetime] NULL DEFAULT (getdate()),
        [Department] [nvarchar](400) NULL,
        [StatusId] [int] NOT NULL DEFAULT ((1))
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Fleet_Bookings')
BEGIN
    CREATE TABLE [dbo].[Fleet_Bookings] (
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [BookingCode] [nvarchar](60) NOT NULL,
        [RequesterMNV] [nvarchar](100) NULL,
        [RequesterName] [nvarchar](400) NOT NULL,
        [RequesterEmail] [nvarchar](400) NULL,
        [RequesterDept] [nvarchar](400) NULL,
        [DepartureTime] [datetime] NOT NULL,
        [ReturnTime] [datetime] NULL,
        [Purpose] [nvarchar](2000) NOT NULL,
        [Status] [nvarchar](100) NOT NULL DEFAULT (N'Chờ duyệt'),
        [AssignedNote] [nvarchar](2000) NULL,
        [ApprovedBy] [nvarchar](200) NULL,
        [ApprovedAt] [datetime] NULL,
        [RejectedReason] [nvarchar](2000) NULL,
        [CancelledReason] [nvarchar](2000) NULL,
        [CompletedAt] [datetime] NULL,
        [Notes] [nvarchar](2000) NULL,
        [CreatedAt] [datetime] NOT NULL DEFAULT (getdate()),
        [UpdatedAt] [datetime] NOT NULL DEFAULT (getdate()),
        [ParentBookingCode] [nvarchar](60) NULL
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Fleet_BookingsDetailed')
BEGIN
    CREATE TABLE [dbo].[Fleet_BookingsDetailed] (
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [BookingCode] [nvarchar](60) NOT NULL,
        [BookingCodeNo] [nvarchar](80) NOT NULL,
        [PickupLocation] [nvarchar](1000) NOT NULL,
        [Destination] [nvarchar](1000) NOT NULL,
        [Stops] [nvarchar](MAX) NULL,
        [PassengerCount] [int] NOT NULL DEFAULT ((1)),
        [Priority] [nvarchar](40) NOT NULL DEFAULT (N'Bình thường'),
        [VehicleId] [int] NULL,
        [DriverId] [int] NULL,
        [Notes] [nvarchar](2000) NULL,
        [Attendees] [nvarchar](MAX) NULL,
        [AttendeesEmail] [nvarchar](MAX) NULL,
        [VehicleType] [nvarchar](200) NULL DEFAULT (N'Xe công ty'),
        [CreatedAt] [datetime] NOT NULL DEFAULT (getdate()),
        [UpdatedAt] [datetime] NOT NULL DEFAULT (getdate())
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Fleet_Drivers')
BEGIN
    CREATE TABLE [dbo].[Fleet_Drivers] (
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [FullName] [nvarchar](400) NOT NULL,
        [Phone] [nvarchar](40) NULL,
        [LicenseNumber] [nvarchar](100) NULL,
        [LicenseClass] [nvarchar](20) NULL,
        [Status] [nvarchar](100) NOT NULL DEFAULT (N'Sẵn sàng'),
        [Notes] [nvarchar](2000) NULL,
        [IsActive] [bit] NOT NULL DEFAULT ((1)),
        [CreatedAt] [datetime] NOT NULL DEFAULT (getdate()),
        [UpdatedAt] [datetime] NOT NULL DEFAULT (getdate())
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Fleet_Vehicles')
BEGIN
    CREATE TABLE [dbo].[Fleet_Vehicles] (
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [PlateNumber] [nvarchar](40) NOT NULL,
        [Brand] [nvarchar](200) NOT NULL,
        [Model] [nvarchar](200) NULL,
        [TypeId] [int] NULL,
        [Seats] [int] NOT NULL DEFAULT ((4)),
        [Color] [nvarchar](100) NULL,
        [FuelType] [nvarchar](100) NULL DEFAULT (N'Xăng'),
        [Status] [nvarchar](100) NOT NULL DEFAULT (N'Sẵn sàng'),
        [Notes] [nvarchar](2000) NULL,
        [IsActive] [bit] NOT NULL DEFAULT ((1)),
        [CreatedAt] [datetime] NOT NULL DEFAULT (getdate()),
        [UpdatedAt] [datetime] NOT NULL DEFAULT (getdate())
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Fleet_VehicleTypes')
BEGIN
    CREATE TABLE [dbo].[Fleet_VehicleTypes] (
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [TypeName] [nvarchar](200) NOT NULL,
        [Description] [nvarchar](1000) NULL,
        [IsActive] [bit] NOT NULL DEFAULT ((1)),
        [CreatedAt] [datetime] NOT NULL DEFAULT (getdate())
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'LocationMaster')
BEGIN
    CREATE TABLE [dbo].[LocationMaster] (
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [AddressQuery] [nvarchar](1000) NOT NULL,
        [DisplayName] [nvarchar](1000) NOT NULL,
        [Latitude] [decimal](18, 2) NULL,
        [Longitude] [decimal](18, 2) NULL,
        [Source] [nvarchar](100) NULL DEFAULT ('Google'),
        [SearchCount] [int] NULL DEFAULT ((1)),
        [CreatedAt] [datetime] NULL DEFAULT (getdate()),
        [UpdatedAt] [datetime] NULL DEFAULT (getdate())
    );
END;
GO

