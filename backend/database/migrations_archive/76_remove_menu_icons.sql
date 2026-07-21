-- Migration 76: Xoa cot Icon trong CSR_Menus va cap nhat Stored Procedures lien quan
USE CSR_DB;
GO

-- 1. Cap nhat stored procedure usp_GetMyMenu de khong tra ve cot Icon
CREATE OR ALTER PROCEDURE [dbo].[usp_GetMyMenu]
    @Role NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Neu la Admin, tra ve toan bo menu dang hoat dong ma khong can check bang phan quyen
    IF @Role = 'Admin'
    BEGIN
        SELECT [Id], [ParentId], [MenuKey], [MenuName], [Path], [SortOrder]
        FROM [dbo].[CSR_Menus]
        WHERE [IsActive] = 1
        ORDER BY [SortOrder];
    END
    ELSE
    BEGIN
        SELECT DISTINCT m.[Id], m.[ParentId], m.[MenuKey], m.[MenuName], m.[Path], m.[SortOrder]
        FROM [dbo].[CSR_Menus] m
            INNER JOIN [dbo].[CSR_RolePermissions] rp ON rp.[MenuId] = m.[Id]
        WHERE rp.[Role] = @Role AND m.[IsActive] = 1
        ORDER BY m.[SortOrder];
    END
END
GO

-- 2. Cap nhat stored procedure usp_GetMenuPermissionsMatrix de khong tra ve cot Icon
CREATE OR ALTER PROCEDURE [dbo].[usp_GetMenuPermissionsMatrix]
AS
BEGIN
    SET NOCOUNT ON;

    SELECT m.[Id], m.[ParentId], m.[MenuKey], m.[MenuName], m.[Path], m.[SortOrder], m.[IsActive]
    FROM [dbo].[CSR_Menus] m
    ORDER BY m.[SortOrder];

    SELECT [MenuId], [Role]
    FROM [dbo].[CSR_RolePermissions];
END
GO

-- 3. Xoa cot Icon khoi bang CSR_Menus
IF COL_LENGTH('dbo.CSR_Menus', 'Icon') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[CSR_Menus] DROP COLUMN [Icon];
    PRINT 'Da xoa cot Icon khoi bang CSR_Menus thanh cong.';
END
ELSE
BEGIN
    PRINT 'Cot Icon khong ton tai hoac da duoc xoa truoc do.';
END
GO
