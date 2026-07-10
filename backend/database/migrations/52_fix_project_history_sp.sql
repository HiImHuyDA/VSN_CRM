USE CSR_DB;
GO

-- 1b. GET /submissions/:projectId/history — lấy toàn bộ lịch sử theo ParentId
CREATE OR ALTER PROCEDURE [dbo].[usp_GetProjectHistory]
    @ParentId NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        p.[Project_id],
        p.[RecordType],
        p.[Version],
        s.TenTrangThai AS [Status],
        p.[CreatedAt],
        p.[UpdatedAt],
        p.[MeetingTopic],
        p.[SubmitterName],
        p.[CustomerName]
    FROM [dbo].[CSR_Projects] p
    INNER JOIN [dbo].[CSR_Statuses] s ON p.[StatusId] = s.[Id]
    WHERE p.[ParentId] = @ParentId
    ORDER BY p.[Version] DESC;
END
GO

PRINT 'Fix for usp_GetProjectHistory migration applied successfully!';
GO
