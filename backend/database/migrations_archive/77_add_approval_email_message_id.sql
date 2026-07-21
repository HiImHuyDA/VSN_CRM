-- Migration 77: Them cot ApprovalEmailMessageId vao CSR_Projects de ho tro email threading
USE CSR_DB;
GO

-- 1. Them cot ApprovalEmailMessageId vao bang CSR_Projects
IF COL_LENGTH('dbo.CSR_Projects', 'ApprovalEmailMessageId') IS NULL
BEGIN
    ALTER TABLE [dbo].[CSR_Projects]
    ADD [ApprovalEmailMessageId] NVARCHAR(500) NULL;
    PRINT 'Da them cot ApprovalEmailMessageId vao CSR_Projects.';
END
ELSE
BEGIN
    PRINT 'Cot ApprovalEmailMessageId da ton tai.';
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

PRINT 'Migration 77: Hoan thanh. Da them cot ApprovalEmailMessageId va 2 stored procedures lien quan.';
GO
