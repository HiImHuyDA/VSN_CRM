USE CSR_DB;
GO

-- 1. usp_GetTaskManagement
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
    WHERE t.[StatusId] = 1 -- thay thế IsActive = 1
      AND p.[StatusId] IN (5, 7) -- 5 = BOD đã duyệt, 7 = Hoàn thành (thay thế p.Status)
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


-- 2. usp_UpdateTaskStatus
CREATE OR ALTER PROCEDURE [dbo].[usp_UpdateTaskStatus]
    @TaskId     NVARCHAR(150),
    @NewStatus  NVARCHAR(50),
    @ActorMNV   NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    IF NOT EXISTS (SELECT 1 FROM [dbo].[CSR_Tasks] WHERE [Task_id] = @TaskId AND [StatusId] = 1)
    BEGIN
        RAISERROR('Không tìm thấy công việc', 16, 1);
        RETURN;
    END

    UPDATE [dbo].[CSR_Tasks]
    SET [TaskStatus] = @NewStatus
    WHERE [Task_id] = @TaskId AND [StatusId] = 1;

    -- Thêm log audit (nếu bảng CSR_AuditLogs có tồn tại)
    IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CSR_AuditLogs]') AND type = N'U')
    BEGIN
        INSERT INTO [dbo].[CSR_AuditLogs] ([Action], [Details], [MNV], [CreatedAt])
        VALUES ('UPDATE_TASK_STATUS', N'Cập nhật trạng thái Task ' + @TaskId + N' sang ' + @NewStatus, ISNULL(@ActorMNV, 'SYSTEM'), GETDATE());
    END

    -- Tự động hoàn thành / cập nhật trạng thái đơn tiếp đón chính nếu tất cả các task của đơn đó đã hoàn thành
    DECLARE @ProjectId NVARCHAR(150);
    SELECT @ProjectId = [Project_id] FROM [dbo].[CSR_Tasks] WHERE [Task_id] = @TaskId;

    IF @ProjectId IS NOT NULL
    BEGIN
        -- Đếm số lượng task chưa hoàn thành
        DECLARE @UncompletedCount INT;
        SELECT @UncompletedCount = COUNT(*)
        FROM [dbo].[CSR_Tasks]
        WHERE [Project_id] = @ProjectId 
          AND [StatusId] = 1 
          AND [TaskStatus] != N'Hoàn thành';

        -- Nếu tất cả task đã hoàn thành và đơn chính ở trạng thái 'BOD đã duyệt' (5), tự động chuyển thành 'Hoàn thành' (7)
        IF @UncompletedCount = 0
        BEGIN
            UPDATE [dbo].[CSR_Projects]
            SET [StatusId] = 7, -- Hoàn thành
                [UpdatedAt] = GETDATE()
            WHERE [Project_id] = @ProjectId 
              AND [RecordType] = 1 
              AND [StatusId] = 5; -- BOD đã duyệt
        END
    END

    SELECT @TaskId AS [TaskId], @NewStatus AS [TaskStatus], N'Cập nhật trạng thái thành công' AS [Message];
END;
GO

PRINT 'Fix for task management stored procedures applied successfully!';
GO
