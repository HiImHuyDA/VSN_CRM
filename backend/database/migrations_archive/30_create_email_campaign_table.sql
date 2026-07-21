USE CSR_DB;
GO

-- 1. Bảng lưu trữ mẫu Email Campaign Marketing
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'CSR_EmailCampaignTemplates' AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[CSR_EmailCampaignTemplates] (
        [Id]            INT IDENTITY(1,1) PRIMARY KEY,
        [Purpose]       NVARCHAR(100) NOT NULL, -- 'Chào đón khách', 'Mời sự kiện'
        [TemplateName]  NVARCHAR(200) NOT NULL,
        [StartDate]     DATE NULL,
        [EndDate]       DATE NULL,
        [Location]      NVARCHAR(100) NULL,    -- Địa điểm cấu hình (ví dụ: 'VSN OFFICE', 'VAC' hoặc NULL cho tất cả)
        [IsAllCustomer] BIT NOT NULL DEFAULT 0,
        [Customers]     NVARCHAR(MAX) NULL,    -- Mảng JSON chứa danh sách tên/ID khách hàng
        [SenderName]    NVARCHAR(200) NULL,
        [SenderEmail]   NVARCHAR(200) NULL,
        [RecipientName] NVARCHAR(200) NULL,    -- Nhập tay hoặc placeholder
        [RecipientEmail] NVARCHAR(200) NULL,   -- Nhập tay hoặc placeholder
        [EmailSubject]  NVARCHAR(500) NULL,
        [EmailBody]     NVARCHAR(MAX) NULL,    -- Rich text HTML
        [IsActive]      BIT NOT NULL DEFAULT 1, -- 1 = Đang hoạt động, 0 = Ngưng hoạt động
        [CreatedAt]     DATETIME DEFAULT GETDATE(),
        [UpdatedAt]     DATETIME DEFAULT GETDATE()
    );
    PRINT 'Created table: CSR_EmailCampaignTemplates';
END
GO

-- 2. Bảng lưu nhật ký gửi Email Campaign để chống trùng
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'CSR_EmailCampaignLogs' AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[CSR_EmailCampaignLogs] (
        [Id]          INT IDENTITY(1,1) PRIMARY KEY,
        [TemplateId]  INT NOT NULL,
        [ProjectId]   NVARCHAR(100) NOT NULL,
        [SentAt]      DATETIME DEFAULT GETDATE(),
        [Status]      NVARCHAR(50) NOT NULL, -- 'Success', 'Failed'
        [ErrorMessage] NVARCHAR(MAX) NULL,
        FOREIGN KEY ([TemplateId]) REFERENCES [dbo].[CSR_EmailCampaignTemplates]([Id]) ON DELETE CASCADE
    );
    PRINT 'Created table: CSR_EmailCampaignLogs';
END
GO

-- 3. Stored Procedure: usp_GetEmailTemplates
CREATE OR ALTER PROCEDURE [dbo].[usp_GetEmailTemplates]
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
           [IsActive], [CreatedAt], [UpdatedAt]
    FROM [dbo].[CSR_EmailCampaignTemplates]
    WHERE (@Purpose IS NULL OR [Purpose] = @Purpose)
      AND (@Location IS NULL OR [Location] = @Location OR [Location] = '')
      AND (@IsActive IS NULL OR [IsActive] = @IsActive)
      AND (@SearchText IS NULL OR [TemplateName] LIKE '%' + @SearchText + '%')
      AND (
          @Customer IS NULL OR 
          [IsAllCustomer] = 1 OR 
          [Customers] LIKE '%' + @Customer + '%'
      )
    ORDER BY [CreatedAt] DESC;
END
GO

-- 4. Stored Procedure: usp_UpsertEmailTemplate
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
    IF @Id = 0
    BEGIN
        INSERT INTO [dbo].[CSR_EmailCampaignTemplates] (
            [Purpose], [TemplateName], [StartDate], [EndDate], [Location],
            [IsAllCustomer], [Customers], [SenderName], [SenderEmail],
            [RecipientName], [RecipientEmail], [EmailSubject], [EmailBody],
            [IsActive], [CreatedAt], [UpdatedAt]
        ) VALUES (
            @Purpose, @TemplateName, @StartDate, @EndDate, @Location,
            @IsAllCustomer, @Customers, @SenderName, @SenderEmail,
            @RecipientName, @RecipientEmail, @EmailSubject, @EmailBody,
            @IsActive, GETDATE(), GETDATE()
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
            [IsActive] = @IsActive,
            [UpdatedAt] = GETDATE()
        WHERE [Id] = @Id;
        SELECT @Id AS NewId;
    END
END
GO

-- 5. Stored Procedure: usp_CopyEmailTemplate
CREATE OR ALTER PROCEDURE [dbo].[usp_CopyEmailTemplate]
    @SourceId INT
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO [dbo].[CSR_EmailCampaignTemplates] (
        [Purpose], [TemplateName], [StartDate], [EndDate], [Location],
        [IsAllCustomer], [Customers], [SenderName], [SenderEmail],
        [RecipientName], [RecipientEmail], [EmailSubject], [EmailBody],
        [IsActive], [CreatedAt], [UpdatedAt]
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
        0, -- Ngưng hoạt động
        GETDATE(),
        GETDATE()
    FROM [dbo].[CSR_EmailCampaignTemplates]
    WHERE [Id] = @SourceId;
    
    SELECT SCOPE_IDENTITY() AS NewId;
END
GO
