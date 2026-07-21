-- 105_add_project_parent_version_sp.sql

CREATE OR ALTER PROCEDURE usp_Project_GetByParentAndVersion
    @ParentId NVARCHAR(100),
    @Version INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT Project_id, AgendaJsonData FROM CSR_Projects WHERE ParentId = @ParentId AND Version = @Version;
END
GO
