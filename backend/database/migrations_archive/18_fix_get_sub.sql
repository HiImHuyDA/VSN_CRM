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

    -- Tổng số bản ghi
    WITH LatestVersions AS (
        SELECT [Project_id], ROW_NUMBER() OVER (PARTITION BY [ParentId] ORDER BY [Version] DESC) as rn
        FROM [dbo].[vw_SubmissionSummary]
    )
    SELECT COUNT(*) AS [TotalCount]
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
        );
END
GO
