-- Migration 99: Rename usp_Fleet_GetAdminEmails to usp_Fleet_GetTeamAdminEmails and filter by TeamAdmin role
USE CSR_DB;
GO

-- 1. Drop old stored procedure
IF OBJECT_ID('[dbo].[usp_Fleet_GetAdminEmails]', 'P') IS NOT NULL
BEGIN
    DROP PROCEDURE [dbo].[usp_Fleet_GetAdminEmails];
    PRINT 'Dropped usp_Fleet_GetAdminEmails';
END
GO

-- 2. Create new stored procedure filtering by TeamAdmin role
CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_GetTeamAdminEmails]
AS
BEGIN
    SET NOCOUNT ON;
    SELECT DISTINCT Email
    FROM [dbo].[CSR_Users]
    WHERE [Role] = 'TeamAdmin'
      AND [StatusId] = 1
      AND [Email] IS NOT NULL
      AND [Email] <> '';
END
GO
