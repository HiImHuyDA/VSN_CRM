USE CSR_DB;
GO

-- Cập nhật stored procedure usp_GetProjectStatus để đọc tên trạng thái từ bảng CSR_Statuses thay vì cột Status đã bị xóa
CREATE OR ALTER PROCEDURE [dbo].[usp_GetProjectStatus]
    @ProjectId NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT s.TenTrangThai AS [Status]
    FROM [dbo].[CSR_Projects] p
    INNER JOIN [dbo].[CSR_Statuses] s ON p.StatusId = s.Id
    WHERE p.[Project_id] = @ProjectId;
END
GO
