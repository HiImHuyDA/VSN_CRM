-- Migration 67: Thêm trạng thái "PRD từ chối" vào master data CSR_Statuses
-- và sửa usp_RejectSubmission để ghi đúng StatusId thay vì NULL âm thầm.
--
-- Nguyên nhân bug: CSR_Statuses trước đây không có record "PRD từ chối",
-- nên khi PRD từ chối đơn, subquery (SELECT Id FROM CSR_Statuses WHERE TenTrangThai = N'PRD từ chối')
-- trả về NULL, khiến CSR_Projects.StatusId bị ghi thành NULL mà không có lỗi nào được raise.
USE CSR_DB;
GO

-- 1. Thêm status mới "PRD từ chối" = StatusId 10
IF NOT EXISTS (SELECT 1
FROM [dbo].[CSR_Statuses]
WHERE [Id] = 10)
BEGIN
    INSERT INTO [dbo].[CSR_Statuses]
        ([Id], [TenTrangThai])
    VALUES
        (10, N'PRD từ chối');
    PRINT 'Added status: Id=10, PRD từ chối';
END
GO

-- 2. Cập nhật usp_RejectSubmission — bỏ giá trị mặc định "Từ chối" không tồn tại,
--    và thêm kiểm tra an toàn: nếu tra không ra StatusId hợp lệ thì raise lỗi rõ ràng
--    thay vì âm thầm ghi NULL.
CREATE OR ALTER PROCEDURE [dbo].[usp_RejectSubmission]
    @ProjectId      NVARCHAR(100),
    @ActorRole      NVARCHAR(50)    = NULL,
    @ActorMNV       NVARCHAR(50)    = NULL,
    @ActorName      NVARCHAR(200)   = NULL,
    @ActorEmail     NVARCHAR(200)   = NULL,
    @Reason         NVARCHAR(MAX)   = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        DECLARE @OldStatus NVARCHAR(50);
        SELECT @OldStatus = s.TenTrangThai
    FROM [dbo].[CSR_Projects] p
        INNER JOIN [dbo].[CSR_Statuses] s ON p.StatusId = s.Id
    WHERE p.[Project_id] = @ProjectId;

        IF @OldStatus IS NULL
            RAISERROR(N'Không tìm thấy đơn: %s', 16, 1, @ProjectId);

        IF @ActorRole = N'BOD' AND @OldStatus <> N'PRD đã duyệt'
            RAISERROR(N'BOD chỉ xử lý được đơn đã được PRD phê duyệt trước.', 16, 1);

        DECLARE @NewStatus NVARCHAR(50);

        IF @ActorRole = N'PRD' OR (@ActorRole = N'Admin' AND @OldStatus = N'Chờ phản hồi')
            SET @NewStatus = N'PRD từ chối';
        ELSE IF @ActorRole = N'BOD' OR (@ActorRole = N'Admin' AND @OldStatus = N'PRD đã duyệt')
            SET @NewStatus = N'BOD từ chối';
        ELSE
            SET @NewStatus = N'PRD từ chối'; -- fallback an toàn, thay vì 'Từ chối' không tồn tại trong master

        DECLARE @NewStatusId INT = (SELECT Id
    FROM [dbo].[CSR_Statuses]
    WHERE [TenTrangThai] = @NewStatus);

        IF @NewStatusId IS NULL
            RAISERROR(N'Trạng thái "%s" không tồn tại trong CSR_Statuses.', 16, 1, @NewStatus);

        UPDATE [dbo].[CSR_Projects]
        SET [StatusId] = @NewStatusId, [UpdatedAt] = GETDATE()
        WHERE [Project_id] = @ProjectId;

        INSERT INTO [dbo].[CSR_ApprovalLogs]
        ([ProjectId], [Action], [Role], [ActorMNV], [ActorName], [Reason], [OldStatus], [NewStatus])
    VALUES
        (@ProjectId, N'Reject', @ActorRole, @ActorMNV, @ActorName, @Reason, @OldStatus, @NewStatus);

        COMMIT TRANSACTION;
        SELECT @ProjectId AS [Project_id], @NewStatus AS [NewStatus],
        N'Đã từ chối đơn' AS [Message];
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        DECLARE @Err NVARCHAR(500) = ERROR_MESSAGE();
        RAISERROR(@Err, 16, 1);
    END CATCH
END
GO

PRINT 'Migration 67: Added PRD từ chối status (Id=10) and hardened usp_RejectSubmission against silent NULL StatusId writes.';
GO