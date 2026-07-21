USE CSR_DB;
GO

-- 1. usp_SearchEmployees
CREATE OR ALTER PROCEDURE [dbo].[usp_SearchEmployees]
    @Query      NVARCHAR(200) = '',
    @TopN       INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP (@TopN)
        [FullName], [Email], [MNV]
    FROM [dbo].[CSR_Employees]
    WHERE [StatusId] = 1 -- 1 = Hoạt động (thay thế IsActive = 1)
        AND (
            @Query = ''
            OR [FullName] LIKE '%' + @Query + '%'
            OR [Email]    LIKE '%' + @Query + '%'
        )
    ORDER BY
        CASE WHEN [FullName] LIKE @Query + '%' THEN 0 ELSE 1 END,
        [FullName];
END;
GO

PRINT 'Fix for search employees stored procedure applied successfully!';
GO
