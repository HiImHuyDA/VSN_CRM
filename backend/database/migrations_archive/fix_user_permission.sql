USE CSR_DB;
GO

CREATE OR ALTER VIEW [dbo].[vw_SubmissionSummary]
AS
SELECT
    p.[Project_id],
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
    COUNT(DISTINCT t.[OnboardDate])         AS [TotalDays],
    STUFF((
        SELECT DISTINCT ', ' + CONVERT(NVARCHAR(10), t2.[OnboardDate], 103)
        FROM [dbo].[CSR_Tasks] t2
        WHERE t2.[Project_id] = p.[Project_id]
        ORDER BY ', ' + CONVERT(NVARCHAR(10), t2.[OnboardDate], 103)
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'), 1, 2, '')
                                            AS [OnboardDates],
    STUFF((
        SELECT DISTINCT ', ' + t3.[Destination]
        FROM [dbo].[CSR_Tasks] t3
        WHERE t3.[Project_id] = p.[Project_id]
        ORDER BY ', ' + t3.[Destination]
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'), 1, 2, '')
                                            AS [Destinations],
    COUNT(t.[Task_id])                      AS [TotalTasks],
    SUM(CASE WHEN t.[DeadlineDate] <= CAST(GETDATE() AS DATE)
             AND t.[IsActive] = 1 THEN 1 ELSE 0 END)
                                            AS [UrgentTasks]
FROM [dbo].[CSR_Projects] p
LEFT JOIN [dbo].[CSR_Tasks] t ON p.[Project_id] = t.[Project_id]
GROUP BY
    p.[Project_id], p.[SubmitDate], p.[CustomerType], p.[CustomerName],
    p.[SubmitterName], p.[SubmitterEmail], p.[SubmitterMNV], p.[MeetingTopic], p.[Status], p.[CreatedAt], p.[UpdatedAt];
GO

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

    SELECT
        [Project_id], [SubmitDate], [CustomerType], [CustomerName],
        [SubmitterName], [SubmitterMNV], [MeetingTopic], [Status],
        [TotalDays], [OnboardDates], [Destinations], [TotalTasks], [UrgentTasks]
    FROM [dbo].[vw_SubmissionSummary]
    WHERE
        (@SearchText = '' OR [CustomerName] LIKE '%' + @SearchText + '%'
                         OR [SubmitterName] LIKE '%' + @SearchText + '%'
                         OR [Project_id]   LIKE '%' + @SearchText + '%')
        AND
        (@Status = '' OR [Status] = @Status)
        AND
        (@ActorRole <> N'BOD' OR [Status] IN (N'PRD đã duyệt', N'BOD đã duyệt', N'BOD từ chối'))
        AND
        (@ActorRole <> N'User' OR [SubmitterMNV] = @ActorMNV)
    ORDER BY [CreatedAt] DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;

    SELECT COUNT(*) AS [TotalCount]
    FROM [dbo].[vw_SubmissionSummary]
    WHERE
        (@SearchText = '' OR [CustomerName] LIKE '%' + @SearchText + '%'
                         OR [SubmitterName] LIKE '%' + @SearchText + '%'
                         OR [Project_id]   LIKE '%' + @SearchText + '%')
        AND
        (@Status = '' OR [Status] = @Status)
        AND
        (@ActorRole <> N'BOD' OR [Status] IN (N'PRD đã duyệt', N'BOD đã duyệt', N'BOD từ chối'))
        AND
        (@ActorRole <> N'User' OR [SubmitterMNV] = @ActorMNV);
END
GO

