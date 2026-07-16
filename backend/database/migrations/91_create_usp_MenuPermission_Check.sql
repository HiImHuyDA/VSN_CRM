-- Migration 91: Create usp_MenuPermission_Check Stored Procedure
USE CSR_DB;
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_MenuPermission_Check]
    @Role NVARCHAR(50),
    @MenuKey NVARCHAR(100),
    @HasPermission INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    
    IF EXISTS (
        SELECT 1 
        FROM [dbo].[CSR_RolePermissions] rp
        INNER JOIN [dbo].[CSR_Menus] m ON rp.MenuId = m.Id
        WHERE rp.Role = @Role AND m.MenuKey = @MenuKey AND m.IsActive = 1
    )
    BEGIN
        SET @HasPermission = 1;
    END
    ELSE
    BEGIN
        SET @HasPermission = 0;
    END
END
GO
