-- Migration 74: Cập nhật stored procedure usp_GetMyMenu để mặc định phân quyền tất cả cho Admin
-- Không cần thiết lập phân quyền Admin trên từng menu riêng lẻ.
USE CSR_DB;
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_GetMyMenu]
    @Role NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Nếu là Admin, trả về toàn bộ menu đang hoạt động mà không cần check bảng phân quyền
    IF @Role = 'Admin'
    BEGIN
        SELECT [Id], [ParentId], [MenuKey], [MenuName], [Icon], [Path], [SortOrder]
        FROM [dbo].[CSR_Menus]
        WHERE [IsActive] = 1
        ORDER BY [SortOrder];
    END
    ELSE
    BEGIN
        SELECT DISTINCT m.[Id], m.[ParentId], m.[MenuKey], m.[MenuName], m.[Icon], m.[Path], m.[SortOrder]
        FROM [dbo].[CSR_Menus] m
            INNER JOIN [dbo].[CSR_RolePermissions] rp ON rp.[MenuId] = m.[Id]
        WHERE rp.[Role] = @Role AND m.[IsActive] = 1
        ORDER BY m.[SortOrder];
    END
END
GO

PRINT 'Migration 74: Updated stored procedure usp_GetMyMenu to bypass permissions check for Admin.';
GO
