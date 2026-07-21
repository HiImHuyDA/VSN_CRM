USE CSR_DB;
GO

-- ============================================================
-- Cập nhật usp_GetTaskManagement để hỗ trợ các bộ lọc mới:
-- Mã đơn tiếp đón, Khách hàng, Ngày tiếp đón, Địa điểm
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_GetTaskManagement]
    @ActorRole      NVARCHAR(50) = '',
    @ActorMNV       NVARCHAR(50) = '',
    @Department     NVARCHAR(MAX) = NULL,
    @Assignee       NVARCHAR(MAX) = NULL,
    @ProjectId      NVARCHAR(MAX) = NULL,
    @CustomerName   NVARCHAR(MAX) = NULL,
    @OnboardDate    NVARCHAR(MAX) = NULL,
    @Destination    NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ActorEmail NVARCHAR(200) = '';
    IF @ActorMNV IS NOT NULL AND @ActorMNV != ''
    BEGIN
        SELECT TOP 1 @ActorEmail = [Email] FROM [dbo].[CSR_Employees] WHERE [MNV] = @ActorMNV;
    END

    SELECT 
        t.[Task_id] AS [TaskId],
        t.[Project_id] AS [ProjectId],
        p.[CustomerName],
        p.[CustomerType],
        p.[MeetingTopic],
        p.[SubmitterName],
        t.[TaskName],
        t.[TaskDetail],
        t.[Destination],
        t.[Assignee],
        t.[AssigneeEmail],
        t.[Supervisor],
        t.[SupervisorEmail],
        CONVERT(NVARCHAR(10), t.[OnboardDate], 23) AS [OnboardDate],
        CONVERT(NVARCHAR(10), t.[DeadlineDate], 23) AS [DeadlineDate],
        t.[TaskStatus],
        e.[Department] AS [Department],
        CASE 
            WHEN t.[TaskStatus] = N'Hoàn thành' OR t.[OnboardDate] < CAST(GETDATE() AS DATE) THEN N'Hoàn thành'
            WHEN t.[DeadlineDate] < CAST(GETDATE() AS DATE) THEN N'Delay'
            WHEN t.[TaskStatus] = N'Chưa bắt đầu' THEN N'Chưa bắt đầu'
            ELSE N'Đang xử lý'
        END AS [ComputedStatus],
        (SELECT COUNT(*) FROM [dbo].[CSR_TaskNotes] WHERE [TaskId] = t.[Task_id]) AS [NotesCount],
        (SELECT COUNT(*) FROM [dbo].[CSR_TaskAttachments] WHERE [TaskId] = t.[Task_id]) AS [AttachmentsCount]
    FROM [dbo].[CSR_Tasks] t
    INNER JOIN [dbo].[CSR_Projects] p ON t.[Project_id] = p.[Project_id]
    LEFT JOIN [dbo].[CSR_Employees] e ON p.[SubmitterMNV] = e.[MNV]
    WHERE t.[IsActive] = 1
      AND p.[Status] IN (N'BOD đã duyệt', N'Hoàn thành')
      AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)
      AND (
          @ActorRole IN ('Admin', 'BOD', 'PRD')
          OR t.[AssigneeEmail] = @ActorEmail
          OR t.[SupervisorEmail] = @ActorEmail
          OR p.[SubmitterMNV] = @ActorMNV
      )
      AND (@Department IS NULL OR @Department = '' OR e.[Department] IN (SELECT value FROM STRING_SPLIT(@Department, ',')))
      AND (@Assignee IS NULL OR @Assignee = '' OR t.[Assignee] IN (SELECT value FROM STRING_SPLIT(@Assignee, ',')) OR t.[AssigneeEmail] IN (SELECT value FROM STRING_SPLIT(@Assignee, ',')))
      AND (@ProjectId IS NULL OR @ProjectId = '' OR p.[Project_id] IN (SELECT value FROM STRING_SPLIT(@ProjectId, ',')))
      AND (@CustomerName IS NULL OR @CustomerName = '' OR p.[CustomerName] IN (SELECT value FROM STRING_SPLIT(@CustomerName, ',')))
      AND (@OnboardDate IS NULL OR @OnboardDate = '' OR CONVERT(NVARCHAR(10), t.[OnboardDate], 23) IN (SELECT value FROM STRING_SPLIT(@OnboardDate, ',')))
      AND (@Destination IS NULL OR @Destination = '' OR t.[Destination] IN (SELECT value FROM STRING_SPLIT(@Destination, ',')))
    ORDER BY t.[OnboardDate] ASC, t.[DeadlineDate] ASC;
END;
GO
