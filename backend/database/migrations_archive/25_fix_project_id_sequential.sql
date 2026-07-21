-- Migration 25: Fix fn_GenerateProjectId to use sequential integer IDs
-- Problem: The old function generated IDs like '19700101_141321_ACTIVE' due to broken
-- BigInt modular arithmetic for timestamp conversion. This didn't match the existing
-- sequential integer IDs (1, 2, 3, ..., 21).
-- Fix: Generate the next integer by finding MAX existing integer ID + 1.

ALTER FUNCTION [dbo].[fn_GenerateProjectId]
(
    @SubmitTimestamp    BIGINT,
    @CustomerName       NVARCHAR(200)
)
RETURNS NVARCHAR(100)
AS
BEGIN
    DECLARE @MaxId INT;
    
    -- Lấy giá trị Project_id lớn nhất hiện tại (chỉ lấy các ID là số nguyên)
    SELECT @MaxId = ISNULL(MAX(
        CASE 
            WHEN ISNUMERIC(Project_id) = 1 THEN CAST(Project_id AS INT)
            ELSE 0 
        END
    ), 0)
    FROM [dbo].[CSR_Projects];
    
    RETURN CAST(@MaxId + 1 AS NVARCHAR(100));
END
GO
