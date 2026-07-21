-- Migration 79: Fleet Management — them menu items cho module Quan Ly Xe
USE CSR_DB;
GO

-- Lay ParentId cua menu nhom "vehicle" (da co san trong he thong)
DECLARE @VehicleGroupId INT;
SELECT @VehicleGroupId = Id FROM [dbo].[CSR_Menus] WHERE [MenuKey] = 'vehicle' AND [ParentId] IS NULL;

IF @VehicleGroupId IS NULL
BEGIN
    PRINT 'Khong tim thay menu nhom vehicle. Vui long kiem tra lai du lieu CSR_Menus.';
    RETURN;
END

PRINT 'Tim thay vehicle group Id = ' + CAST(@VehicleGroupId AS NVARCHAR);

-- 1. Cap nhat menu "vehicle.dashboard" da co: doi path thanh /vehicle (danh sach dat xe)
IF EXISTS (SELECT 1 FROM [dbo].[CSR_Menus] WHERE [MenuKey] = 'vehicle.dashboard')
BEGIN
    UPDATE [dbo].[CSR_Menus]
    SET [MenuName] = N'Danh Sách Đặt Xe',
        [Path]     = '/vehicle',
        [SortOrder] = 1
    WHERE [MenuKey] = 'vehicle.dashboard';
    PRINT 'Updated vehicle.dashboard menu';
END

-- 2. Them menu "vehicle.new" — Tao Yeu Cau Xe
IF NOT EXISTS (SELECT 1 FROM [dbo].[CSR_Menus] WHERE [MenuKey] = 'vehicle.new')
BEGIN
    INSERT INTO [dbo].[CSR_Menus] ([ParentId],[MenuKey],[MenuName],[Path],[SortOrder],[IsActive])
    VALUES (@VehicleGroupId, 'vehicle.new', N'Tạo Yêu Cầu Xe', '/vehicle/new', 2, 1);
    PRINT 'Added vehicle.new menu';
END

-- 3. Them menu "vehicle.config" — Cau Hinh Xe (chi Admin/PRD)
IF NOT EXISTS (SELECT 1 FROM [dbo].[CSR_Menus] WHERE [MenuKey] = 'vehicle.config')
BEGIN
    INSERT INTO [dbo].[CSR_Menus] ([ParentId],[MenuKey],[MenuName],[Path],[SortOrder],[IsActive])
    VALUES (@VehicleGroupId, 'vehicle.config', N'Cấu Hình Xe & Tài Xế', '/vehicle/config', 3, 1);
    PRINT 'Added vehicle.config menu';
END

-- 4. Phan quyen cho menu moi: vehicle.new — tat ca role
DECLARE @NewMenuId INT, @ConfigMenuId INT;
SELECT @NewMenuId    = Id FROM [dbo].[CSR_Menus] WHERE [MenuKey] = 'vehicle.new';
SELECT @ConfigMenuId = Id FROM [dbo].[CSR_Menus] WHERE [MenuKey] = 'vehicle.config';

-- vehicle.new: tat ca role deu co quyen
DECLARE @AllRoles TABLE (RoleName NVARCHAR(50));
INSERT INTO @AllRoles VALUES ('Admin'), ('BOD'), ('PRD'), ('User');

INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
SELECT @NewMenuId, RoleName
FROM @AllRoles
WHERE NOT EXISTS (
    SELECT 1 FROM [dbo].[CSR_RolePermissions]
    WHERE [MenuId] = @NewMenuId AND [Role] = RoleName
);

-- vehicle.config: chi Admin va PRD
INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
SELECT @ConfigMenuId, RoleName
FROM @AllRoles
WHERE RoleName IN ('Admin', 'PRD')
  AND NOT EXISTS (
    SELECT 1 FROM [dbo].[CSR_RolePermissions]
    WHERE [MenuId] = @ConfigMenuId AND [Role] = RoleName
);

PRINT 'Migration 79: Fleet menu items — Hoan thanh.';
GO
