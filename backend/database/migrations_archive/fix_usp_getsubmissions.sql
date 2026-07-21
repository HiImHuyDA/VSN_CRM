USE CSR_DB;
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
        [TotalDays], [OnboardDates], [Destinations], [TotalTasks], [UrgentTasks],
        [CreatedAt], [UpdatedAt]
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

