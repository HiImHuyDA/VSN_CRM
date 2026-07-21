DROP PROCEDURE IF EXISTS [dbo].[usp_AddAuditLog];
DROP PROCEDURE IF EXISTS [dbo].[usp_GetAuditLogs];
DROP TABLE IF EXISTS [dbo].[CSR_AuditLogs];
GO

CREATE TABLE [dbo].[CSR_AuditLogs] (
    [Id] INT IDENTITY(1,1) PRIMARY KEY,
    [Action] NVARCHAR(100) NOT NULL,
    [MNV] NVARCHAR(50) NOT NULL,
    [Role] NVARCHAR(50) NULL,
    [Department] NVARCHAR(100) NULL,
    [Details] NVARCHAR(MAX) NULL,
    [SubmissionId] NVARCHAR(50) NULL,
    [CreatedAt] DATETIME DEFAULT GETDATE()
);
GO

CREATE PROCEDURE [dbo].[usp_AddAuditLog]
    @Action NVARCHAR(100),
    @MNV NVARCHAR(50),
    @Role NVARCHAR(50) = NULL,
    @Department NVARCHAR(100) = NULL,
    @Details NVARCHAR(MAX) = NULL,
    @SubmissionId NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO [dbo].[CSR_AuditLogs] ([Action], [MNV], [Role], [Department], [Details], [SubmissionId], [CreatedAt])
    VALUES (@Action, @MNV, @Role, @Department, @Details, @SubmissionId, GETDATE());
END
GO

CREATE PROCEDURE [dbo].[usp_GetAuditLogs]
    @MNV NVARCHAR(50) = NULL,
    @Department NVARCHAR(100) = NULL,
    @Role NVARCHAR(50) = NULL,
    @Action NVARCHAR(100) = NULL,
    @StartDate DATETIME = NULL,
    @EndDate DATETIME = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [Id], [Action], [MNV], [Role], [Department], [Details], [SubmissionId], [CreatedAt]
    FROM [dbo].[CSR_AuditLogs]
    WHERE (@MNV IS NULL OR [MNV] = @MNV)
      AND (@Department IS NULL OR [Department] = @Department)
      AND (@Role IS NULL OR [Role] = @Role)
      AND (@Action IS NULL OR [Action] = @Action)
      AND (@StartDate IS NULL OR [CreatedAt] >= @StartDate)
      AND (@EndDate IS NULL OR [CreatedAt] <= @EndDate)
    ORDER BY [CreatedAt] DESC;
END
GO
