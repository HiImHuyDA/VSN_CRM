-- ============================================================
-- 08_system_config_tables.sql
-- Tạo các bảng Cấu hình hệ thống động (Danh sách, Địa điểm, Workflows)
-- ============================================================
USE CSR_DB;
GO

-- 1. Bảng cấu hình Danh sách chung (Khách hàng, Ăn uống, Phòng họp)
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'CSR_ConfigLists' AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[CSR_ConfigLists] (
        [Id]       INT IDENTITY(1,1) PRIMARY KEY,
        [Category] NVARCHAR(50) NOT NULL, -- CustomerType, CustomerName, DinnerRestaurant, LunchMenu, MeetingRoom
        [Name]     NVARCHAR(200) NOT NULL,
        [Email]    NVARCHAR(200) NULL,    -- Email (chỉ dùng cho MeetingRoom)
        [JsonData] NVARCHAR(MAX) NULL,    -- Lưu trữ động: VD JSON danh sách đại diện khách hàng mặc định
        [IsActive] BIT NOT NULL DEFAULT 1
    );
    PRINT 'Created table: CSR_ConfigLists';
END
ELSE
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'JsonData' AND Object_ID = Object_ID(N'dbo.CSR_ConfigLists'))
    BEGIN
        ALTER TABLE [dbo].[CSR_ConfigLists] ADD [JsonData] NVARCHAR(MAX) NULL;
        PRINT 'Added JsonData column to CSR_ConfigLists';
    END
END
GO

-- 2. Bảng Địa điểm tiếp đón
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'CSR_Locations' AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[CSR_Locations] (
        [Id]       INT IDENTITY(1,1) PRIMARY KEY,
        [Name]     NVARCHAR(100) NOT NULL UNIQUE,
        [IsActive] BIT NOT NULL DEFAULT 1
    );
    PRINT 'Created table: CSR_Locations';

    -- Seed mặc định
    INSERT INTO [dbo].[CSR_Locations] ([Name]) VALUES (N'Tập đoàn / Các Cty Thành viên');
    INSERT INTO [dbo].[CSR_Locations] ([Name]) VALUES (N'Khách Sạn');
    INSERT INTO [dbo].[CSR_Locations] ([Name]) VALUES (N'Nhà Máy VSN');
    INSERT INTO [dbo].[CSR_Locations] ([Name]) VALUES (N'Nhà Máy VDC');
    INSERT INTO [dbo].[CSR_Locations] ([Name]) VALUES (N'Nhà Máy VAC');
    INSERT INTO [dbo].[CSR_Locations] ([Name]) VALUES (N'Nhà Máy PBP');
END
GO

-- 3. Bảng Log duyệt đơn
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'CSR_ApprovalLogs' AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[CSR_ApprovalLogs] (
        [Id]         INT IDENTITY(1,1) PRIMARY KEY,
        [ProjectId]  NVARCHAR(100) NOT NULL,
        [Action]     NVARCHAR(50) NOT NULL, -- TiepNhan, Duyet, TuChoi
        [Role]       NVARCHAR(50) NOT NULL, -- PRD, BOC
        [ActorMNV]   NVARCHAR(50) NOT NULL,
        [ActorName]  NVARCHAR(200) NOT NULL,
        [Reason]     NVARCHAR(MAX) NULL,
        [CreatedAt]  DATETIME DEFAULT GETDATE(),
        FOREIGN KEY ([ProjectId]) REFERENCES [dbo].[CSR_Projects]([Project_id]) ON DELETE CASCADE
    );
    PRINT 'Created table: CSR_ApprovalLogs';
END
GO

-- 4. Cập nhật bảng CSR_TaskConfig (Tạo lại bảng để chuẩn hóa cột)
IF EXISTS (SELECT 1 FROM sys.objects WHERE name = 'CSR_TaskConfig' AND type = 'U')
BEGIN
    DROP TABLE [dbo].[CSR_TaskConfig];
END

CREATE TABLE [dbo].[CSR_TaskConfig] (
    [Id]              INT IDENTITY(1,1) PRIMARY KEY,
    [Destination]     NVARCHAR(100) NOT NULL,
    [TaskName]        NVARCHAR(200) NOT NULL,
    [Description]     NVARCHAR(MAX) NULL,
    [AssigneeId]      NVARCHAR(50) NULL,
    [AssigneeName]    NVARCHAR(200) NULL,
    [AssigneeEmail]   NVARCHAR(200) NULL,
    [SupervisorId]    NVARCHAR(50) NULL,
    [SupervisorName]  NVARCHAR(200) NULL,
    [SupervisorEmail] NVARCHAR(200) NULL,
    [IsCompulsory]    BIT NOT NULL DEFAULT 0,
    [LeadtimeDays]    INT NOT NULL DEFAULT 0,
    [IsActive]        BIT NOT NULL DEFAULT 1
);
PRINT 'Recreated table: CSR_TaskConfig';
GO

-- =========================================================================
-- STORED PROCEDURES CHO CẤU HÌNH HỆ THỐNG
-- =========================================================================

-- CRUD: Config Lists
CREATE OR ALTER PROCEDURE [dbo].[usp_GetConfigList]
    @Category NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [Id], [Category], [Name], [Email], [JsonData], [IsActive]
    FROM [dbo].[CSR_ConfigLists]
    WHERE (@Category IS NULL OR [Category] = @Category)
    ORDER BY [Category], [Name];
END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_UpsertConfigList]
    @Id INT,
    @Category NVARCHAR(50),
    @Name NVARCHAR(200),
    @Email NVARCHAR(200),
    @JsonData NVARCHAR(MAX) = NULL,
    @IsActive BIT
AS
BEGIN
    SET NOCOUNT ON;
    IF @Id = 0
    BEGIN
        INSERT INTO [dbo].[CSR_ConfigLists] ([Category], [Name], [Email], [JsonData], [IsActive])
        VALUES (@Category, @Name, @Email, @JsonData, @IsActive);
    END
    ELSE
    BEGIN
        UPDATE [dbo].[CSR_ConfigLists]
        SET [Category] = @Category, [Name] = @Name, [Email] = @Email, [JsonData] = @JsonData, [IsActive] = @IsActive
        WHERE [Id] = @Id;
    END
END
GO

-- CRUD: Locations
CREATE OR ALTER PROCEDURE [dbo].[usp_GetLocations]
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [Id], [Name], [IsActive]
    FROM [dbo].[CSR_Locations]
    ORDER BY [Name];
END
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_UpsertLocation]
    @Id INT,
    @Name NVARCHAR(100),
    @IsActive BIT
AS
BEGIN
    SET NOCOUNT ON;
    IF @Id = 0
    BEGIN
        INSERT INTO [dbo].[CSR_Locations] ([Name], [IsActive]) VALUES (@Name, @IsActive);
    END
    ELSE
    BEGIN
        UPDATE [dbo].[CSR_Locations] SET [Name] = @Name, [IsActive] = @IsActive WHERE [Id] = @Id;
    END
END
GO

-- CRUD: Task Config
CREATE OR ALTER PROCEDURE [dbo].[usp_GetTaskConfigs]
    @Destination NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 
        [Id], [Destination], [TaskName], [Description], 
        [AssigneeId], [AssigneeName], [AssigneeEmail], 
        [SupervisorId], [SupervisorName], [SupervisorEmail],
        [IsCompulsory], [LeadtimeDays], [IsActive]
    FROM [dbo].[CSR_TaskConfig]
    WHERE (@Destination IS NULL OR [Destination] = @Destination)
    ORDER BY [Destination], [TaskName];
END
GO

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
    IF @Id = 0
    BEGIN
        INSERT INTO [dbo].[CSR_TaskConfig] (
            [Destination], [TaskName], [Description], 
            [AssigneeId], [AssigneeName], [AssigneeEmail], 
            [SupervisorId], [SupervisorName], [SupervisorEmail],
            [IsCompulsory], [LeadtimeDays], [IsActive]
        ) VALUES (
            @Destination, @TaskName, @Description, 
            @AssigneeId, @AssigneeName, @AssigneeEmail, 
            @SupervisorId, @SupervisorName, @SupervisorEmail,
            @IsCompulsory, @LeadtimeDays, @IsActive
        );
    END
    ELSE
    BEGIN
        UPDATE [dbo].[CSR_TaskConfig]
        SET 
            [Destination] = @Destination, [TaskName] = @TaskName, [Description] = @Description,
            [AssigneeId] = @AssigneeId, [AssigneeName] = @AssigneeName, [AssigneeEmail] = @AssigneeEmail,
            [SupervisorId] = @SupervisorId, [SupervisorName] = @SupervisorName, [SupervisorEmail] = @SupervisorEmail,
            [IsCompulsory] = @IsCompulsory, [LeadtimeDays] = @LeadtimeDays, [IsActive] = @IsActive
        WHERE [Id] = @Id;
    END
END
GO
