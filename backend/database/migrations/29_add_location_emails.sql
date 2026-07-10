USE CSR_DB;
GO

-- 1. Bổ sung cột NotificationEmails vào bảng CSR_Locations
IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID('dbo.CSR_Locations') 
    AND name = 'NotificationEmails'
)
BEGIN
    ALTER TABLE [dbo].[CSR_Locations] ADD [NotificationEmails] NVARCHAR(MAX) NULL;
    PRINT 'Added NotificationEmails column to CSR_Locations';
END
GO

-- 2. Cập nhật usp_GetLocations
CREATE OR ALTER PROCEDURE [dbo].[usp_GetLocations]
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [Id], [Name], [NotificationEmails], [IsActive]
    FROM [dbo].[CSR_Locations]
    ORDER BY [Name];
END;
GO

-- 3. Cập nhật usp_UpsertLocation
CREATE OR ALTER PROCEDURE [dbo].[usp_UpsertLocation]
    @Id INT,
    @Name NVARCHAR(100),
    @NotificationEmails NVARCHAR(MAX) = NULL,
    @IsActive BIT
AS
BEGIN
    SET NOCOUNT ON;
    IF @Id = 0
    BEGIN
        INSERT INTO [dbo].[CSR_Locations] ([Name], [NotificationEmails], [IsActive]) 
        VALUES (@Name, @NotificationEmails, @IsActive);
    END
    ELSE
    BEGIN
        UPDATE [dbo].[CSR_Locations] 
        SET [Name] = @Name, [NotificationEmails] = @NotificationEmails, [IsActive] = @IsActive 
        WHERE [Id] = @Id;
    END
END;
GO

PRINT 'Migration 29 applied successfully';
GO
