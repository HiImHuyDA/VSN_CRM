USE CSR_DB;
GO

-- 1. usp_GetAllUsers
CREATE OR ALTER PROCEDURE [dbo].[usp_GetAllUsers]
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 
        u.[UserId], 
        u.[MNV], 
        u.[FullName], 
        u.[Email], 
        u.[Role], 
        u.[StatusId],
        CAST(CASE WHEN u.[StatusId] = 1 THEN 1 ELSE 0 END AS BIT) AS [IsActive],
        u.[RequiresPasswordChange], 
        u.[CreatedAt], 
        u.[UpdatedAt],
        e.[Department]
    FROM [dbo].[CSR_Users] u
    LEFT JOIN [dbo].[CSR_Employees] e ON u.[MNV] = e.[MNV]
    ORDER BY u.[Role], u.[FullName];
END;
GO

PRINT 'Fix for GetAllUsers stored procedure (joined with CSR_Employees to get Department) applied successfully!';
GO
