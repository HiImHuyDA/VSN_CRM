-- =============================================
-- 04_seed_initial_data.sql — Consolidated Master Initial Seed Data
-- =============================================

-- 1. Seed Master Statuses
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CSR_Statuses')
BEGIN
    MERGE [dbo].[CSR_Statuses] AS target
    USING (SELECT * FROM (VALUES
        (1, N'Hoạt động'),
        (2, N'Dừng'),
        (3, N'Mới'),
        (4, N'PRD đã duyệt'),
        (5, N'BOD đã duyệt'),
        (6, N'BOD từ chối'),
        (7, N'Hoàn thành'),
        (8, N'Chờ phản hồi'),
        (9, N'Đã hủy'),
        (10, N'PRD từ chối'),
        (11, N'Giám sát đã duyệt'),
        (12, N'Giám sát từ chối'),
        (13, N'Team Admin đã duyệt'),
        (14, N'Team Admin từ chối')
    ) AS tmp (Id, TenTrangThai)) AS source
    ON target.Id = source.Id
    WHEN MATCHED THEN UPDATE SET target.TenTrangThai = source.TenTrangThai
    WHEN NOT MATCHED THEN INSERT (Id, TenTrangThai) VALUES (source.Id, source.TenTrangThai);
END;
GO

-- 2. Seed Menus
IF NOT EXISTS (SELECT 1 FROM CSR_Menus)
BEGIN
    INSERT INTO [dbo].[CSR_Menus] ([ParentId], [MenuKey], [MenuName], [Path], [SortOrder], [IsActive])
    VALUES (16, 'vehicle.dashboard', N'Danh Sách Đặt Xe', '/vehicle', 1, 1);
    INSERT INTO [dbo].[CSR_Menus] ([ParentId], [MenuKey], [MenuName], [Path], [SortOrder], [IsActive])
    VALUES (16, 'vehicle.calendar', N'Lịch thực hiện', '/vehicle/calendar', 2, 1);
    INSERT INTO [dbo].[CSR_Menus] ([ParentId], [MenuKey], [MenuName], [Path], [SortOrder], [IsActive])
    VALUES (16, 'vehicle.new', N'Tạo Yêu Cầu Xe', '/vehicle/new', 3, 1);
    INSERT INTO [dbo].[CSR_Menus] ([ParentId], [MenuKey], [MenuName], [Path], [SortOrder], [IsActive])
    VALUES (16, 'vehicle.config', N'Cấu Hình Xe & Tài Xế', '/vehicle/config', 4, 1);
    INSERT INTO [dbo].[CSR_Menus] ([ParentId], [MenuKey], [MenuName], [Path], [SortOrder], [IsActive])
    VALUES (NULL, 'guest', N'Quản Lý Khách Hàng', NULL, 10, 1);
    INSERT INTO [dbo].[CSR_Menus] ([ParentId], [MenuKey], [MenuName], [Path], [SortOrder], [IsActive])
    VALUES (1, 'guest.dashboard', N'Tổng quan', '/', 10, 1);
    INSERT INTO [dbo].[CSR_Menus] ([ParentId], [MenuKey], [MenuName], [Path], [SortOrder], [IsActive])
    VALUES (9, 'guest.config.tasks', N'DS Công việc', '/config/tasks', 10, 1);
    INSERT INTO [dbo].[CSR_Menus] ([ParentId], [MenuKey], [MenuName], [Path], [SortOrder], [IsActive])
    VALUES (18, 'system-config.users', N'DS Tài khoản', '/config/users', 10, 1);
    INSERT INTO [dbo].[CSR_Menus] ([ParentId], [MenuKey], [MenuName], [Path], [SortOrder], [IsActive])
    VALUES (1, 'guest.submissions', N'Danh sách đơn', '/submissions', 20, 1);
    INSERT INTO [dbo].[CSR_Menus] ([ParentId], [MenuKey], [MenuName], [Path], [SortOrder], [IsActive])
    VALUES (9, 'guest.config.locations', N'DS Địa điểm', '/config/locations', 20, 1);
    INSERT INTO [dbo].[CSR_Menus] ([ParentId], [MenuKey], [MenuName], [Path], [SortOrder], [IsActive])
    VALUES (NULL, 'vehicle', N'Quản Lý Xe', NULL, 20, 1);
    INSERT INTO [dbo].[CSR_Menus] ([ParentId], [MenuKey], [MenuName], [Path], [SortOrder], [IsActive])
    VALUES (18, 'system-config.audit-logs', N'Lịch sử hệ thống', '/config/audit-logs', 20, 1);
    INSERT INTO [dbo].[CSR_Menus] ([ParentId], [MenuKey], [MenuName], [Path], [SortOrder], [IsActive])
    VALUES (1, 'guest.new', N'Tạo đơn mới', '/new', 30, 1);
    INSERT INTO [dbo].[CSR_Menus] ([ParentId], [MenuKey], [MenuName], [Path], [SortOrder], [IsActive])
    VALUES (9, 'guest.config.customers', N'DS Khách hàng', '/config/customers', 30, 1);
    INSERT INTO [dbo].[CSR_Menus] ([ParentId], [MenuKey], [MenuName], [Path], [SortOrder], [IsActive])
    VALUES (NULL, 'system-config', N'Cấu Hình Hệ Thống', NULL, 30, 1);
    INSERT INTO [dbo].[CSR_Menus] ([ParentId], [MenuKey], [MenuName], [Path], [SortOrder], [IsActive])
    VALUES (18, 'system-config.menu-permissions', N'Phân quyền Menu', '/config/menu-permissions', 30, 1);
    INSERT INTO [dbo].[CSR_Menus] ([ParentId], [MenuKey], [MenuName], [Path], [SortOrder], [IsActive])
    VALUES (1, 'guest.calendar', N'Lịch tiếp khách', '/guest-calendar', 40, 1);
    INSERT INTO [dbo].[CSR_Menus] ([ParentId], [MenuKey], [MenuName], [Path], [SortOrder], [IsActive])
    VALUES (9, 'guest.config.email-campaigns', N'Email Marketing', '/config/email-campaigns', 40, 1);
    INSERT INTO [dbo].[CSR_Menus] ([ParentId], [MenuKey], [MenuName], [Path], [SortOrder], [IsActive])
    VALUES (1, 'guest.tasks', N'Quản lý công việc', '/tasks', 50, 1);
    INSERT INTO [dbo].[CSR_Menus] ([ParentId], [MenuKey], [MenuName], [Path], [SortOrder], [IsActive])
    VALUES (9, 'guest.config.restaurants', N'Nhà hàng & Thực đơn', '/config/restaurants', 50, 1);
    INSERT INTO [dbo].[CSR_Menus] ([ParentId], [MenuKey], [MenuName], [Path], [SortOrder], [IsActive])
    VALUES (1, 'guest.feedback', N'Quản lý Phản hồi', '/feedback-management', 60, 1);
    INSERT INTO [dbo].[CSR_Menus] ([ParentId], [MenuKey], [MenuName], [Path], [SortOrder], [IsActive])
    VALUES (9, 'guest.config.meeting-rooms', N'Phòng họp', '/config/meeting-rooms', 60, 1);
    INSERT INTO [dbo].[CSR_Menus] ([ParentId], [MenuKey], [MenuName], [Path], [SortOrder], [IsActive])
    VALUES (1, 'guest.reports', N'Báo cáo & Thống kê', '/reports', 70, 1);
    INSERT INTO [dbo].[CSR_Menus] ([ParentId], [MenuKey], [MenuName], [Path], [SortOrder], [IsActive])
    VALUES (1, 'guest.config', N'Cấu hình', NULL, 80, 1);
END;
GO

-- 3. Seed Role Permissions
IF NOT EXISTS (SELECT 1 FROM CSR_RolePermissions)
BEGIN
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'Admin' FROM CSR_Menus WHERE MenuKey = 'guest';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'BOD' FROM CSR_Menus WHERE MenuKey = 'guest';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'PRD' FROM CSR_Menus WHERE MenuKey = 'guest';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'TeamAdmin' FROM CSR_Menus WHERE MenuKey = 'guest';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'User' FROM CSR_Menus WHERE MenuKey = 'guest';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'Admin' FROM CSR_Menus WHERE MenuKey = 'guest.calendar';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'BOD' FROM CSR_Menus WHERE MenuKey = 'guest.calendar';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'PRD' FROM CSR_Menus WHERE MenuKey = 'guest.calendar';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'TeamAdmin' FROM CSR_Menus WHERE MenuKey = 'guest.calendar';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'User' FROM CSR_Menus WHERE MenuKey = 'guest.calendar';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'Admin' FROM CSR_Menus WHERE MenuKey = 'guest.config';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'PRD' FROM CSR_Menus WHERE MenuKey = 'guest.config';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'Admin' FROM CSR_Menus WHERE MenuKey = 'guest.config.customers';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'PRD' FROM CSR_Menus WHERE MenuKey = 'guest.config.customers';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'Admin' FROM CSR_Menus WHERE MenuKey = 'guest.config.email-campaigns';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'PRD' FROM CSR_Menus WHERE MenuKey = 'guest.config.email-campaigns';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'Admin' FROM CSR_Menus WHERE MenuKey = 'guest.config.locations';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'PRD' FROM CSR_Menus WHERE MenuKey = 'guest.config.locations';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'Admin' FROM CSR_Menus WHERE MenuKey = 'guest.config.meeting-rooms';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'PRD' FROM CSR_Menus WHERE MenuKey = 'guest.config.meeting-rooms';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'Admin' FROM CSR_Menus WHERE MenuKey = 'guest.config.restaurants';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'PRD' FROM CSR_Menus WHERE MenuKey = 'guest.config.restaurants';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'Admin' FROM CSR_Menus WHERE MenuKey = 'guest.config.tasks';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'PRD' FROM CSR_Menus WHERE MenuKey = 'guest.config.tasks';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'Admin' FROM CSR_Menus WHERE MenuKey = 'guest.dashboard';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'BOD' FROM CSR_Menus WHERE MenuKey = 'guest.dashboard';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'PRD' FROM CSR_Menus WHERE MenuKey = 'guest.dashboard';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'TeamAdmin' FROM CSR_Menus WHERE MenuKey = 'guest.dashboard';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'User' FROM CSR_Menus WHERE MenuKey = 'guest.dashboard';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'Admin' FROM CSR_Menus WHERE MenuKey = 'guest.feedback';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'BOD' FROM CSR_Menus WHERE MenuKey = 'guest.feedback';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'PRD' FROM CSR_Menus WHERE MenuKey = 'guest.feedback';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'TeamAdmin' FROM CSR_Menus WHERE MenuKey = 'guest.feedback';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'User' FROM CSR_Menus WHERE MenuKey = 'guest.feedback';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'Admin' FROM CSR_Menus WHERE MenuKey = 'guest.new';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'BOD' FROM CSR_Menus WHERE MenuKey = 'guest.new';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'PRD' FROM CSR_Menus WHERE MenuKey = 'guest.new';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'TeamAdmin' FROM CSR_Menus WHERE MenuKey = 'guest.new';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'User' FROM CSR_Menus WHERE MenuKey = 'guest.new';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'Admin' FROM CSR_Menus WHERE MenuKey = 'guest.reports';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'BOD' FROM CSR_Menus WHERE MenuKey = 'guest.reports';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'PRD' FROM CSR_Menus WHERE MenuKey = 'guest.reports';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'Admin' FROM CSR_Menus WHERE MenuKey = 'guest.submissions';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'BOD' FROM CSR_Menus WHERE MenuKey = 'guest.submissions';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'PRD' FROM CSR_Menus WHERE MenuKey = 'guest.submissions';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'TeamAdmin' FROM CSR_Menus WHERE MenuKey = 'guest.submissions';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'User' FROM CSR_Menus WHERE MenuKey = 'guest.submissions';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'Admin' FROM CSR_Menus WHERE MenuKey = 'guest.tasks';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'Admin' FROM CSR_Menus WHERE MenuKey = 'system-config';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'Admin' FROM CSR_Menus WHERE MenuKey = 'system-config.audit-logs';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'Admin' FROM CSR_Menus WHERE MenuKey = 'system-config.menu-permissions';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'Admin' FROM CSR_Menus WHERE MenuKey = 'system-config.users';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'Admin' FROM CSR_Menus WHERE MenuKey = 'vehicle';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'BOD' FROM CSR_Menus WHERE MenuKey = 'vehicle';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'PRD' FROM CSR_Menus WHERE MenuKey = 'vehicle';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'TeamAdmin' FROM CSR_Menus WHERE MenuKey = 'vehicle';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'User' FROM CSR_Menus WHERE MenuKey = 'vehicle';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'Admin' FROM CSR_Menus WHERE MenuKey = 'vehicle.calendar';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'BOD' FROM CSR_Menus WHERE MenuKey = 'vehicle.calendar';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'PRD' FROM CSR_Menus WHERE MenuKey = 'vehicle.calendar';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'TeamAdmin' FROM CSR_Menus WHERE MenuKey = 'vehicle.calendar';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'User' FROM CSR_Menus WHERE MenuKey = 'vehicle.calendar';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'Admin' FROM CSR_Menus WHERE MenuKey = 'vehicle.config';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'PRD' FROM CSR_Menus WHERE MenuKey = 'vehicle.config';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'TeamAdmin' FROM CSR_Menus WHERE MenuKey = 'vehicle.config';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'Admin' FROM CSR_Menus WHERE MenuKey = 'vehicle.dashboard';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'BOD' FROM CSR_Menus WHERE MenuKey = 'vehicle.dashboard';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'PRD' FROM CSR_Menus WHERE MenuKey = 'vehicle.dashboard';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'TeamAdmin' FROM CSR_Menus WHERE MenuKey = 'vehicle.dashboard';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'User' FROM CSR_Menus WHERE MenuKey = 'vehicle.dashboard';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'Admin' FROM CSR_Menus WHERE MenuKey = 'vehicle.new';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'BOD' FROM CSR_Menus WHERE MenuKey = 'vehicle.new';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'PRD' FROM CSR_Menus WHERE MenuKey = 'vehicle.new';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'TeamAdmin' FROM CSR_Menus WHERE MenuKey = 'vehicle.new';
    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])
    SELECT Id, 'User' FROM CSR_Menus WHERE MenuKey = 'vehicle.new';
END;
GO

