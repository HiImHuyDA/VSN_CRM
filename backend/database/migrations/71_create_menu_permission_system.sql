-- Migration 71: Hệ thống Menu động + Phân quyền theo Role
-- Tái cấu trúc sidebar thành 3 group lớn: Quản Lý Tiếp Khách, Quản Lý Xe, Cấu hình hệ thống.
-- DS Tài khoản + Lịch sử hệ thống chuyển vào "Cấu hình hệ thống" (chỉ Admin).
-- Các danh mục (Công việc/Địa điểm/Khách hàng/Email/Nhà hàng/Phòng họp) vẫn ở trong
-- "Quản Lý Tiếp Khách" (nhóm con "Cấu hình" bên trong), như trước đây (Admin, PRD).
USE CSR_DB;
GO

-- 1. Bảng cây menu (tự tham chiếu để hỗ trợ menu lớn > menu con > menu cháu)
IF OBJECT_ID('dbo.CSR_Menus', 'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[CSR_Menus]
    (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [ParentId] INT NULL FOREIGN KEY REFERENCES [dbo].[CSR_Menus]([Id]),
        [MenuKey] NVARCHAR(100) NOT NULL UNIQUE,
        -- mã cố định, dùng để check quyền/route, KHÔNG dùng tên hiển thị
        [MenuName] NVARCHAR(200) NOT NULL,
        [Icon] NVARCHAR(20) NULL,
        [Path] NVARCHAR(200) NULL,
        -- NULL = menu nhóm (chỉ để mở rộng, không phải link)
        [SortOrder] INT NOT NULL DEFAULT 0,
        [IsActive] BIT NOT NULL DEFAULT 1
    );
END
GO

-- 2. Bảng phân quyền menu theo Role (nhiều-nhiều)
IF OBJECT_ID('dbo.CSR_RolePermissions', 'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[CSR_RolePermissions]
    (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [MenuId] INT NOT NULL FOREIGN KEY REFERENCES [dbo].[CSR_Menus]([Id]) ON DELETE CASCADE,
        [Role] NVARCHAR(50) NOT NULL,
        CONSTRAINT UQ_RolePermission UNIQUE ([MenuId], [Role])
    );
END
GO

-- 3. Seed dữ liệu menu (chỉ chạy nếu bảng đang rỗng, để không insert trùng khi chạy lại migration)
IF NOT EXISTS (SELECT 1
FROM [dbo].[CSR_Menus])
BEGIN
    -- ===== NHÓM 1: QUẢN LÝ TIẾP KHÁCH =====
    INSERT INTO [dbo].[CSR_Menus]
        ([ParentId], [MenuKey], [MenuName], [Icon], [Path], [SortOrder])
    VALUES
        (NULL, 'guest', N'Quản Lý Tiếp Khách', N'💼', NULL, 10);

    DECLARE @GuestId INT = (SELECT Id
    FROM [dbo].[CSR_Menus]
    WHERE MenuKey = 'guest');

    INSERT INTO [dbo].[CSR_Menus]
        ([ParentId], [MenuKey], [MenuName], [Icon], [Path], [SortOrder])
    VALUES
        (@GuestId, 'guest.dashboard', N'Tổng quan', N'🏠', '/', 10),
        (@GuestId, 'guest.submissions', N'Danh sách đơn', N'📋', '/submissions', 20),
        (@GuestId, 'guest.new', N'Tạo đơn mới', N'📝', '/new', 30),
        (@GuestId, 'guest.calendar', N'Lịch tiếp khách', N'🗓️', '/guest-calendar', 40),
        (@GuestId, 'guest.tasks', N'Quản lý công việc', N'🎯', '/tasks', 50),
        (@GuestId, 'guest.feedback', N'Quản lý Phản hồi', N'💬', '/feedback-management', 60),
        (@GuestId, 'guest.reports', N'Báo cáo & Thống kê', N'📊', '/reports', 70);

    -- Nhóm con "Cấu hình" NẰM BÊN TRONG Quản Lý Tiếp Khách (không phải Cấu hình hệ thống toàn cục)
    INSERT INTO [dbo].[CSR_Menus]
        ([ParentId], [MenuKey], [MenuName], [Icon], [Path], [SortOrder])
    VALUES
        (@GuestId, 'guest.config', N'Cấu hình', N'⚙️', NULL, 80);

    DECLARE @GuestConfigId INT = (SELECT Id
    FROM [dbo].[CSR_Menus]
    WHERE MenuKey = 'guest.config');

    INSERT INTO [dbo].[CSR_Menus]
        ([ParentId], [MenuKey], [MenuName], [Icon], [Path], [SortOrder])
    VALUES
        (@GuestConfigId, 'guest.config.tasks', N'DS Công việc', N'✅', '/config/tasks', 10),
        (@GuestConfigId, 'guest.config.locations', N'DS Địa điểm', N'🏢', '/config/locations', 20),
        (@GuestConfigId, 'guest.config.customers', N'DS Khách hàng', N'🤝', '/config/customers', 30),
        (@GuestConfigId, 'guest.config.email-campaigns', N'Email Marketing', N'📧', '/config/email-campaigns', 40),
        (@GuestConfigId, 'guest.config.restaurants', N'Nhà hàng & Thực đơn', N'🍽️', '/config/restaurants', 50),
        (@GuestConfigId, 'guest.config.meeting-rooms', N'Phòng họp', N'🚪', '/config/meeting-rooms', 60);

    -- ===== NHÓM 2: QUẢN LÝ XE (placeholder, xây dựng sau) =====
    INSERT INTO [dbo].[CSR_Menus]
        ([ParentId], [MenuKey], [MenuName], [Icon], [Path], [SortOrder])
    VALUES
        (NULL, 'vehicle', N'Quản Lý Xe', N'🚗', NULL, 20);

    DECLARE @VehicleId INT = (SELECT Id
    FROM [dbo].[CSR_Menus]
    WHERE MenuKey = 'vehicle');

    INSERT INTO [dbo].[CSR_Menus]
        ([ParentId], [MenuKey], [MenuName], [Icon], [Path], [SortOrder])
    VALUES
        (@VehicleId, 'vehicle.dashboard', N'Tổng quan', N'🏠', '/vehicle', 10);

    -- ===== NHÓM 3: CẤU HÌNH HỆ THỐNG (toàn cục, chỉ Admin) =====
    INSERT INTO [dbo].[CSR_Menus]
        ([ParentId], [MenuKey], [MenuName], [Icon], [Path], [SortOrder])
    VALUES
        (NULL, 'system-config', N'Cấu Hình Hệ Thống', N'🛠️', NULL, 30);

    DECLARE @SysConfigId INT = (SELECT Id
    FROM [dbo].[CSR_Menus]
    WHERE MenuKey = 'system-config');

    INSERT INTO [dbo].[CSR_Menus]
        ([ParentId], [MenuKey], [MenuName], [Icon], [Path], [SortOrder])
    VALUES
        (@SysConfigId, 'system-config.users', N'DS Tài khoản', N'👥', '/config/users', 10),
        (@SysConfigId, 'system-config.audit-logs', N'Lịch sử hệ thống', N'🕒', '/config/audit-logs', 20),
        (@SysConfigId, 'system-config.menu-permissions', N'Phân quyền Menu', N'🔐', '/config/menu-permissions', 30);

    -- ===== SEED PHÂN QUYỀN (giữ đúng logic hiện có, không ai bị mất quyền khi chuyển đổi) =====
    -- guest + các menu nghiệp vụ cơ bản: TẤT CẢ role (Admin, BOD, PRD, User)
    INSERT INTO [dbo].[CSR_RolePermissions]
        (MenuId, Role)
    SELECT m.Id, r.Role
    FROM [dbo].[CSR_Menus] m
    CROSS JOIN (VALUES
            ('Admin'),
            ('BOD'),
            ('PRD'),
            ('User')) r(Role)
    WHERE m.MenuKey IN ('guest', 'guest.dashboard', 'guest.submissions', 'guest.new', 'guest.calendar', 'guest.tasks');

    -- guest.feedback, guest.reports: Admin, BOD, PRD (giống điều kiện cũ trong Sidebar.jsx/App.jsx)
    INSERT INTO [dbo].[CSR_RolePermissions]
        (MenuId, Role)
    SELECT m.Id, r.Role
    FROM [dbo].[CSR_Menus] m
    CROSS JOIN (VALUES
            ('Admin'),
            ('BOD'),
            ('PRD')) r(Role)
    WHERE m.MenuKey IN ('guest.feedback', 'guest.reports');

    -- guest.config (và toàn bộ menu con): Admin, PRD (giống điều kiện cũ)
    INSERT INTO [dbo].[CSR_RolePermissions]
        (MenuId, Role)
    SELECT m.Id, r.Role
    FROM [dbo].[CSR_Menus] m
    CROSS JOIN (VALUES
            ('Admin'),
            ('PRD')) r(Role)
    WHERE m.MenuKey LIKE 'guest.config%';

    -- vehicle (toàn bộ, placeholder): mặc định chỉ Admin - anh có thể tự mở rộng quyền qua UI Phân quyền Menu sau khi build xong
    INSERT INTO [dbo].[CSR_RolePermissions]
        (MenuId, Role)
    SELECT m.Id, 'Admin'
    FROM [dbo].[CSR_Menus] m
    WHERE m.MenuKey LIKE 'vehicle%';

    -- system-config (toàn bộ): CHỈ Admin
    INSERT INTO [dbo].[CSR_RolePermissions]
        (MenuId, Role)
    SELECT m.Id, 'Admin'
    FROM [dbo].[CSR_Menus] m
    WHERE m.MenuKey LIKE 'system-config%';
END
GO

-- 4. usp_GetMyMenu: trả về toàn bộ menu mà 1 Role được phép thấy (dạng phẳng, FE tự dựng cây theo ParentId)
CREATE OR ALTER PROCEDURE [dbo].[usp_GetMyMenu]
    @Role NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT DISTINCT m.[Id], m.[ParentId], m.[MenuKey], m.[MenuName], m.[Icon], m.[Path], m.[SortOrder]
    FROM [dbo].[CSR_Menus] m
        INNER JOIN [dbo].[CSR_RolePermissions] rp ON rp.[MenuId] = m.[Id]
    WHERE rp.[Role] = @Role AND m.[IsActive] = 1
    ORDER BY m.[SortOrder];
END
GO

-- 5. usp_GetMenuPermissionsMatrix: trả về toàn bộ menu (kể cả nhóm) + role nào đang được gán,
--    dùng để dựng bảng ma trận (menu x role) cho màn hình Admin cấu hình phân quyền.
CREATE OR ALTER PROCEDURE [dbo].[usp_GetMenuPermissionsMatrix]
AS
BEGIN
    SET NOCOUNT ON;

    SELECT m.[Id], m.[ParentId], m.[MenuKey], m.[MenuName], m.[Icon], m.[Path], m.[SortOrder], m.[IsActive]
    FROM [dbo].[CSR_Menus] m
    ORDER BY m.[SortOrder];

    SELECT [MenuId], [Role]
    FROM [dbo].[CSR_RolePermissions];
END
GO

-- 6. usp_UpdateMenuRolePermissions: thay toàn bộ danh sách Role được phép cho 1 MenuId
--    @RolesCSV dạng "Admin,BOD,PRD" (rỗng = xoá hết quyền, không role nào được vào)
CREATE OR ALTER PROCEDURE [dbo].[usp_UpdateMenuRolePermissions]
    @MenuId    INT,
    @RolesCSV  NVARCHAR(200) = ''
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        DELETE FROM [dbo].[CSR_RolePermissions] WHERE [MenuId] = @MenuId;

        IF @RolesCSV IS NOT NULL AND @RolesCSV <> ''
        BEGIN
        INSERT INTO [dbo].[CSR_RolePermissions]
            (MenuId, Role)
        SELECT @MenuId, value
        FROM STRING_SPLIT(@RolesCSV, ',')
        WHERE value <> '';
    END

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        DECLARE @Err NVARCHAR(500) = ERROR_MESSAGE();
        RAISERROR(@Err, 16, 1);
    END CATCH
END
GO

PRINT 'Migration 71: Created CSR_Menus / CSR_RolePermissions, seeded existing menu structure + Vehicle Management placeholder + system-config group, and created 3 stored procedures.';
GO