-- Migration 68: Fix usp_RejectSubmission (bản đang chạy thật trên production)
-- Trước đây: PRD từ chối tạm gán StatusId = 9 (Đã hủy) vì chưa có status riêng.
-- Giờ đã có StatusId = 10 (PRD từ chối, thêm ở migration 67) => sửa lại cho đúng.
-- Đồng thời khôi phục đầy đủ dấu tiếng Việt cho các chuỗi NewStatusName (log lịch sử duyệt).
USE CSR_DB;
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_RejectSubmission]
    @ProjectId   NVARCHAR(100),
    @ActorRole   NVARCHAR(50)    = NULL,
    @ActorMNV    NVARCHAR(50)    = NULL,
    @ActorName   NVARCHAR(200)   = NULL,
    @ActorEmail  NVARCHAR(200)   = NULL,
    @Reason      NVARCHAR(MAX)   = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        DECLARE @CurrentStatusId INT;
        DECLARE @CurrentStatusName NVARCHAR(100);

        SELECT @CurrentStatusId = p.StatusId, @CurrentStatusName = s.TenTrangThai
    FROM [dbo].[CSR_Projects] p
        LEFT JOIN [dbo].[CSR_Statuses] s ON s.Id = p.StatusId
    WHERE p.[Project_id] = @ProjectId;

        IF @CurrentStatusId IS NULL
            RAISERROR(N'Không tìm thấy đơn: %s', 16, 1, @ProjectId);

        -- Map Actor Role -> StatusId mới trực tiếp (không lookup text)
        -- StatusId 8  = Chờ phản hồi (chờ PRD duyệt)
        -- StatusId 4  = PRD đã duyệt (chờ BOD duyệt)
        -- StatusId 6  = BOD từ chối
        -- StatusId 10 = PRD từ chối (thêm ở migration 67)
        DECLARE @NewStatusId INT;
        DECLARE @NewStatusName NVARCHAR(100);

        IF @ActorRole = N'PRD' AND @CurrentStatusId = 8
        BEGIN
        SET @NewStatusId = 10;
        -- PRD từ chối
        SET @NewStatusName = N'PRD từ chối';
    END
        ELSE IF @ActorRole = N'BOD' AND @CurrentStatusId = 4
        BEGIN
        SET @NewStatusId = 6;
        -- BOD từ chối
        SET @NewStatusName = N'BOD từ chối';
    END
        ELSE IF @ActorRole = N'Admin'
        BEGIN
        IF @CurrentStatusId = 8
            BEGIN
            SET @NewStatusId = 10;
            SET @NewStatusName = N'PRD từ chối';
        END
            ELSE IF @CurrentStatusId = 4
            BEGIN
            SET @NewStatusId = 6;
            SET @NewStatusName = N'BOD từ chối';
        END
            ELSE
                RAISERROR(N'Đơn này không ở trạng thái chờ duyệt. Không thể từ chối.', 16, 1);
    END
        ELSE
        BEGIN
        RAISERROR(N'Đơn này không ở trạng thái chờ duyệt. Không thể từ chối.', 16, 1);
    END

        UPDATE [dbo].[CSR_Projects]
        SET [StatusId] = @NewStatusId,
            [UpdatedAt] = GETDATE()
        WHERE [Project_id] = @ProjectId;

        INSERT INTO [dbo].[CSR_ApprovalLogs]
        ([ProjectId], [Action], [Role], [ActorMNV], [ActorName], [Reason], [OldStatus], [NewStatus])
    VALUES
        (@ProjectId, N'Reject', @ActorRole, @ActorMNV, @ActorName, @Reason, @CurrentStatusName, @NewStatusName);

        COMMIT TRANSACTION;
        SELECT @ProjectId AS [Project_id], @NewStatusName AS [NewStatus], N'Đã từ chối đơn thành công.' AS [Message];
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        DECLARE @Err NVARCHAR(500) = ERROR_MESSAGE();
        RAISERROR(@Err, 16, 1);
    END CATCH
END
GO

PRINT 'Migration 68: usp_RejectSubmission now maps PRD reject to StatusId=10 (PRD từ chối) instead of 9 (Đã hủy).';
GO