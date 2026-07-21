-- ============================================================
-- 10_seed_restaurant_meetingroom.sql
-- Seed dữ liệu Nhà hàng ăn tối, Menu trưa, Phòng họp
-- Chỉ insert nếu Category chưa có dữ liệu
-- ============================================================
USE CSR_DB;
GO

-- 1. Seed Nhà hàng ăn tối (DinnerRestaurant)
IF NOT EXISTS (SELECT 1 FROM [dbo].[CSR_ConfigLists] WHERE Category = 'DinnerRestaurant')
BEGIN
    INSERT INTO [dbo].[CSR_ConfigLists] ([Category], [Name], [IsActive]) VALUES
    ('DinnerRestaurant', N'Âu-Shri-72-74 Nguyễn Thị Minh Khai, Q1', 1),
    ('DinnerRestaurant', N'Âu-Sol-115 Lý Tự Trọng, Bến Thành Q1', 1),
    ('DinnerRestaurant', N'Âu-Elgaucho-66 Lê Lợi, Bến Nghé Quận 1', 1),
    ('DinnerRestaurant', N'Âu-Elgaucho-77 Xuân Thuỷ, Thảo Điền, Q2', 1),
    ('DinnerRestaurant', N'Âu-D1 Concepts-Tầng 52, Bitexco Financial Tower, 36 Hồ Tùng Mậu, Q1', 1),
    ('DinnerRestaurant', N'Âu-OPERA HYATT-Số 2 Công Trường Lam Sơn', 1),
    ('DinnerRestaurant', N'Âu-La Haye Kitchen & Bar-Đường số 5, KĐT Sala, Thủ Đức', 1),
    ('DinnerRestaurant', N'Chay-Hum-34 Võ Văn Tần, Quận 3', 1),
    ('DinnerRestaurant', N'Chay-Chay Garden-52 Võ Văn Tần, F6, Quận 3', 1),
    ('DinnerRestaurant', N'Chay-Tâm Vị-25 Tú Xương', 1),
    ('DinnerRestaurant', N'Chay-Be An-99 Nguyễn Huệ, P. Bến Nghé, Q1', 1),
    ('DinnerRestaurant', N'Nhật-Sushi Hokkaido-40-42 Đông Du, Bến Nghé, Q1', 1),
    ('DinnerRestaurant', N'Nhật-Yen Sushi-30 Trường Sơn, Tân Bình', 1),
    ('DinnerRestaurant', N'Việt-Nhà hàng Ngon-160 Pasteur, Bến Nghé, Q1', 1),
    ('DinnerRestaurant', N'Việt-Cục Gạch-9-10 Đặng Tất, Tân Định, Q1', 1),
    ('DinnerRestaurant', N'Việt-Dimtutac-55 Đông Du, Bến Nghé, Q1', 1),
    ('DinnerRestaurant', N'Việt-Làng nướng Nam Bộ-14A Dương Đức Hiền, Tây Thạnh, Q Tân Phú', 1),
    ('DinnerRestaurant', N'Việt-Cơm Niêu Sài Gòn-27 Tú Xương, Q3', 1),
    ('DinnerRestaurant', N'Việt-Yeebo-76 Nguyễn Văn Trỗi', 1),
    ('DinnerRestaurant', N'Việt-Tib-187 Hai Bà Trưng, P6, Quận 3', 1),
    ('DinnerRestaurant', N'Việt-Nhà hàng Mặn Mòi-34 Võ Văn Tần, P. Võ Thị Sáu, Q3', 1),
    ('DinnerRestaurant', N'Khác', 1);
    PRINT 'Seeded DinnerRestaurant';
END
GO

-- 2. Seed Menu bữa trưa (LunchMenu)
IF NOT EXISTS (SELECT 1 FROM [dbo].[CSR_ConfigLists] WHERE Category = 'LunchMenu')
BEGIN
    INSERT INTO [dbo].[CSR_ConfigLists] ([Category], [Name], [IsActive]) VALUES
    ('LunchMenu', N'Ăn theo phần ăn nhân viên', 1),
    ('LunchMenu', N'Phở Gà + chả giò', 1),
    ('LunchMenu', N'Phở Bò + chả giò', 1),
    ('LunchMenu', N'Bún Bò + chả giò', 1),
    ('LunchMenu', N'Bún Chả + chả giò', 1),
    ('LunchMenu', N'Mì Quảng Gà + chả giò', 1),
    ('LunchMenu', N'Hủ Tiếu Xương + chả giò', 1),
    ('LunchMenu', N'Bánh Canh Cua + chả giò', 1),
    ('LunchMenu', N'Cơm tấm sườn + chả giò', 1),
    ('LunchMenu', N'Cơm Việt: Chả giò, cá kho, rau xào/luộc, canh', 1),
    ('LunchMenu', N'Cơm Việt: Chả giò, sườn kho, rau xào/luộc, canh', 1),
    ('LunchMenu', N'Cơm gà + gỏi gà', 1),
    ('LunchMenu', N'Chay: Bún Thái, chả giò', 1),
    ('LunchMenu', N'Chay: Cơm nấm kho, chả giò, rau xào/luộc, canh', 1),
    ('LunchMenu', N'Ăn ngoài với khách', 1);
    PRINT 'Seeded LunchMenu';
END
GO

-- 3. Seed Phòng họp (MeetingRoom)
IF NOT EXISTS (SELECT 1 FROM [dbo].[CSR_ConfigLists] WHERE Category = 'MeetingRoom')
BEGIN
    INSERT INTO [dbo].[CSR_ConfigLists] ([Category], [Name], [Email], [IsActive]) VALUES
    ('MeetingRoom', N'Activity Room', N'activity@vietsuncorp.com.vn', 1),
    ('MeetingRoom', N'Nha Trang Meeting Room', N'NhaTrang@vietsuncorp.com.vn', 1),
    ('MeetingRoom', N'Phu Quoc Meeting Room', N'phuquoc@vietsuncorp.com.vn', 1),
    ('MeetingRoom', N'Sai Gon Meeting Room', N'saigon@vietsuncorp.com.vn', 1),
    ('MeetingRoom', N'Showroom Meeting Room', N'showroom@vietsuncorp.com.vn', 1);
    PRINT 'Seeded MeetingRoom';
END
GO

PRINT '=== Restaurant & Meeting Room seed done ===';
GO
