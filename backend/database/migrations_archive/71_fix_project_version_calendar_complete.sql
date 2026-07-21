-- Migration 71: Fix Guest Calendar and Auto-completion logic to support edited projects (RecordType = 2)
-- Bug: Đơn tiếp khách sau khi được chỉnh sửa sẽ có RecordType = 2. 
-- Các stored procedure trước đây lọc p.RecordType = 1 khiến lịch không hiển thị các đơn này, 
-- và bộ lọc tự động hoàn thành cũng bỏ qua các đơn này.
-- Giải pháp: Lấy phiên bản mới nhất của đơn tiếp khách thay vì lọc cứng RecordType = 1, 
-- và cho phép tự động cập nhật Hoàn thành cho cả RecordType 1 và 2.

USE CSR_DB;
GO

-- 1. Định nghĩa lại usp_GetGuestCalendar
CREATE OR ALTER PROCEDURE [dbo].[usp_GetGuestCalendar]
    @StartDate NVARCHAR(10),
    @EndDate   NVARCHAR(10)
AS
BEGIN
    SET NOCOUNT ON;

    -- Tự động cập nhật trạng thái Hoàn thành trước khi truy vấn (áp dụng cho phiên bản mới nhất của đơn có Task)
    ;WITH LatestVersions AS (
        SELECT [Project_id], ROW_NUMBER() OVER (PARTITION BY [ParentId] ORDER BY [Version] DESC) as rn
        FROM [dbo].[CSR_Projects]
    )
    UPDATE p
    SET p.[StatusId] = 7, p.[UpdatedAt] = GETDATE() -- 7 is Hoàn thành
    FROM [dbo].[CSR_Projects] p
    INNER JOIN LatestVersions lv ON p.[Project_id] = lv.[Project_id] AND lv.rn = 1
    WHERE p.[StatusId] = 5 -- 5 is BOD đã duyệt
        AND p.[RecordType] IN (1, 2)
        AND NOT EXISTS (
            SELECT 1
            FROM [dbo].[CSR_Tasks] t
            WHERE t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1
              AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)
        )
        AND EXISTS (
            SELECT 1
            FROM [dbo].[CSR_Tasks] t
            WHERE t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1
        );

    -- Lấy thông tin ngày/địa điểm từ phiên bản mới nhất của đơn
    ;WITH LatestProjects AS (
        SELECT p.*
        FROM [dbo].[CSR_Projects] p
        INNER JOIN (
            SELECT [Project_id], ROW_NUMBER() OVER (PARTITION BY [ParentId] ORDER BY [Version] DESC) as rn
            FROM [dbo].[CSR_Projects]
        ) lv ON p.[Project_id] = lv.[Project_id] AND lv.rn = 1
    ),
    DateDest AS (
        -- Đơn có Task
        SELECT
            p.[Project_id],
            t.[OnboardDate] AS [VisitDate],
            t.[Destination] COLLATE DATABASE_DEFAULT AS [Destination]
        FROM LatestProjects p
            INNER JOIN [dbo].[CSR_Tasks] t ON t.[Project_id] = p.[Project_id] AND t.[StatusId] = 1

        UNION ALL

        -- Đơn KHÔNG có Task (lấy từ AgendaJsonData)
        SELECT
            p.[Project_id],
            TRY_CAST(j.[VisitDateStr] AS DATE) AS [VisitDate],
            d.[key] COLLATE DATABASE_DEFAULT AS [Destination]
        FROM LatestProjects p
            CROSS APPLY OPENJSON(p.[AgendaJsonData])
                WITH ([VisitDateStr] NVARCHAR(20) '$.date', [agenda] NVARCHAR(MAX) '$.agenda' AS JSON) j
            CROSS APPLY OPENJSON(j.[agenda]) d
        WHERE p.[AgendaJsonData] IS NOT NULL
            AND NOT EXISTS (
                SELECT 1
                FROM [dbo].[CSR_Tasks] t2
                WHERE t2.[Project_id] = p.[Project_id]
            )
    )
    SELECT DISTINCT
        p.[Project_id],
        p.[CustomerName],
        p.[CustomerType],
        p.[MeetingTopic],
        p.[SubmitterName],
        s.TenTrangThai AS [Status],
        p.[CreatedAt],
        CONVERT(NVARCHAR(10), dd.[VisitDate], 23) AS OnboardDate,
        dd.[Destination]
    FROM LatestProjects p
        INNER JOIN [dbo].[CSR_Statuses] s ON p.[StatusId] = s.[Id]
        INNER JOIN DateDest dd ON dd.[Project_id] = p.[Project_id]
    WHERE p.[StatusId] IN (8, 4, 5, 7) -- Chờ phản hồi (8), PRD đã duyệt (4), BOD đã duyệt (5), Hoàn thành (7)
        AND dd.[VisitDate] IS NOT NULL
        AND CONVERT(NVARCHAR(10), dd.[VisitDate], 23) >= @StartDate
        AND CONVERT(NVARCHAR(10), dd.[VisitDate], 23) <= @EndDate
    ORDER BY CONVERT(NVARCHAR(10), dd.[VisitDate], 23) ASC, p.[Project_id] ASC;
END
GO

-- 2. Định nghĩa lại usp_Submission_GetDetail
CREATE OR ALTER PROCEDURE [dbo].[usp_Submission_GetDetail]
    @ProjectId NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

    -- Tự động cập nhật đơn này sang Hoàn thành nếu đủ điều kiện
    UPDATE p
    SET p.[StatusId] = 7, p.[UpdatedAt] = GETDATE() -- 7 is Hoàn thành
    FROM [dbo].[CSR_Projects] p
    WHERE p.[Project_id] = @ProjectId
      AND p.[StatusId] = 5 -- 5 is BOD đã duyệt
      AND p.[RecordType] IN (1, 2)
      AND NOT EXISTS (
          SELECT 1 
          FROM [dbo].[CSR_Tasks] t
          WHERE t.[Project_id] = p.[Project_id]
            AND t.[StatusId] = 1
            AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)
      )
      AND EXISTS (
          SELECT 1 
          FROM [dbo].[CSR_Tasks] t
          WHERE t.[Project_id] = p.[Project_id]
            AND t.[StatusId] = 1
      );

    SELECT
        p.[Project_id], p.[Timestamp], p.[SubmitDate], p.[CustomerType], p.[CustomerName],
        p.[SubmitterEmail], p.[SubmitterName], p.[SubmitterMNV], p.[GuestRepName], p.[GuestReps],
        p.[GuestCount], p.[MeetingTopic], p.[Attendees], p.[AttendeesEmail],
        p.[AgendaInfo], p.[AgendaJsonData], p.[AgendaAttachUrl], s.TenTrangThai AS [Status], p.[CreatedAt], p.[UpdatedAt]
    FROM [dbo].[CSR_Projects] p
    INNER JOIN [dbo].[CSR_Statuses] s ON p.[StatusId] = s.[Id]
    WHERE p.[Project_id] = @ProjectId;

    SELECT
        v.[Task_id],
        v.[Project_id],
        v.[CustomerName],
        v.[CustomerType],
        v.[OnboardDate],
        v.[Destination],
        v.[TaskName],
        v.[TaskDetail],
        v.[Assignee],
        v.[AssigneeEmail],
        v.[Supervisor],
        v.[SupervisorEmail],
        t.[TaskAttendees],
        t.[TaskAttendeesEmail],
        t.[IncludeGuests],
        v.[DeadlineDate],
        v.[ReminderDate],
        v.[DeadlineStatus],
        v.[DaysUntilDeadline],
        v.[Vehicle],
        v.[PassengerCount],
        v.[FlightRoute],
        v.[ReturnDate],
        v.[MealOption],
        v.[MeetingRoom],
        v.[MeetingRoomEmail],
        v.[MeetingStartTime],
        v.[MeetingEndTime],
        v.[CalendarEventId],
        v.[ContentType]
    FROM [dbo].[vw_ActiveTasks] v
    INNER JOIN [dbo].[CSR_Tasks] t ON v.[Task_id] = t.[Task_id]
    WHERE v.[Project_id] = @ProjectId
    ORDER BY v.[OnboardDate], v.[Destination], v.[TaskName];
END;
GO

-- 3. Định nghĩa lại usp_Submission_List
CREATE OR ALTER PROCEDURE [dbo].[usp_Submission_List]
    @SearchText     NVARCHAR(200)   = '',
    @Status         NVARCHAR(50)    = '',
    @ActorRole      NVARCHAR(50)    = '',
    @ActorMNV       NVARCHAR(50)    = '',
    @PageNumber     INT             = 1,
    @PageSize       INT             = 20,
    @Tab            NVARCHAR(50)    = 'tracking'
AS
BEGIN
    SET NOCOUNT ON;

    -- Tự động cập nhật các đơn đủ điều kiện sang Hoàn thành trước khi trả kết quả
    UPDATE p
    SET p.[StatusId] = 7, p.[UpdatedAt] = GETDATE()
    FROM [dbo].[CSR_Projects] p
    WHERE p.[StatusId] = 5
      AND p.[RecordType] IN (1, 2)
      AND NOT EXISTS (
          SELECT 1 
          FROM [dbo].[CSR_Tasks] t
          WHERE t.[Project_id] = p.[Project_id]
            AND t.[StatusId] = 1
            AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)
      )
      AND EXISTS (
          SELECT 1 
          FROM [dbo].[CSR_Tasks] t
          WHERE t.[Project_id] = p.[Project_id]
            AND t.[StatusId] = 1
      );

    WITH LatestVersions AS (
        SELECT 
            [Project_id], 
            ROW_NUMBER() OVER (PARTITION BY [ParentId] ORDER BY [Version] DESC) as rn,
            MIN([CreatedAt]) OVER (PARTITION BY [ParentId]) as OriginalCreatedAt
        FROM [dbo].[vw_SubmissionSummary]
    )
    SELECT
        v.[Project_id], v.[ParentId], v.[RecordType], v.[Version], v.[SubmitDate], v.[CustomerType], v.[CustomerName],
        v.[SubmitterName], v.[MeetingTopic], v.[Status],
        lv.OriginalCreatedAt AS [CreatedAt],
        CASE 
            WHEN v.[RecordType] = 1 THEN v.[UpdatedAt]
            ELSE v.[CreatedAt] 
        END AS [UpdatedAt],
        v.[TotalDays], v.[OnboardDates], v.[Destinations], v.[TotalTasks], v.[UrgentTasks]
    FROM [dbo].[vw_SubmissionSummary] v
    INNER JOIN LatestVersions lv ON v.[Project_id] = lv.[Project_id] AND lv.rn = 1
    WHERE
        (
            -- User: chỉ thấy đơn do mình tạo
            (@ActorRole = 'User' AND v.[SubmitterMNV] = @ActorMNV)
            -- Các role khác (PRD, Admin, BOD): thấy theo tab
            OR (@ActorRole != 'User')
        )
        AND (@SearchText = '' OR [CustomerName] LIKE '%' + @SearchText + '%'
                         OR [SubmitterName] LIKE '%' + @SearchText + '%'
                         OR v.[Project_id]   LIKE '%' + @SearchText + '%')
        AND (@Status = '' OR [Status] = @Status)
        AND (
            -- Tab Theo dõi yêu cầu
            (@Tab = 'tracking' AND (
                (@ActorRole = 'BOD' AND [Status] = N'PRD đã duyệt')
                OR (@ActorRole != 'BOD' AND [Status] IN (N'Chờ phản hồi', N'PRD đã duyệt'))
            ))
            -- Tab Tra cứu yêu cầu
            OR (ISNULL(@Tab, '') != 'tracking' AND (
                -- Admin/PRD: thấy tất cả
                (@ActorRole NOT IN ('BOD', 'User'))
                -- BOD: thấy đơn do mình tạo (bất kể trạng thái) HOẶC đơn liên quan đến BOD duyệt
                OR (@ActorRole = 'BOD' AND (
                    v.[SubmitterMNV] = @ActorMNV
                    OR [Status] IN (N'PRD đã duyệt', N'BOD đã duyệt', N'BOD từ chối', N'Hoàn thành')
                ))
                -- User: thấy đơn do mình tạo (bất kể trạng thái)
                OR (@ActorRole = 'User' AND v.[SubmitterMNV] = @ActorMNV)
            ))
        )
    ORDER BY lv.OriginalCreatedAt DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;

    -- Tổng số bản ghi
    WITH LatestVersions AS (
        SELECT [Project_id], ROW_NUMBER() OVER (PARTITION BY [ParentId] ORDER BY [Version] DESC) as rn
        FROM [dbo].[vw_SubmissionSummary]
    )
    SELECT COUNT(*) AS [TotalCount]
    FROM [dbo].[vw_SubmissionSummary] v
    INNER JOIN LatestVersions lv ON v.[Project_id] = lv.[Project_id] AND lv.rn = 1
    WHERE
        (
            (@ActorRole = 'User' AND v.[SubmitterMNV] = @ActorMNV)
            OR (@ActorRole != 'User')
        )
        AND (@SearchText = '' OR [CustomerName] LIKE '%' + @SearchText + '%'
                         OR [SubmitterName] LIKE '%' + @SearchText + '%'
                         OR v.[Project_id]   LIKE '%' + @SearchText + '%')
        AND (@Status = '' OR [Status] = @Status)
        AND (
            (@Tab = 'tracking' AND (
                (@ActorRole = 'BOD' AND [Status] = N'PRD đã duyệt')
                OR (@ActorRole != 'BOD' AND [Status] IN (N'Chờ phản hồi', N'PRD đã duyệt'))
            ))
            OR (ISNULL(@Tab, '') != 'tracking' AND (
                (@ActorRole NOT IN ('BOD', 'User'))
                OR (@ActorRole = 'BOD' AND (
                    v.[SubmitterMNV] = @ActorMNV
                    OR [Status] IN (N'PRD đã duyệt', N'BOD đã duyệt', N'BOD từ chối', N'Hoàn thành')
                ))
                OR (@ActorRole = 'User' AND v.[SubmitterMNV] = @ActorMNV)
            ))
        );
END;
GO

PRINT 'Migration 71: Recreated stored procedures usp_GetGuestCalendar, usp_Submission_GetDetail, and usp_Submission_List to support edited projects (RecordType = 2)';
GO
