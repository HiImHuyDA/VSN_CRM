-- ============================================================
-- Migration 90: Add Vehicle Calendar Menu
-- ============================================================
USE CSR_DB;
GO

DECLARE @VehicleGroupId INT;
SELECT @VehicleGroupId = Id FROM [dbo].[CSR_Menus] WHERE [MenuKey] = 'vehicle' AND [ParentId] IS NULL;

IF @VehicleGroupId IS NOT NULL
BEGIN
    -- 1. Thêm menu vehicle.calendar nếu chưa tồn tại
    IF NOT EXISTS (SELECT 1 FROM [dbo].[CSR_Menus] WHERE [MenuKey] = 'vehicle.calendar')
    BEGIN
        -- Thêm vào vị trí thứ 2 (giữa Đặt xe và Tạo yêu cầu xe, hoặc sau Đặt xe)
        -- Cập nhật SortOrder của các menu khác
        UPDATE [dbo].[CSR_Menus] SET [SortOrder] = [SortOrder] + 1 WHERE [ParentId] = @VehicleGroupId AND [SortOrder] >= 2;
        
        INSERT INTO [dbo].[CSR_Menus] ([ParentId], [MenuKey], [MenuName], [Path], [SortOrder], [IsActive])
        VALUES (@VehicleGroupId, 'vehicle.calendar', N'Lịch thực hiện', '/vehicle/calendar', 2, 1);
        PRINT 'Added vehicle.calendar menu';
    END

    -- 2. Phân quyền cho menu vehicle.calendar - Tất cả các vai trò
    DECLARE @CalendarMenuId INT;
    SELECT @CalendarMenuId = Id FROM [dbo].[CSR_Menus] WHERE [MenuKey] = 'vehicle.calendar';

    IF @CalendarMenuId IS NOT NULL
    BEGIN
        DECLARE @Roles TABLE (RoleName NVARCHAR(50));
        INSERT INTO @Roles VALUES ('Admin'), ('BOD'), ('PRD'), ('User'), ('TeamAdmin');

        INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
        SELECT @CalendarMenuId, RoleName
        FROM @Roles
        WHERE NOT EXISTS (
            SELECT 1 FROM [dbo].[CSR_RolePermissions]
            WHERE [MenuId] = @CalendarMenuId AND [Role] = RoleName
        );
        PRINT 'Granted permissions for vehicle.calendar menu';
    END
END
ELSE
BEGIN
    PRINT 'Not found vehicle group menu';
END
GO
