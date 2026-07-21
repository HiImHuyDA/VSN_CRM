USE CSR_DB;
GO

-- ============================================================
-- 28_fix_onboarddates_format.sql
-- Đổi format OnboardDates trong view từ dd/MM/yyyy (103)
-- sang yyyy-MM-dd (23) để JavaScript parse đúng ngày
-- (dd/MM/yyyy bị JS hiểu nhầm là MM/dd/yyyy → sai tháng/ngày)
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
    p.[SubmitterMNV],
    p.[SubmitterEmail],
    p.[MeetingTopic],
    p.[Status],
    p.[CreatedAt],
    p.[UpdatedAt],
    -- Tổng số ngày tiếp đón (distinct)
    COUNT(DISTINCT t.[OnboardDate])         AS [TotalDays],
    -- Danh sách ngày tiếp đón unique - dùng ISO yyyy-MM-dd (format 23) để JS parse đúng
    STUFF((
        SELECT DISTINCT ', ' + CONVERT(NVARCHAR(10), t2.[OnboardDate], 23)
        FROM [dbo].[CSR_Tasks] t2
        WHERE t2.[Project_id] = p.[Project_id]
        ORDER BY ', ' + CONVERT(NVARCHAR(10), t2.[OnboardDate], 23)
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'), 1, 2, '')
                                            AS [OnboardDates],
    -- Danh sách địa điểm unique
    STUFF((
        SELECT DISTINCT ', ' + t3.[Destination]
        FROM [dbo].[CSR_Tasks] t3
        WHERE t3.[Project_id] = p.[Project_id]
        ORDER BY ', ' + t3.[Destination]
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'), 1, 2, '')
                                            AS [Destinations],
    -- Tổng số task
    COUNT(t.[Task_id])                      AS [TotalTasks],
    -- Số task đã quá hạn hoặc đến hạn hôm nay
    SUM(CASE WHEN t.[DeadlineDate] <= CAST(GETDATE() AS DATE)
             AND t.[IsActive] = 1 THEN 1 ELSE 0 END)
                                            AS [UrgentTasks]
FROM
    [dbo].[CSR_Projects] p
    LEFT JOIN [dbo].[CSR_Tasks] t ON p.[Project_id] = t.[Project_id]
GROUP BY
    p.[Project_id], p.[ParentId], p.[RecordType], p.[Version],
    p.[SubmitDate], p.[CustomerType], p.[CustomerName],
    p.[SubmitterName], p.[SubmitterMNV], p.[SubmitterEmail], p.[MeetingTopic],
    p.[Status], p.[CreatedAt], p.[UpdatedAt];
GO

PRINT '=== vw_SubmissionSummary updated: OnboardDates now uses yyyy-MM-dd format ===';
GO
