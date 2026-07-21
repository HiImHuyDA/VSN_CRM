-- ============================================================
-- 03_create_views.sql
-- Views để FE/BE lấy dữ liệu đã được format sẵn
-- ============================================================
USE CSR_DB;
GO

-- ============================================================
-- vw_SubmissionSummary
-- Danh sách đơn tổng hợp cho màn hình list
-- ============================================================
CREATE OR ALTER VIEW [dbo].[vw_SubmissionSummary]
AS
SELECT
    p.[Project_id],
    p.[SubmitDate],
    p.[CustomerType],
    p.[CustomerName],
    p.[SubmitterName],
    p.[SubmitterEmail],
    p.[MeetingTopic],
    p.[Status],
    p.[CreatedAt],
    p.[UpdatedAt],
    -- Tổng số ngày tiếp đón (distinct)
    COUNT(DISTINCT t.[OnboardDate])         AS [TotalDays],
    -- Danh sách ngày tiếp đón unique - dùng STUFF+FOR XML thay vì STRING_AGG(DISTINCT)
    STUFF((
        SELECT DISTINCT ', ' + CONVERT(NVARCHAR(10), t2.[OnboardDate], 103)
        FROM [dbo].[CSR_Tasks] t2
        WHERE t2.[Project_id] = p.[Project_id]
        ORDER BY ', ' + CONVERT(NVARCHAR(10), t2.[OnboardDate], 103)
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'), 1, 2, '')
                                            AS [OnboardDates],
    -- Danh sách địa điểm unique - dùng STUFF+FOR XML
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
    p.[Project_id], p.[SubmitDate], p.[CustomerType], p.[CustomerName],
    p.[SubmitterName], p.[SubmitterEmail], p.[MeetingTopic],
    p.[Status], p.[CreatedAt], p.[UpdatedAt];
GO

-- ============================================================
-- vw_ActiveTasks
-- Tất cả task còn hiệu lực, kèm thông tin project
-- ============================================================
CREATE OR ALTER VIEW [dbo].[vw_ActiveTasks]
AS
SELECT
    t.[Task_id],
    t.[Project_id],
    p.[CustomerName],
    p.[CustomerType],
    p.[SubmitterName],
    t.[OnboardDate],
    t.[Destination],
    t.[TaskName],
    t.[TaskDetail],
    t.[Assignee],
    t.[AssigneeEmail],
    t.[Supervisor],
    t.[SupervisorEmail],
    t.[DeadlineDate],
    t.[ReminderDate],
    t.[Vehicle],
    t.[PassengerCount],
    t.[FlightRoute],
    t.[ReturnDate],
    t.[MealOption],
    t.[MeetingRoom],
    t.[MeetingRoomEmail],
    t.[MeetingStartTime],
    t.[MeetingEndTime],
    t.[CalendarEventId],
    t.[ContentType],
    -- Trạng thái deadline
    CASE
        WHEN t.[DeadlineDate] < CAST(GETDATE() AS DATE) THEN N'Quá hạn'
        WHEN t.[DeadlineDate] = CAST(GETDATE() AS DATE) THEN N'Hôm nay'
        WHEN t.[DeadlineDate] <= DATEADD(DAY, 3, CAST(GETDATE() AS DATE)) THEN N'Sắp đến hạn'
        ELSE N'Trong hạn'
    END                                     AS [DeadlineStatus],
    -- Số ngày còn lại đến deadline
    DATEDIFF(DAY, CAST(GETDATE() AS DATE), t.[DeadlineDate])
                                            AS [DaysUntilDeadline]
FROM
    [dbo].[CSR_Tasks] t
    INNER JOIN [dbo].[CSR_Projects] p ON t.[Project_id] = p.[Project_id]
WHERE
    t.[IsActive] = 1;
GO

PRINT '=== Views created successfully ===';
GO
