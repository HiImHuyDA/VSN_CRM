USE CSR_DB;
GO
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('dbo.CSR_Users') 
    AND name = 'Department'
)
BEGIN
    ALTER TABLE [dbo].[CSR_Users] ADD [Department] NVARCHAR(200) NULL;
END
GO

