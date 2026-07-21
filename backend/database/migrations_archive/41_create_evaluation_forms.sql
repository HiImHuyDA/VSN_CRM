USE CSR_DB;
GO

-- 1. Tạo bảng CSR_EvaluationForms
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CSR_EvaluationForms]') AND type = N'U')
BEGIN
    CREATE TABLE [dbo].[CSR_EvaluationForms] (
        [Id]                INT IDENTITY(1,1)   NOT NULL,
        [FormName]          NVARCHAR(200)       NOT NULL,
        [SendToCustomer]    BIT                 NOT NULL DEFAULT 0,
        [SendToPrd]         BIT                 NOT NULL DEFAULT 0,
        [SendToSubmitter]   BIT                 NOT NULL DEFAULT 0,
        [SendToBod]         BIT                 NOT NULL DEFAULT 0,
        [IsActive]          BIT                 NOT NULL DEFAULT 1,
        [CreatedAt]         DATETIME            NOT NULL DEFAULT GETDATE(),
        [UpdatedAt]         DATETIME            NOT NULL DEFAULT GETDATE(),

        CONSTRAINT [PK_CSR_EvaluationForms] PRIMARY KEY CLUSTERED ([Id] ASC)
    );
    PRINT 'Created table: CSR_EvaluationForms';
END
GO

-- 2. Thêm cột FormId vào bảng CSR_ReviewCriteria
IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID('dbo.CSR_ReviewCriteria') 
      AND name = 'FormId'
)
BEGIN
    ALTER TABLE [dbo].[CSR_ReviewCriteria]
    ADD [FormId] INT NULL;

    ALTER TABLE [dbo].[CSR_ReviewCriteria]
    ADD CONSTRAINT [FK_CSR_ReviewCriteria_Forms] FOREIGN KEY ([FormId]) 
        REFERENCES [dbo].[CSR_EvaluationForms] ([Id]) ON DELETE CASCADE;
        
    PRINT 'Altered table: CSR_ReviewCriteria to add FormId';
END
GO

-- 3. Tạo hoặc thay thế Stored Procedures
-- A. usp_GetEvaluationForms
CREATE OR ALTER PROCEDURE [dbo].[usp_GetEvaluationForms]
    @SearchText NVARCHAR(200) = NULL,
    @IsActive   BIT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 
        f.[Id], f.[FormName], f.[SendToCustomer], f.[SendToPrd], f.[SendToSubmitter], f.[SendToBod],
        f.[IsActive], f.[CreatedAt], f.[UpdatedAt],
        CriteriaCount = (SELECT COUNT(*) FROM [dbo].[CSR_ReviewCriteria] WHERE [FormId] = f.[Id])
    FROM [dbo].[CSR_EvaluationForms] f
    WHERE (@SearchText IS NULL OR f.[FormName] LIKE '%' + @SearchText + '%')
      AND (@IsActive IS NULL OR f.[IsActive] = @IsActive)
    ORDER BY f.[FormName] ASC;
END
GO

-- B. usp_UpsertEvaluationForm
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
    IF @Id > 0
    BEGIN
        UPDATE [dbo].[CSR_EvaluationForms]
        SET [FormName]       = @FormName,
            [SendToCustomer] = @SendToCustomer,
            [SendToPrd]      = @SendToPrd,
            [SendToSubmitter]= @SendToSubmitter,
            [SendToBod]      = @SendToBod,
            [IsActive]       = @IsActive,
            [UpdatedAt]      = GETDATE()
        WHERE [Id] = @Id;

        SELECT @Id AS [FormId], N'Cập nhật thành công' AS [Message];
    END
    ELSE
    BEGIN
        INSERT INTO [dbo].[CSR_EvaluationForms] 
            ([FormName], [SendToCustomer], [SendToPrd], [SendToSubmitter], [SendToBod], [IsActive], [CreatedAt], [UpdatedAt])
        VALUES 
            (@FormName, @SendToCustomer, @SendToPrd, @SendToSubmitter, @SendToBod, @IsActive, GETDATE(), GETDATE());

        SELECT SCOPE_IDENTITY() AS [FormId], N'Thêm mới thành công' AS [Message];
    END
END
GO

-- 4. Seed dữ liệu mặc định ban đầu nếu bảng forms chưa có gì
IF NOT EXISTS (SELECT 1 FROM [dbo].[CSR_EvaluationForms])
BEGIN
    DECLARE @DefaultFormId INT;
    
    INSERT INTO [dbo].[CSR_EvaluationForms] 
        ([FormName], [SendToCustomer], [SendToPrd], [SendToSubmitter], [SendToBod], [IsActive], [CreatedAt], [UpdatedAt])
    VALUES 
        (N'Khảo sát Đón tiếp Khách hàng (Mặc định)', 1, 0, 0, 0, 1, GETDATE(), GETDATE());
        
    SET @DefaultFormId = SCOPE_IDENTITY();
    
    -- Gán toàn bộ tiêu chí cũ vào form mặc định
    UPDATE [dbo].[CSR_ReviewCriteria]
    SET [FormId] = @DefaultFormId
    WHERE [FormId] IS NULL;
    
    PRINT 'Seeded default evaluation form and migrated legacy criteria.';
END
GO
