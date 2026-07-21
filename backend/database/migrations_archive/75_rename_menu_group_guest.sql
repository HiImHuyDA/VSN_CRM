-- Migration 75: Đổi tên nhóm menu 'guest' thành 'Quản Lý Khách Hàng'
USE CSR_DB;
GO

UPDATE [dbo].[CSR_Menus]
SET [MenuName] = N'Quản Lý Khách Hàng'
WHERE [MenuKey] = 'guest';
GO

PRINT 'Migration 75: Renamed menu group guest to Quản Lý Khách Hàng.';
GO
