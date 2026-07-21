USE CSR_DB;
GO

-- ============================================================
-- 1. Bổ sung cột cho bảng CSR_Projects
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.CSR_Projects') AND name = 'ParentId')
BEGIN
    ALTER TABLE [dbo].[CSR_Projects] ADD [ParentId] NVARCHAR(50);
END
GO
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.CSR_Projects') AND name = 'RecordType')
BEGIN
    ALTER TABLE [dbo].[CSR_Projects] ADD [RecordType] INT DEFAULT 1;
END
GO
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.CSR_Projects') AND name = 'Version')
BEGIN
    ALTER TABLE [dbo].[CSR_Projects] ADD [Version] INT DEFAULT 1;
END
GO

-- Cập nhật dữ liệu cũ
UPDATE [dbo].[CSR_Projects]
SET [ParentId] = [Project_id], [RecordType] = 1, [Version] = 1
WHERE [ParentId] IS NULL;
GO

-- ============================================================
-- 2. Cập nhật view vw_SubmissionSummary
-- ============================================================
CREATE OR ALTER VIEW [dbo].[vw_SubmissionSummary]
AS
SELECT
    p.[Project_id],
    p.[ParentId],
    p.[RecordType],
    p.[Version],
    p.[SubmitDate],
    p.[CustomerType],
    p.[CustomerName],
    p.[SubmitterName],
    p.[SubmitterEmail],
    p.[SubmitterMNV],
    p.[MeetingTopic],
    p.[Status],
    p.[CreatedAt],
    p.[UpdatedAt],
    COUNT(DISTINCT t.[OnboardDate]) AS [TotalDays],
    STUFF((
        SELECT DISTINCT ', ' + CONVERT(NVARCHAR(10), t2.[OnboardDate], 103)
        FROM [dbo].[CSR_Tasks] t2
        WHERE t2.[Project_id] = p.[Project_id]
        ORDER BY ', ' + CONVERT(NVARCHAR(10), t2.[OnboardDate], 103)
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS [OnboardDates],
    STUFF((
        SELECT DISTINCT ', ' + t3.[Destination]
        FROM [dbo].[CSR_Tasks] t3
        WHERE t3.[Project_id] = p.[Project_id]
        ORDER BY ', ' + t3.[Destination]
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS [Destinations],
    COUNT(t.[Task_id]) AS [TotalTasks],
    SUM(CASE WHEN t.[DeadlineDate] <= CAST(GETDATE() AS DATE) AND t.[IsActive] = 1 THEN 1 ELSE 0 END) AS [UrgentTasks]
FROM
    [dbo].[CSR_Projects] p
    LEFT JOIN [dbo].[CSR_Tasks] t ON p.[Project_id] = t.[Project_id]
GROUP BY
    p.[Project_id], p.[ParentId], p.[RecordType], p.[Version],
    p.[SubmitDate], p.[CustomerType], p.[CustomerName],
    p.[SubmitterName], p.[SubmitterEmail], p.[SubmitterMNV], p.[MeetingTopic],
    p.[Status], p.[CreatedAt], p.[UpdatedAt];
GO

-- ============================================================
-- 3. Cập nhật usp_GetSubmissions
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_GetSubmissions]
    @SearchText     NVARCHAR(200)   = '',
    @Status         NVARCHAR(50)    = '',
    @ActorRole      NVARCHAR(50)    = '',
    @ActorMNV       NVARCHAR(50)    = '',
    @PageNumber     INT             = 1,
    @PageSize       INT             = 20
AS
BEGIN
    SET NOCOUNT ON;

    WITH LatestVersions AS (
        SELECT [Project_id], ROW_NUMBER() OVER (PARTITION BY [ParentId] ORDER BY [Version] DESC) as rn
        FROM [dbo].[vw_SubmissionSummary]
    )
    SELECT
        [Project_id], [ParentId], [RecordType], [Version], [SubmitDate], [CustomerType], [CustomerName],
        [SubmitterName], [MeetingTopic], [Status],
        [CreatedAt], [UpdatedAt],
        [TotalDays], [OnboardDates], [Destinations], [TotalTasks], [UrgentTasks]
    FROM [dbo].[vw_SubmissionSummary] v
    WHERE
        EXISTS (SELECT 1 FROM LatestVersions lv WHERE lv.[Project_id] = v.[Project_id] AND lv.rn = 1)
        AND (
            (@ActorRole = 'User' AND v.[SubmitterMNV] = @ActorMNV)
            OR (@ActorRole != 'User')
        )
        AND (@SearchText = '' OR [CustomerName] LIKE '%' + @SearchText + '%'
                         OR [SubmitterName] LIKE '%' + @SearchText + '%'
                         OR [Project_id]   LIKE '%' + @SearchText + '%')
        AND (@Status = '' OR [Status] = @Status)
        AND (
            @ActorRole != 'BOD'
            OR (@ActorRole = 'BOD' AND [Status] IN (N'PRD đã duyệt', N'BOD đã duyệt', N'BOD từ chối'))
        )
    ORDER BY [CreatedAt] DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END
GO
