-- =============================================
-- Migration: Create CSR_UploadedFiles and File Stored Procedures
-- =============================================

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='CSR_UploadedFiles' AND xtype='U')
BEGIN
    CREATE TABLE CSR_UploadedFiles (
        id INT IDENTITY(1,1) PRIMARY KEY,
        original_name NVARCHAR(255) NOT NULL,
        stored_name NVARCHAR(255) NOT NULL,
        file_path NVARCHAR(MAX) NOT NULL,
        file_extension NVARCHAR(50),
        mime_type NVARCHAR(100),
        file_size BIGINT,
        created_date DATETIME DEFAULT GETDATE(),
        uploaded_by NVARCHAR(50) NULL
    );
    PRINT 'Table CSR_UploadedFiles created.';
END
GO

-- =============================================
-- Procedure: usp_InsertUploadedFile
-- =============================================
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

-- =============================================
-- Procedure: usp_GetUploadedFileById
-- =============================================
CREATE OR ALTER PROCEDURE usp_GetUploadedFileById
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT * FROM CSR_UploadedFiles WHERE id = @Id;
END
GO

-- =============================================
-- Procedure: usp_DeleteUploadedFile
-- =============================================
CREATE OR ALTER PROCEDURE usp_DeleteUploadedFile
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM CSR_UploadedFiles WHERE id = @Id;
END
GO
