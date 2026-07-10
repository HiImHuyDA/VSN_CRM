-- ============================================================
-- 05_seed_task_config.sql
-- Import dữ liệu cấu hình task từ datalist.py vào DB
-- ============================================================
USE CSR_DB;
GO

-- Xóa data cũ trước khi seed
DELETE FROM [dbo].[CSR_TaskConfig];
GO

-- ============================================================
-- VDC
-- ============================================================
INSERT INTO [dbo].[CSR_TaskConfig] ([Destination],[TaskName],[DefaultAssignee],[DefaultAssigneeEmail],[DefaultSupervisor],[DefaultSupervisorEmail],[TaskDetail],[Compulsory],[LeadTime]) VALUES
(N'VDC',N'Bảng chào',N'VDC - Team hành chính Chị Hoa',N'nhansuvietduc@vietsuntx.com;tam.vo@vietsuntx.com;kieu.le@vietsuntx.com;tien.nguyen@vietsuntx.com',N'Ms.Hoa',N'hoa.le@vietsuncorp.com.vn;vsn.dn.qms@vietsuntx.com;quan.le@vietsuntx.com;thuyvan.mai@vietsuntx.com',N'Chuẩn bị bảng chào mở sẵn phòng họp khi khách đến',N'',1),
(N'VDC',N'Chuẩn bị cơm trưa',N'VDC - Team hành chính Chị Hoa',N'nhansuvietduc@vietsuntx.com;tam.vo@vietsuntx.com;kieu.le@vietsuntx.com;tien.nguyen@vietsuntx.com',N'Ms.Hoa',N'hoa.le@vietsuncorp.com.vn;',N'',N'',1),
(N'VDC',N'Chuẩn bị Mẫu theo nội dung họp',N'VDC - Anh Huy giám đốc nhà máy',N'huy.do@vietsuncorp.com.vn',N'',N'',N'Tổ chức chuẩn bị hàng hoá sẵn sàng cho khách kiểm',N'',1),
(N'VDC',N'Chuẩn bị hiện trường',N'VDC - Team Hành chính Chị Hoa',N'nhansuvietduc@vietsuntx.com;tam.vo@vietsuntx.com;kieu.le@vietsuntx.com;tien.nguyen@vietsuntx.com',N'Ms.Hoa',N'hoa.le@vietsuncorp.com.vn;vsn.dn.qms@vietsuntx.com;quan.le@vietsuntx.com;thuyvan.mai@vietsuntx.com',N'Chuẩn bị hiện trường nhà máy đảm bảo khách viếng thăm',N'',1),
(N'VDC',N'Trình bày profile VDC',N'',N'',N'',N'',N'Chuẩn bị file VDC profile',N'',2),
(N'VDC',N'Book nhà hàng ăn tối',N'VSN - Team hành chính Chị Mai',N'hanhchinh@vietsuntx.com',N'',N';',N'',N'',1),
(N'VDC',N'Phòng họp',N'VDC - Team hành chính Chị Hoa',N'nhansuvietduc@vietsuntx.com;tam.vo@vietsuntx.com;kieu.le@vietsuntx.com;tien.nguyen@vietsuntx.com',N'Ms.Hoa',N'hoa.le@vietsuncorp.com.vn;',N'',N'',1),
(N'VDC',N'Chuẩn bị xe',N'VSN - Team hành chính Chị Mai',N'hanhchinh@vietsuntx.com',N'',N';',N'',N'',2),
(N'VDC',N'Chuẩn bị nội dung họp/Sample',N'',N'',N'',N'',N'',N'',5),
(N'VDC',N'Chuẩn bị khác',N'Ms.Hoa',N'hoa.le@vietsuncorp.com.vn',N'',N'',N'',N'',2);
GO

-- ============================================================
-- VSDN
-- ============================================================
INSERT INTO [dbo].[CSR_TaskConfig] ([Destination],[TaskName],[DefaultAssignee],[DefaultAssigneeEmail],[DefaultSupervisor],[DefaultSupervisorEmail],[TaskDetail],[Compulsory],[LeadTime]) VALUES
(N'VSDN',N'Bảng chào',N'VDC - Team hành chính Chị Hoa',N'nhansuvietduc@vietsuntx.com;tam.vo@vietsuntx.com;kieu.le@vietsuntx.com',N'Ms.Hoa',N'hoa.le@vietsuncorp.com.vn;vsn.dn.qms@vietsuntx.com;quan.le@vietsuntx.com;thuyvan.mai@vietsuntx.com',N'Chuẩn bị bảng chào mở sẵn phòng họp khi khách đến',N'Y',1),
(N'VSDN',N'Chuẩn bị cơm trưa',N'VDC - Team hành chính Chị Hoa',N'nhansuvietduc@vietsuntx.com;tam.vo@vietsuntx.com;kieu.le@vietsuntx.com',N'Ms.Hoa',N'hoa.le@vietsuncorp.com.vn',N'',N'',1),
(N'VSDN',N'Chuẩn bị Mẫu theo nội dung họp',N'VDC - Anh Huy giám đốc nhà máy',N'huy.do@vietsuncorp.com.vn',N'',N'vsn.dn.qms@vietsuntx.com;quan.le@vietsuntx.com;thuyvan.mai@vietsuntx.com',N'Tổ chức chuẩn bị hàng hoá sẵn sàng cho khách kiểm',N'',1),
(N'VSDN',N'Chuẩn bị hiện trường',N'VDC - Team Hành chính Chị Hoa',N'nhansuvietduc@vietsuntx.com;tam.vo@vietsuntx.com;kieu.le@vietsuntx.com',N'Ms.Hoa',N'hoa.le@vietsuncorp.com.vn;vsn.dn.qms@vietsuntx.com;quan.le@vietsuntx.com;thuyvan.mai@vietsuntx.com',N'Chuẩn bị hiện trường nhà máy đảm bảo khách viếng thăm',N'Y',1),
(N'VSDN',N'Trình bày profile VSDN',N'',N'',N'',N'',N'Chuẩn bị file VSDN profile',N'',2),
(N'VSDN',N'Book nhà hàng ăn tối',N'VSN - Team hành chính Chị Mai',N'hanhchinh@vietsuntx.com',N'',N'',N'',N'',1),
(N'VSDN',N'Phòng họp',N'VDC - Team hành chính Chị Hoa',N'nhansuvietduc@vietsuntx.com;tam.vo@vietsuntx.com;kieu.le@vietsuntx.com',N'Ms.Hoa',N'hoa.le@vietsuncorp.com.vn',N'',N'Y',1),
(N'VSDN',N'Chuẩn bị xe',N'VSN - Team hành chính Chị Mai',N'hanhchinh@vietsuntx.com',N'',N'',N'',N'',2),
(N'VSDN',N'Chuẩn bị nội dung họp/Sample',N'',N'',N'',N'vsn.dn.qms@vietsuntx.com;quan.le@vietsuntx.com;thuyvan.mai@vietsuntx.com',N'',N'Y',5);
GO

-- ============================================================
-- VAC
-- ============================================================
INSERT INTO [dbo].[CSR_TaskConfig] ([Destination],[TaskName],[DefaultAssignee],[DefaultAssigneeEmail],[DefaultSupervisor],[DefaultSupervisorEmail],[TaskDetail],[Compulsory],[LeadTime]) VALUES
(N'VAC',N'Bảng chào',N'VDC - Team hành chính',N'duyen.nhu@vietsuntx.com;trinh.bui@vietsuntx.com',N'Ms.Hoa',N'hoa.le@vietsuncorp.com.vn;',N'Chuẩn bị bảng chào mở sẵn phòng họp khi khách đến',N'',1),
(N'VAC',N'Chuẩn bị cơm trưa',N'Ms. Duệ',N'due.tran@vietsuntx.com',N'Ms.Hoa',N'hoa.le@vietsuncorp.com.vn;',N'',N'',1),
(N'VAC',N'Chuẩn bị Mẫu theo nội dung họp',N'VDC - Anh Huy giám đốc nhà máy',N'huy.do@vietsuncorp.com.vn',N'',N'',N'Tổ chức chuẩn bị hàng hoá sẵn sàng cho khách kiểm',N'',1),
(N'VAC',N'Chuẩn bị hiện trường',N'Ms.Trinh',N'trinh.bui@vietsuntx.com',N'Ms.Hoa',N'hoa.le@vietsuncorp.com.vn;',N'Chuẩn bị hiện trường nhà máy đảm bảo khách viếng thăm',N'',1),
(N'VAC',N'Trình bày profile VAC',N'',N'',N'',N'',N'Chuẩn bị file VAC profile',N'',2),
(N'VAC',N'Book nhà hàng ăn tối',N'VSN - Team hành chính Chị Mai',N'hanhchinh@vietsuntx.com',N'',N';',N'',N'',1),
(N'VAC',N'Phòng họp',N'Ms. Duệ',N'due.tran@vietsuntx.com',N'Ms.Hoa',N'hoa.le@vietsuncorp.com.vn;',N'',N'',1),
(N'VAC',N'Chuẩn bị xe',N'VSN - Team hành chính Chị Mai',N'hanhchinh@vietsuntx.com',N'',N';',N'',N'',2),
(N'VAC',N'Chuẩn bị nội dung họp/Sample',N'',N'',N'',N'',N'',N'',5),
(N'VAC',N'Chuẩn bị khác',N'Ms.Hoa',N'hoa.le@vietsuncorp.com.vn',N'',N'',N'',N'',2);
GO

-- ============================================================
-- VSN-NT
-- ============================================================
INSERT INTO [dbo].[CSR_TaskConfig] ([Destination],[TaskName],[DefaultAssignee],[DefaultAssigneeEmail],[DefaultSupervisor],[DefaultSupervisorEmail],[TaskDetail],[Compulsory],[LeadTime]) VALUES
(N'VSN-NT',N'Chuẩn bị hiện trường',N'Anh Thảo - Hành Chính VSNT',N'thao.nguyen@vietsuntx.com',N'Ms.Phương',N'phuong.tran@vietsuntx.com;',N'Chuẩn bị hiện trường nhà máy đảm bảo khách viếng thăm',N'',1),
(N'VSN-NT',N'Chuẩn bị xe (từ sân bay)',N'Anh Thảo - Hành Chính VSNT',N'thao.nguyen@vietsuntx.com',N'Ms.Phương',N'phuong.tran@vietsuntx.com;',N'',N'',1),
(N'VSN-NT',N'Book vé máy bay',N'Chị Mai - Hành chính Vietsun',N'hanhchinh@vietsuntx.com',N'',N';',N'',N'',14),
(N'VSN-NT',N'Chuẩn bị xe (Từ VSN đi VSN-NT)',N'Chị Mai - Hành chính Vietsun',N'hanhchinh@vietsuntx.com',N'',N';',N'',N'',2),
(N'VSN-NT',N'Chuẩn bị cơm trưa',N'Anh Thảo - Hành Chính VSNT',N'thao.nguyen@vietsuntx.com',N'Ms.Phương',N'phuong.tran@vietsuntx.com;',N'',N'',1),
(N'VSN-NT',N'Phòng họp',N'Anh Thảo - Hành Chính VSNT',N'thao.nguyen@vietsuntx.com',N'Ms.Phương',N'phuong.tran@vietsuntx.com;',N'',N'',1),
(N'VSN-NT',N'Chuẩn bị Mẫu theo nội dung họp',N'Giám đốc VSNT',N'long.tu@vietsuncorp.com.vn',N'Mr. Quang',N'quang.le@vietsuncorp.com.vn',N'Tổ chức chuẩn bị hàng hoá sẵn sàng cho khách kiểm',N'',1),
(N'VSN-NT',N'Bảng chào',N'Anh Thảo - Hành Chính VSNT',N'thao.nguyen@vietsuntx.com',N'Ms.Phương',N'phuong.tran@vietsuntx.com;',N'Chuẩn bị bảng chào mở sẵn phòng họp khi khách đến',N'',2),
(N'VSN-NT',N'Trình bày profile VSN-NT',N'',N'',N'',N'',N'Chuẩn bị file VSN-NT profile',N'',2),
(N'VSN-NT',N'Chuẩn bị nội dung họp/Sample',N'Giám đốc VSNT',N'long.tu@vietsuncorp.com.vn',N'',N'',N'',N'',5),
(N'VSN-NT',N'Book nhà hàng ăn tối',N'Anh Thảo - Hành Chính VSNT',N'thao.nguyen@vietsuntx.com',N'Ms.Phương',N'phuong.tran@vietsuntx.com;',N'',N'',1),
(N'VSN-NT',N'Chuẩn bị khác',N'Ms.Phương',N'phuong.tran@vietsuntx.com',N'Giám đốc VSNT',N'long.tu@vietsuncorp.com.vn;',N'',N'',2);
GO

-- ============================================================
-- VSN OFFICE
-- ============================================================
INSERT INTO [dbo].[CSR_TaskConfig] ([Destination],[TaskName],[DefaultAssignee],[DefaultAssigneeEmail],[DefaultSupervisor],[DefaultSupervisorEmail],[TaskDetail],[Compulsory],[LeadTime]) VALUES
(N'VSN OFFICE',N'Bảng chào',N'Ms. Thuý Quỳnh',N'thuyquynh.le@vietsuncorp.com.vn',N'',N'',N'Làm bảng chào, chiếu tivi + phòng họp ngày khách đến',N'',2),
(N'VSN OFFICE',N'Chuẩn bị nội dung họp/Sample',N'',N'',N'Ms. Thuý Quỳnh',N'thuyquynh.le@vietsuncorp.com.vn',N'',N'',5),
(N'VSN OFFICE',N'Book Phòng Họp',N'',N'',N'',N'',N'',N'',2),
(N'VSN OFFICE',N'Chuẩn bị phòng họp',N'Chị Mai - Hành chính Vietsun',N'hanhchinh@vietsuntx.com',N'',N'',N'Chuẩn bị nước, trà, và cà phê',N'',2),
(N'VSN OFFICE',N'Chuẩn bị cơm trưa',N'Chị Mai - Hành chính Vietsun',N'hanhchinh@vietsuntx.com',N'',N'',N'',N'',2),
(N'VSN OFFICE',N'Chuẩn bị xe',N'Chị Mai - Hành chính Vietsun',N'hanhchinh@vietsuntx.com',N'',N'',N'',N'',2),
(N'VSN OFFICE',N'Book nhà hàng ăn tối',N'Chị Mai - Hành chính Vietsun',N'hanhchinh@vietsuntx.com',N'',N'',N'',N'',1),
(N'VSN OFFICE',N'Trình bày profile VSN',N'Ms. Thuý Quỳnh',N'thuyquynh.le@vietsuncorp.com.vn',N'Ms. Quỳnh',N'quynh.nguyen@vietsuncorp.com.vn',N'VSN Profile Presentation + Office Tour',N'',2),
(N'VSN OFFICE',N'Chuẩn bị khác',N'Chị Mai - Hành chính Vietsun',N'hanhchinh@vietsuntx.com',N'',N'',N'',N'',2);
GO

PRINT '=== Seed data inserted successfully ===';
DECLARE @RowCount NVARCHAR(10);
SELECT @RowCount = CAST(COUNT(*) AS NVARCHAR(10)) FROM CSR_TaskConfig;
PRINT 'Total TaskConfig rows: ' + @RowCount;
GO
