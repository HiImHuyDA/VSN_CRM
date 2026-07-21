-- Fix usp_GetTaskConfig: đọc từ CSR_TaskConfig mới (cột mới)
USE CSR_DB;
GO

IF OBJECT_ID('dbo.usp_GetTaskConfig', 'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_GetTaskConfig;
GO

CREATE PROCEDURE dbo.usp_GetTaskConfig
    @Destinations NVARCHAR(MAX)  -- Comma-separated: 'VSN OFFICE,VAC'
AS
BEGIN
    SET NOCOUNT ON;

    -- Tách danh sách destinations
    CREATE TABLE #Dests (Dest NVARCHAR(100));
    INSERT INTO #Dests (Dest)
    SELECT LTRIM(RTRIM(value))
    FROM STRING_SPLIT(@Destinations, ',');

    SELECT
        d.Dest AS RequestedDestination,
        tc.Id,
        tc.Destination,
        tc.TaskName,
        tc.Description,
        tc.AssigneeName,
        tc.AssigneeEmail,
        tc.SupervisorName,
        tc.SupervisorEmail,
        tc.IsCompulsory,
        tc.LeadtimeDays,
        tc.IsActive
    FROM #Dests d
    JOIN dbo.CSR_TaskConfig tc ON tc.Destination = d.Dest
    WHERE tc.IsActive = 1
    ORDER BY d.Dest, tc.Id;

    DROP TABLE #Dests;
END;
GO

PRINT 'usp_GetTaskConfig updated successfully';
GO
