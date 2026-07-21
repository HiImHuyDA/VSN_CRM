USE CSR_DB;
GO

-- 1. Tạo bảng master status nếu chưa có
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CSR_Statuses]') AND type = N'U')
BEGIN
    CREATE TABLE [dbo].[CSR_Statuses] (
        [Id] INT PRIMARY KEY,
        [TenTrangThai] NVARCHAR(100) NOT NULL UNIQUE
    );
    PRINT 'Created table: CSR_Statuses';
END
GO

-- 2. Seed dữ liệu master status
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CSR_Statuses]') AND type = N'U')
BEGIN
    MERGE [dbo].[CSR_Statuses] AS target
    USING (SELECT * FROM (VALUES
        (1, N'Hoạt động'),
        (2, N'Dừng'),
        (3, N'Mới'),
        (4, N'PRD đã duyệt'),
        (5, N'BOD đã duyệt'),
        (6, N'BOD từ chối'),
        (7, N'Hoàn thành'),
        (8, N'Chờ phản hồi'),
        (9, N'Đã hủy')
    ) AS tmp (Id, TenTrangThai)) AS source
    ON target.Id = source.Id
    WHEN MATCHED THEN
        UPDATE SET target.TenTrangThai = source.TenTrangThai
    WHEN NOT MATCHED THEN
        INSERT (Id, TenTrangThai) VALUES (source.Id, source.TenTrangThai);
    PRINT 'Seeded table: CSR_Statuses';
END
GO

-- 3. Định nghĩa script hỗ trợ drop default constraint động
-- Hàm/Block helper để tái sử dụng
DECLARE @DropDefault NVARCHAR(MAX) = '';
GO

-- ============================================================
-- 4. Chuyển đổi cột IsActive -> StatusId (INT)
-- ============================================================

-- Bảng CSR_ConfigLists
IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'IsActive' AND Object_ID = Object_ID(N'dbo.CSR_ConfigLists'))
BEGIN
    -- Drop default constraint
    DECLARE @ConstraintName NVARCHAR(200);
    SELECT @ConstraintName = name FROM sys.default_constraints WHERE parent_object_id = OBJECT_ID('dbo.CSR_ConfigLists') AND parent_column_id = COLUMNPROPERTY(OBJECT_ID('dbo.CSR_ConfigLists'), 'IsActive', 'ColumnId');
    IF @ConstraintName IS NOT NULL EXEC('ALTER TABLE dbo.CSR_ConfigLists DROP CONSTRAINT ' + @ConstraintName);
    
    -- Thêm cột mới
    ALTER TABLE [dbo].[CSR_ConfigLists] ADD [StatusId] INT NULL;
    EXEC('UPDATE [dbo].[CSR_ConfigLists] SET [StatusId] = CASE WHEN [IsActive] = 1 THEN 1 ELSE 2 END');
    ALTER TABLE [dbo].[CSR_ConfigLists] DROP COLUMN [IsActive];
    ALTER TABLE [dbo].[CSR_ConfigLists] ALTER COLUMN [StatusId] INT NOT NULL;
    ALTER TABLE [dbo].[CSR_ConfigLists] ADD CONSTRAINT [DF_ConfigLists_StatusId] DEFAULT 1 FOR [StatusId];
    ALTER TABLE [dbo].[CSR_ConfigLists] ADD CONSTRAINT [FK_ConfigLists_Statuses] FOREIGN KEY ([StatusId]) REFERENCES [dbo].[CSR_Statuses]([Id]);
    PRINT 'Altered CSR_ConfigLists';
END
GO

-- Bảng CSR_Locations
IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'IsActive' AND Object_ID = Object_ID(N'dbo.CSR_Locations'))
BEGIN
    DECLARE @ConstraintName NVARCHAR(200);
    SELECT @ConstraintName = name FROM sys.default_constraints WHERE parent_object_id = OBJECT_ID('dbo.CSR_Locations') AND parent_column_id = COLUMNPROPERTY(OBJECT_ID('dbo.CSR_Locations'), 'IsActive', 'ColumnId');
    IF @ConstraintName IS NOT NULL EXEC('ALTER TABLE dbo.CSR_Locations DROP CONSTRAINT ' + @ConstraintName);
    
    ALTER TABLE [dbo].[CSR_Locations] ADD [StatusId] INT NULL;
    EXEC('UPDATE [dbo].[CSR_Locations] SET [StatusId] = CASE WHEN [IsActive] = 1 THEN 1 ELSE 2 END');
    ALTER TABLE [dbo].[CSR_Locations] DROP COLUMN [IsActive];
    ALTER TABLE [dbo].[CSR_Locations] ALTER COLUMN [StatusId] INT NOT NULL;
    ALTER TABLE [dbo].[CSR_Locations] ADD CONSTRAINT [DF_Locations_StatusId] DEFAULT 1 FOR [StatusId];
    ALTER TABLE [dbo].[CSR_Locations] ADD CONSTRAINT [FK_Locations_Statuses] FOREIGN KEY ([StatusId]) REFERENCES [dbo].[CSR_Statuses]([Id]);
    PRINT 'Altered CSR_Locations';
END
GO

-- Bảng CSR_TaskConfig
IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'IsActive' AND Object_ID = Object_ID(N'dbo.CSR_TaskConfig'))
BEGIN
    DECLARE @ConstraintName NVARCHAR(200);
    SELECT @ConstraintName = name FROM sys.default_constraints WHERE parent_object_id = OBJECT_ID('dbo.CSR_TaskConfig') AND parent_column_id = COLUMNPROPERTY(OBJECT_ID('dbo.CSR_TaskConfig'), 'IsActive', 'ColumnId');
    IF @ConstraintName IS NOT NULL EXEC('ALTER TABLE dbo.CSR_TaskConfig DROP CONSTRAINT ' + @ConstraintName);
    
    ALTER TABLE [dbo].[CSR_TaskConfig] ADD [StatusId] INT NULL;
    EXEC('UPDATE [dbo].[CSR_TaskConfig] SET [StatusId] = CASE WHEN [IsActive] = 1 THEN 1 ELSE 2 END');
    ALTER TABLE [dbo].[CSR_TaskConfig] DROP COLUMN [IsActive];
    ALTER TABLE [dbo].[CSR_TaskConfig] ALTER COLUMN [StatusId] INT NOT NULL;
    ALTER TABLE [dbo].[CSR_TaskConfig] ADD CONSTRAINT [DF_TaskConfig_StatusId] DEFAULT 1 FOR [StatusId];
    ALTER TABLE [dbo].[CSR_TaskConfig] ADD CONSTRAINT [FK_TaskConfig_Statuses] FOREIGN KEY ([StatusId]) REFERENCES [dbo].[CSR_Statuses]([Id]);
    PRINT 'Altered CSR_TaskConfig';
END
GO

-- Bảng CSR_Users
IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'IsActive' AND Object_ID = Object_ID(N'dbo.CSR_Users'))
BEGIN
    DECLARE @ConstraintName NVARCHAR(200);
    SELECT @ConstraintName = name FROM sys.default_constraints WHERE parent_object_id = OBJECT_ID('dbo.CSR_Users') AND parent_column_id = COLUMNPROPERTY(OBJECT_ID('dbo.CSR_Users'), 'IsActive', 'ColumnId');
    IF @ConstraintName IS NOT NULL EXEC('ALTER TABLE dbo.CSR_Users DROP CONSTRAINT ' + @ConstraintName);
    
    ALTER TABLE [dbo].[CSR_Users] ADD [StatusId] INT NULL;
    EXEC('UPDATE [dbo].[CSR_Users] SET [StatusId] = CASE WHEN [IsActive] = 1 THEN 1 ELSE 2 END');
    ALTER TABLE [dbo].[CSR_Users] DROP COLUMN [IsActive];
    ALTER TABLE [dbo].[CSR_Users] ALTER COLUMN [StatusId] INT NOT NULL;
    ALTER TABLE [dbo].[CSR_Users] ADD CONSTRAINT [DF_Users_StatusId] DEFAULT 1 FOR [StatusId];
    ALTER TABLE [dbo].[CSR_Users] ADD CONSTRAINT [FK_Users_Statuses] FOREIGN KEY ([StatusId]) REFERENCES [dbo].[CSR_Statuses]([Id]);
    PRINT 'Altered CSR_Users';
END
GO

-- Bảng CSR_Employees
IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'IsActive' AND Object_ID = Object_ID(N'dbo.CSR_Employees'))
BEGIN
    DECLARE @ConstraintName NVARCHAR(200);
    SELECT @ConstraintName = name FROM sys.default_constraints WHERE parent_object_id = OBJECT_ID('dbo.CSR_Employees') AND parent_column_id = COLUMNPROPERTY(OBJECT_ID('dbo.CSR_Employees'), 'IsActive', 'ColumnId');
    IF @ConstraintName IS NOT NULL EXEC('ALTER TABLE dbo.CSR_Employees DROP CONSTRAINT ' + @ConstraintName);
    
    ALTER TABLE [dbo].[CSR_Employees] ADD [StatusId] INT NULL;
    EXEC('UPDATE [dbo].[CSR_Employees] SET [StatusId] = CASE WHEN [IsActive] = 1 THEN 1 ELSE 2 END');
    ALTER TABLE [dbo].[CSR_Employees] DROP COLUMN [IsActive];
    ALTER TABLE [dbo].[CSR_Employees] ALTER COLUMN [StatusId] INT NOT NULL;
    ALTER TABLE [dbo].[CSR_Employees] ADD CONSTRAINT [DF_Employees_StatusId] DEFAULT 1 FOR [StatusId];
    ALTER TABLE [dbo].[CSR_Employees] ADD CONSTRAINT [FK_Employees_Statuses] FOREIGN KEY ([StatusId]) REFERENCES [dbo].[CSR_Statuses]([Id]);
    PRINT 'Altered CSR_Employees';
END
GO

-- Bảng CSR_EmailCampaignTemplates
IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'IsActive' AND Object_ID = Object_ID(N'dbo.CSR_EmailCampaignTemplates'))
BEGIN
    DECLARE @ConstraintName NVARCHAR(200);
    SELECT @ConstraintName = name FROM sys.default_constraints WHERE parent_object_id = OBJECT_ID('dbo.CSR_EmailCampaignTemplates') AND parent_column_id = COLUMNPROPERTY(OBJECT_ID('dbo.CSR_EmailCampaignTemplates'), 'IsActive', 'ColumnId');
    IF @ConstraintName IS NOT NULL EXEC('ALTER TABLE dbo.CSR_EmailCampaignTemplates DROP CONSTRAINT ' + @ConstraintName);
    
    ALTER TABLE [dbo].[CSR_EmailCampaignTemplates] ADD [StatusId] INT NULL;
    EXEC('UPDATE [dbo].[CSR_EmailCampaignTemplates] SET [StatusId] = CASE WHEN [IsActive] = 1 THEN 1 ELSE 2 END');
    ALTER TABLE [dbo].[CSR_EmailCampaignTemplates] DROP COLUMN [IsActive];
    ALTER TABLE [dbo].[CSR_EmailCampaignTemplates] ALTER COLUMN [StatusId] INT NOT NULL;
    ALTER TABLE [dbo].[CSR_EmailCampaignTemplates] ADD CONSTRAINT [DF_EmailCampaignTemplates_StatusId] DEFAULT 1 FOR [StatusId];
    ALTER TABLE [dbo].[CSR_EmailCampaignTemplates] ADD CONSTRAINT [FK_EmailCampaignTemplates_Statuses] FOREIGN KEY ([StatusId]) REFERENCES [dbo].[CSR_Statuses]([Id]);
    PRINT 'Altered CSR_EmailCampaignTemplates';
END
GO

-- Bảng CSR_ReviewCriteria
IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'IsActive' AND Object_ID = Object_ID(N'dbo.CSR_ReviewCriteria'))
BEGIN
    DECLARE @ConstraintName NVARCHAR(200);
    SELECT @ConstraintName = name FROM sys.default_constraints WHERE parent_object_id = OBJECT_ID('dbo.CSR_ReviewCriteria') AND parent_column_id = COLUMNPROPERTY(OBJECT_ID('dbo.CSR_ReviewCriteria'), 'IsActive', 'ColumnId');
    IF @ConstraintName IS NOT NULL EXEC('ALTER TABLE dbo.CSR_ReviewCriteria DROP CONSTRAINT ' + @ConstraintName);
    
    ALTER TABLE [dbo].[CSR_ReviewCriteria] ADD [StatusId] INT NULL;
    EXEC('UPDATE [dbo].[CSR_ReviewCriteria] SET [StatusId] = CASE WHEN [IsActive] = 1 THEN 1 ELSE 2 END');
    ALTER TABLE [dbo].[CSR_ReviewCriteria] DROP COLUMN [IsActive];
    ALTER TABLE [dbo].[CSR_ReviewCriteria] ALTER COLUMN [StatusId] INT NOT NULL;
    ALTER TABLE [dbo].[CSR_ReviewCriteria] ADD CONSTRAINT [DF_ReviewCriteria_StatusId] DEFAULT 1 FOR [StatusId];
    ALTER TABLE [dbo].[CSR_ReviewCriteria] ADD CONSTRAINT [FK_ReviewCriteria_Statuses] FOREIGN KEY ([StatusId]) REFERENCES [dbo].[CSR_Statuses]([Id]);
    PRINT 'Altered CSR_ReviewCriteria';
END
GO

-- Bảng CSR_EvaluationForms
IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'IsActive' AND Object_ID = Object_ID(N'dbo.CSR_EvaluationForms'))
BEGIN
    DECLARE @ConstraintName NVARCHAR(200);
    SELECT @ConstraintName = name FROM sys.default_constraints WHERE parent_object_id = OBJECT_ID('dbo.CSR_EvaluationForms') AND parent_column_id = COLUMNPROPERTY(OBJECT_ID('dbo.CSR_EvaluationForms'), 'IsActive', 'ColumnId');
    IF @ConstraintName IS NOT NULL EXEC('ALTER TABLE dbo.CSR_EvaluationForms DROP CONSTRAINT ' + @ConstraintName);
    
    ALTER TABLE [dbo].[CSR_EvaluationForms] ADD [StatusId] INT NULL;
    EXEC('UPDATE [dbo].[CSR_EvaluationForms] SET [StatusId] = CASE WHEN [IsActive] = 1 THEN 1 ELSE 2 END');
    ALTER TABLE [dbo].[CSR_EvaluationForms] DROP COLUMN [IsActive];
    ALTER TABLE [dbo].[CSR_EvaluationForms] ALTER COLUMN [StatusId] INT NOT NULL;
    ALTER TABLE [dbo].[CSR_EvaluationForms] ADD CONSTRAINT [DF_EvaluationForms_StatusId] DEFAULT 1 FOR [StatusId];
    ALTER TABLE [dbo].[CSR_EvaluationForms] ADD CONSTRAINT [FK_EvaluationForms_Statuses] FOREIGN KEY ([StatusId]) REFERENCES [dbo].[CSR_Statuses]([Id]);
    PRINT 'Altered CSR_EvaluationForms';
END
GO

-- Bảng CSR_Tasks
IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'IsActive' AND Object_ID = Object_ID(N'dbo.CSR_Tasks'))
BEGIN
    DECLARE @ConstraintName NVARCHAR(200);
    SELECT @ConstraintName = name FROM sys.default_constraints WHERE parent_object_id = OBJECT_ID('dbo.CSR_Tasks') AND parent_column_id = COLUMNPROPERTY(OBJECT_ID('dbo.CSR_Tasks'), 'IsActive', 'ColumnId');
    IF @ConstraintName IS NOT NULL EXEC('ALTER TABLE dbo.CSR_Tasks DROP CONSTRAINT ' + @ConstraintName);
    
    ALTER TABLE [dbo].[CSR_Tasks] ADD [StatusId] INT NULL;
    EXEC('UPDATE [dbo].[CSR_Tasks] SET [StatusId] = CASE WHEN [IsActive] = 1 THEN 1 ELSE 2 END');
    ALTER TABLE [dbo].[CSR_Tasks] DROP COLUMN [IsActive];
    ALTER TABLE [dbo].[CSR_Tasks] ALTER COLUMN [StatusId] INT NOT NULL;
    ALTER TABLE [dbo].[CSR_Tasks] ADD CONSTRAINT [DF_Tasks_StatusId] DEFAULT 1 FOR [StatusId];
    ALTER TABLE [dbo].[CSR_Tasks] ADD CONSTRAINT [FK_Tasks_Statuses] FOREIGN KEY ([StatusId]) REFERENCES [dbo].[CSR_Statuses]([Id]);
    PRINT 'Altered CSR_Tasks';
END
GO


-- ============================================================
-- 5. Chuyển đổi cột CSR_Projects.Status (NVARCHAR) -> StatusId (INT)
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'Status' AND Object_ID = Object_ID(N'dbo.CSR_Projects'))
BEGIN
    DECLARE @ConstraintName NVARCHAR(200);
    SELECT @ConstraintName = name FROM sys.default_constraints WHERE parent_object_id = OBJECT_ID('dbo.CSR_Projects') AND parent_column_id = COLUMNPROPERTY(OBJECT_ID('dbo.CSR_Projects'), 'Status', 'ColumnId');
    IF @ConstraintName IS NOT NULL EXEC('ALTER TABLE dbo.CSR_Projects DROP CONSTRAINT ' + @ConstraintName);
    
    ALTER TABLE [dbo].[CSR_Projects] ADD [StatusId] INT NULL;
    
    -- Ánh xạ các giá trị text thô sang Id tương ứng
    EXEC('
        UPDATE [dbo].[CSR_Projects] SET [StatusId] = 8 WHERE [Status] = N''Chờ phản hồi'' OR [Status] = N''Đã gửi-Chờ phản hồi'';
        UPDATE [dbo].[CSR_Projects] SET [StatusId] = 4 WHERE [Status] = N''PRD đã duyệt'' OR [Status] = N''PRD duyệt'';
        UPDATE [dbo].[CSR_Projects] SET [StatusId] = 5 WHERE [Status] = N''BOD đã duyệt'' OR [Status] = N''BOC Duyệt'';
        UPDATE [dbo].[CSR_Projects] SET [StatusId] = 6 WHERE [Status] = N''BOD từ chối'' OR [Status] = N''Từ chối'';
        UPDATE [dbo].[CSR_Projects] SET [StatusId] = 7 WHERE [Status] = N''Hoàn thành'';
        UPDATE [dbo].[CSR_Projects] SET [StatusId] = 9 WHERE [Status] = N''Đã hủy'' OR [Status] = N''Đã huỷ'';
        UPDATE [dbo].[CSR_Projects] SET [StatusId] = 3 WHERE [Status] = N''Mới'';
        UPDATE [dbo].[CSR_Projects] SET [StatusId] = 8 WHERE [StatusId] IS NULL;
    ');
    
    ALTER TABLE [dbo].[CSR_Projects] DROP COLUMN [Status];
    ALTER TABLE [dbo].[CSR_Projects] ALTER COLUMN [StatusId] INT NOT NULL;
    ALTER TABLE [dbo].[CSR_Projects] ADD CONSTRAINT [DF_Projects_StatusId] DEFAULT 8 FOR [StatusId];
    ALTER TABLE [dbo].[CSR_Projects] ADD CONSTRAINT [FK_Projects_Statuses] FOREIGN KEY ([StatusId]) REFERENCES [dbo].[CSR_Statuses]([Id]);
    PRINT 'Altered CSR_Projects';
END
GO

-- ============================================================
-- 6. Tái cấu trúc Views
-- ============================================================
CREATE OR ALTER VIEW [dbo].[vw_SubmissionSummary]
AS
SELECT
    p.[Project_id],
    p.[ParentId],
    p.[RecordType],
    p.[Version],
    p.[SubmitDate],
    p.[CustomerType],
    p.[CustomerName],
    p.[SubmitterName],
    p.[SubmitterEmail],
    p.[SubmitterMNV],
    p.[MeetingTopic],
    s.TenTrangThai AS [Status],
    p.[CreatedAt],
    p.[UpdatedAt],
    COUNT(DISTINCT t.[OnboardDate])         AS [TotalDays],
    STUFF((
        SELECT DISTINCT ', ' + CONVERT(NVARCHAR(10), t2.[OnboardDate], 103)
        FROM [dbo].[CSR_Tasks] t2
        WHERE t2.[Project_id] = p.[Project_id]
        ORDER BY ', ' + CONVERT(NVARCHAR(10), t2.[OnboardDate], 103)
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS [OnboardDates],
    STUFF((
        SELECT DISTINCT ', ' + t3.[Destination]
        FROM [dbo].[CSR_Tasks] t3
        WHERE t3.[Project_id] = p.[Project_id]
        ORDER BY ', ' + t3.[Destination]
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS [Destinations],
    COUNT(t.[Task_id])                      AS [TotalTasks],
    SUM(CASE WHEN t.[DeadlineDate] <= CAST(GETDATE() AS DATE)
             AND t.[StatusId] = 1 THEN 1 ELSE 0 END) AS [UrgentTasks]
FROM
    [dbo].[CSR_Projects] p
    INNER JOIN [dbo].[CSR_Statuses] s ON p.[StatusId] = s.[Id]
    LEFT JOIN [dbo].[CSR_Tasks] t ON p.[Project_id] = t.[Project_id]
GROUP BY
    p.[Project_id], p.[ParentId], p.[RecordType], p.[Version],
    p.[SubmitDate], p.[CustomerType], p.[CustomerName],
    p.[SubmitterName], p.[SubmitterEmail], p.[SubmitterMNV], p.[MeetingTopic],
    s.TenTrangThai, p.[CreatedAt], p.[UpdatedAt];
GO

CREATE OR ALTER VIEW [dbo].[vw_ActiveTasks]
AS
SELECT
    t.[Task_id],
    t.[Project_id],
    p.[CustomerName],
    p.[CustomerType],
    p.[SubmitterName],
    t.[OnboardDate],
    t.[Destination],
    t.[TaskName],
    t.[TaskDetail],
    t.[Assignee],
    t.[AssigneeEmail],
    t.[Supervisor],
    t.[SupervisorEmail],
    t.[DeadlineDate],
    t.[ReminderDate],
    t.[Vehicle],
    t.[PassengerCount],
    t.[FlightRoute],
    t.[ReturnDate],
    t.[MealOption],
    t.[MeetingRoom],
    t.[MeetingRoomEmail],
    t.[MeetingStartTime],
    t.[MeetingEndTime],
    t.[CalendarEventId],
    t.[ContentType],
    CASE
        WHEN t.[DeadlineDate] < CAST(GETDATE() AS DATE) THEN N'Quá hạn'
        WHEN t.[DeadlineDate] = CAST(GETDATE() AS DATE) THEN N'Hôm nay'
        WHEN t.[DeadlineDate] <= DATEADD(DAY, 3, CAST(GETDATE() AS DATE)) THEN N'Sắp đến hạn'
        ELSE N'Trong hạn'
    END                                     AS [DeadlineStatus],
    DATEDIFF(DAY, CAST(GETDATE() AS DATE), t.[DeadlineDate])
                                            AS [DaysUntilDeadline]
FROM
    [dbo].[CSR_Tasks] t
    INNER JOIN [dbo].[CSR_Projects] p ON t.[Project_id] = p.[Project_id]
WHERE
    t.[StatusId] = 1;
GO

PRINT 'Recreated Views successfully';
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

-- C. usp_UpsertLocation
CREATE OR ALTER PROCEDURE [dbo].[usp_UpsertLocation]
    @Id INT,
    @Name NVARCHAR(100),
    @IsActive BIT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @StatusId INT = CASE WHEN @IsActive = 1 THEN 1 ELSE 2 END;
    IF @Id = 0
    BEGIN
        INSERT INTO [dbo].[CSR_Locations] ([Name], [StatusId]) VALUES (@Name, @StatusId);
    END
    ELSE
    BEGIN
        UPDATE [dbo].[CSR_Locations] SET [Name] = @Name, [StatusId] = @StatusId WHERE [Id] = @Id;
    END
END
GO

-- D. usp_GetLocations
CREATE OR ALTER PROCEDURE [dbo].[usp_GetLocations]
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 
        [Id], [Name], [StatusId],
        CAST(CASE WHEN [StatusId] = 1 THEN 1 ELSE 0 END AS BIT) AS [IsActive]
    FROM [dbo].[CSR_Locations]
    ORDER BY [Name];
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

-- H. usp_GetUserByMNV
CREATE OR ALTER PROCEDURE [dbo].[usp_GetUserByMNV]
    @MNV NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 
        [UserId], [MNV], [PasswordHash], [FullName], [Email], [Role], [StatusId],
        CAST(CASE WHEN [StatusId] = 1 THEN 1 ELSE 0 END AS BIT) AS [IsActive],
        [RequiresPasswordChange]
    FROM [dbo].[CSR_Users]
    WHERE [MNV] = @MNV AND [StatusId] = 1;
END
GO

-- I. usp_GetAllUsers
CREATE OR ALTER PROCEDURE [dbo].[usp_GetAllUsers]
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 
        [UserId], [MNV], [FullName], [Email], [Role], [StatusId],
        CAST(CASE WHEN [StatusId] = 1 THEN 1 ELSE 0 END AS BIT) AS [IsActive],
        [RequiresPasswordChange], [CreatedAt], [UpdatedAt]
    FROM [dbo].[CSR_Users]
    ORDER BY [Role], [FullName];
END
GO

-- J. usp_ApproveSubmission
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
        SELECT @OldStatus = s.TenTrangThai 
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

-- K. usp_RejectSubmission
CREATE OR ALTER PROCEDURE [dbo].[usp_RejectSubmission]
    @ProjectId      NVARCHAR(100),
    @ActorRole      NVARCHAR(50)    = NULL,
    @ActorMNV       NVARCHAR(50)    = NULL,
    @ActorName      NVARCHAR(200)   = NULL,
    @ActorEmail     NVARCHAR(200)   = NULL,
    @Reason         NVARCHAR(MAX)   = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        DECLARE @OldStatus NVARCHAR(50);
        SELECT @OldStatus = s.TenTrangThai 
        FROM [dbo].[CSR_Projects] p
        INNER JOIN [dbo].[CSR_Statuses] s ON p.StatusId = s.Id
        WHERE p.[Project_id] = @ProjectId;

        IF @OldStatus IS NULL
            RAISERROR(N'Không tìm thấy đơn: %s', 16, 1, @ProjectId);

        IF @ActorRole = N'BOD' AND @OldStatus <> N'PRD đã duyệt'
            RAISERROR(N'BOD chỉ xử lý được đơn đã được PRD phê duyệt trước.', 16, 1);

        DECLARE @NewStatus NVARCHAR(50) = N'Từ chối';
        
        IF @ActorRole = N'PRD' OR (@ActorRole = N'Admin' AND @OldStatus = N'Chờ phản hồi')
            SET @NewStatus = N'PRD từ chối';
        ELSE IF @ActorRole = N'BOD' OR (@ActorRole = N'Admin' AND @OldStatus = N'PRD đã duyệt')
            SET @NewStatus = N'BOD từ chối';

        UPDATE [dbo].[CSR_Projects]
        SET [StatusId] = (SELECT Id FROM [dbo].[CSR_Statuses] WHERE [TenTrangThai] = @NewStatus), [UpdatedAt] = GETDATE()
        WHERE [Project_id] = @ProjectId;

        INSERT INTO [dbo].[CSR_ApprovalLogs]
            ([ProjectId], [Action], [Role], [ActorMNV], [ActorName], [Reason], [OldStatus], [NewStatus])
        VALUES
            (@ProjectId, N'Reject', @ActorRole, @ActorMNV, @ActorName, @Reason, @OldStatus, @NewStatus);

        COMMIT TRANSACTION;
        SELECT @ProjectId AS [Project_id], @NewStatus AS [NewStatus],
               N'Đã từ chối đơn' AS [Message];
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        DECLARE @Err NVARCHAR(500) = ERROR_MESSAGE();
        RAISERROR(@Err, 16, 1);
    END CATCH
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

-- M. usp_CreateSubmission
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
            [OnboardDate]           NVARCHAR(50),
            [Destination]           NVARCHAR(100),
            [TaskName]              NVARCHAR(200),
            [TaskDetail]            NVARCHAR(MAX),
            [Assignee]              NVARCHAR(200),
            [AssigneeEmail]         NVARCHAR(500),
            [Supervisor]            NVARCHAR(200),
            [SupervisorEmail]       NVARCHAR(500),
            [TaskAttendees]         NVARCHAR(MAX),
            [TaskAttendeesEmail]    NVARCHAR(MAX),
            [LeadTime]              INT,
            [Vehicle]               NVARCHAR(200),
            [IncludeGuests]         NVARCHAR(10),
            [PassengerCount]        NVARCHAR(50),
            [FlightRoute]           NVARCHAR(200),
            [ReturnDate]            NVARCHAR(50),
            [MealOption]            NVARCHAR(500),
            [MeetingRoom]           NVARCHAR(200),
            [MeetingRoomEmail]      NVARCHAR(200),
            [MeetingStartTime]      NVARCHAR(10),
            [MeetingEndTime]        NVARCHAR(10),
            [CalendarEventId]       NVARCHAR(200),
            [ContentType]           NVARCHAR(200)
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

-- N. usp_Submission_List (Cập nhật với StatusId)
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

    -- Tự động cập nhật các đơn đủ điều kiện sang Hoàn thành trước khi trả kết quả
    UPDATE p
    SET p.[StatusId] = 7, p.[UpdatedAt] = GETDATE()
    FROM [dbo].[CSR_Projects] p
    WHERE p.[StatusId] = 5
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
            (@ActorRole = 'User' AND v.[SubmitterMNV] = @ActorMNV)
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
            -- Tab Tra cứu yêu cầu (Thêm 'Hoàn thành' cho BOD)
            OR (ISNULL(@Tab, '') != 'tracking' AND (
                (@ActorRole != 'BOD')
                OR (@ActorRole = 'BOD' AND [Status] IN (N'PRD đã duyệt', N'BOD đã duyệt', N'BOD từ chối', N'Hoàn thành'))
            ))
        )
    ORDER BY lv.OriginalCreatedAt DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;

    -- Tổng số bản ghi
    WITH LatestVersions AS (
        SELECT [Project_id], ROW_NUMBER() OVER (PARTITION BY [ParentId] ORDER BY [Version] DESC) as rn
        FROM [dbo].[vw_SubmissionSummary]
    )
    SELECT COUNT(*) AS [TotalCount]
    FROM [dbo].[vw_SubmissionSummary] v
    INNER JOIN LatestVersions lv ON v.[Project_id] = lv.[Project_id] AND lv.rn = 1
    WHERE
        (
            (@ActorRole = 'User' AND v.[SubmitterMNV] = @ActorMNV)
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
            -- Tab Tra cứu yêu cầu (Thêm 'Hoàn thành' cho BOD)
            OR (ISNULL(@Tab, '') != 'tracking' AND (
                (@ActorRole != 'BOD')
                OR (@ActorRole = 'BOD' AND [Status] IN (N'PRD đã duyệt', N'BOD đã duyệt', N'BOD từ chối', N'Hoàn thành'))
            ))
        );
END;
GO

PRINT 'Migration completed successfully!';
GO
