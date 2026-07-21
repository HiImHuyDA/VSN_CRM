-- Migration 72: Sửa dữ liệu cột Icon trong CSR_Menus bị hỏng (mất emoji)
-- Nguyên nhân: migration 71 insert giá trị Icon KHÔNG có tiền tố N (Unicode) trước literal,
-- khiến emoji bị SQL Server chuyển đổi sai theo code page mặc định của DB (mất/méo ký tự).
-- Migration này UPDATE lại đúng giá trị emoji cho từng MenuKey.
USE CSR_DB;
GO

UPDATE [dbo].[CSR_Menus] SET [Icon] = N'💼' WHERE [MenuKey] = 'guest';
UPDATE [dbo].[CSR_Menus] SET [Icon] = N'🏠' WHERE [MenuKey] = 'guest.dashboard';
UPDATE [dbo].[CSR_Menus] SET [Icon] = N'📋' WHERE [MenuKey] = 'guest.submissions';
UPDATE [dbo].[CSR_Menus] SET [Icon] = N'📝' WHERE [MenuKey] = 'guest.new';
UPDATE [dbo].[CSR_Menus] SET [Icon] = N'🗓️' WHERE [MenuKey] = 'guest.calendar';
UPDATE [dbo].[CSR_Menus] SET [Icon] = N'🎯' WHERE [MenuKey] = 'guest.tasks';
UPDATE [dbo].[CSR_Menus] SET [Icon] = N'💬' WHERE [MenuKey] = 'guest.feedback';
UPDATE [dbo].[CSR_Menus] SET [Icon] = N'📊' WHERE [MenuKey] = 'guest.reports';
UPDATE [dbo].[CSR_Menus] SET [Icon] = N'⚙️' WHERE [MenuKey] = 'guest.config';
UPDATE [dbo].[CSR_Menus] SET [Icon] = N'✅' WHERE [MenuKey] = 'guest.config.tasks';
UPDATE [dbo].[CSR_Menus] SET [Icon] = N'🏢' WHERE [MenuKey] = 'guest.config.locations';
UPDATE [dbo].[CSR_Menus] SET [Icon] = N'🤝' WHERE [MenuKey] = 'guest.config.customers';
UPDATE [dbo].[CSR_Menus] SET [Icon] = N'📧' WHERE [MenuKey] = 'guest.config.email-campaigns';
UPDATE [dbo].[CSR_Menus] SET [Icon] = N'🍽️' WHERE [MenuKey] = 'guest.config.restaurants';
UPDATE [dbo].[CSR_Menus] SET [Icon] = N'🚪' WHERE [MenuKey] = 'guest.config.meeting-rooms';
UPDATE [dbo].[CSR_Menus] SET [Icon] = N'🚗' WHERE [MenuKey] = 'vehicle';
UPDATE [dbo].[CSR_Menus] SET [Icon] = N'🏠' WHERE [MenuKey] = 'vehicle.dashboard';
UPDATE [dbo].[CSR_Menus] SET [Icon] = N'🛠️' WHERE [MenuKey] = 'system-config';
UPDATE [dbo].[CSR_Menus] SET [Icon] = N'👥' WHERE [MenuKey] = 'system-config.users';
UPDATE [dbo].[CSR_Menus] SET [Icon] = N'🕒' WHERE [MenuKey] = 'system-config.audit-logs';
UPDATE [dbo].[CSR_Menus] SET [Icon] = N'🔐' WHERE [MenuKey] = 'system-config.menu-permissions';

-- Kiểm tra lại nhanh sau khi update
SELECT [MenuKey], [MenuName], [Icon], DATALENGTH([Icon]) AS IconByteLen
FROM [dbo].[CSR_Menus]
ORDER BY [SortOrder];

PRINT 'Migration 72: Đã sửa lại toàn bộ Icon (emoji) trong CSR_Menus.';
GO