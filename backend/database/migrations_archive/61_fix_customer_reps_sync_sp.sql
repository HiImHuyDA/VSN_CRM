-- Cập nhật stored procedure usp_GetCustomerConfigReps và usp_InsertCustomerConfigReps 
-- để tương thích với cấu trúc bảng CSR_ConfigLists mới nhất (sử dụng StatusId thay thế cho IsActive đã bị xoá).

PRINT 'Updating usp_GetCustomerConfigReps...';
GO
CREATE OR ALTER PROCEDURE [dbo].[usp_GetCustomerConfigReps]
    @Category NVARCHAR(50),
    @Name     NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [Id], [JsonData], [StatusId]
    FROM [dbo].[CSR_ConfigLists]
    WHERE [Category] = @Category AND [Name] = @Name;
END
GO

PRINT 'Updating usp_InsertCustomerConfigReps...';
GO
CREATE OR ALTER PROCEDURE [dbo].[usp_InsertCustomerConfigReps]
    @Category NVARCHAR(50),
    @Name     NVARCHAR(200),
    @JsonData NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO [dbo].[CSR_ConfigLists] ([Category], [Name], [JsonData], [StatusId])
    VALUES (@Category, @Name, @JsonData, 1); -- 1 = Hoạt động (Active)
END
GO

PRINT 'Stored procedures updated successfully!';
GO
