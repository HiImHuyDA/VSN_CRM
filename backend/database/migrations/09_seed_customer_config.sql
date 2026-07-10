-- ============================================================
-- 09_seed_customer_config.sql
-- Seed dữ liệu mẫu cho Danh mục Khách hàng (Brand, Supplier, Partner)
-- ============================================================
USE CSR_DB;
GO

-- Xóa dữ liệu cũ nếu muốn làm sạch (tùy chọn)
-- DELETE FROM [dbo].[CSR_ConfigLists] WHERE Category IN ('Brand', 'Supplier', 'Partner');

-- 1. Thêm mẫu Brand
IF NOT EXISTS (SELECT 1 FROM [dbo].[CSR_ConfigLists] WHERE Name = N'Công ty CP Bán Lẻ ABC' AND Category = 'Brand')
BEGIN
    INSERT INTO [dbo].[CSR_ConfigLists] ([Category], [Name], [JsonData], [IsActive])
    VALUES (
        'Brand',
        N'Công ty CP Bán Lẻ ABC',
        N'[{"salutation":"Mr","name":"Nguyễn Văn A","title":"Giám đốc Mua hàng","mealNote":"Không ăn hành","extraNote":"Thích cafe đen"},{"salutation":"Ms","name":"Trần Thị B","title":"Trợ lý","mealNote":"Ăn chay","extraNote":""}]',
        1
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM [dbo].[CSR_ConfigLists] WHERE Name = N'Tập đoàn XYZ' AND Category = 'Brand')
BEGIN
    INSERT INTO [dbo].[CSR_ConfigLists] ([Category], [Name], [JsonData], [IsActive])
    VALUES (
        'Brand',
        N'Tập đoàn XYZ',
        N'[{"salutation":"Mr","name":"Lê Minh C","title":"Tổng Giám đốc","mealNote":"","extraNote":"Thích ngồi gần cửa sổ"}]',
        1
    );
END
GO

-- 2. Thêm mẫu Supplier
IF NOT EXISTS (SELECT 1 FROM [dbo].[CSR_ConfigLists] WHERE Name = N'Nhà cung cấp Bao bì 123' AND Category = 'Supplier')
BEGIN
    INSERT INTO [dbo].[CSR_ConfigLists] ([Category], [Name], [JsonData], [IsActive])
    VALUES (
        'Supplier',
        N'Nhà cung cấp Bao bì 123',
        N'[{"salutation":"Mr","name":"Phạm Q","title":"Trưởng phòng Sales","mealNote":"","extraNote":""}]',
        1
    );
END
GO

PRINT 'Seeded customer configurations successfully!';
GO
