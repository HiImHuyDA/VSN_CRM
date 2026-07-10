USE CSR_DB;
GO

-- 1. Xóa bảng cũ nếu tồn tại và tạo lại theo cấu trúc mới
IF EXISTS (SELECT 1 FROM sys.objects WHERE name = 'CSR_ScheduledEmails' AND type = 'U')
BEGIN
    DROP TABLE [dbo].[CSR_ScheduledEmails];
    PRINT 'Dropped old table: CSR_ScheduledEmails';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'CSR_ScheduledEmails' AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[CSR_ScheduledEmails] (
        [Id]            INT IDENTITY(1,1) PRIMARY KEY,
        [ProjectId]     NVARCHAR(100) NOT NULL,
        [ParentId]      NVARCHAR(100) NOT NULL,
        [EmailType]     NVARCHAR(50) NOT NULL, -- 'Approval' hoặc 'Edit'
        [SendAt]        DATETIME NOT NULL,
        [Status]        NVARCHAR(50) NOT NULL DEFAULT 'Pending', -- 'Pending', 'Sent', 'Failed', 'Cancelled'
        [SentAt]        DATETIME NULL,
        [ErrorMessage]  NVARCHAR(MAX) NULL,
        [CreatedAt]     DATETIME DEFAULT GETDATE(),
        [UpdatedAt]     DATETIME DEFAULT GETDATE()
    );
    PRINT 'Created table: CSR_ScheduledEmails';
END
GO

-- 2. Cập nhật stored procedure usp_ApproveSubmission
CREATE OR ALTER PROCEDURE [dbo].[usp_ApproveSubmission]
    @ProjectId      NVARCHAR(100),
    @ActorRole      NVARCHAR(50)    = NULL,
    @ActorMNV       NVARCHAR(50)    = NULL,
    @ActorName      NVARCHAR(200)   = NULL,
    @ActorEmail     NVARCHAR(200)   = NULL,
    @Note           NVARCHAR(MAX)   = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        DECLARE @OldStatus NVARCHAR(50);
        DECLARE @CustomerType NVARCHAR(50);

        SELECT @OldStatus = s.TenTrangThai, @CustomerType = p.CustomerType
        FROM [dbo].[CSR_Projects] p
        INNER JOIN [dbo].[CSR_Statuses] s ON p.StatusId = s.Id
        WHERE p.[Project_id] = @ProjectId;

        IF @OldStatus IS NULL
            RAISERROR(N'Không tìm thấy đơn: %s', 16, 1, @ProjectId);

        DECLARE @NewStatus NVARCHAR(50);

        IF @ActorRole = N'BOD' OR (@ActorRole = N'Admin' AND @OldStatus = N'PRD đã duyệt')
        BEGIN
            IF @OldStatus <> N'PRD đã duyệt'
                RAISERROR(N'Chỉ duyệt được đơn đã được PRD phê duyệt trước.', 16, 1);
            SET @NewStatus = N'BOD đã duyệt';
        END
        ELSE
        BEGIN
            -- Nếu loại khách hàng không phải Brand (tức là Partner, Supplier, Khách vãng lai, Ứng viên phỏng vấn)
            -- thì PRD duyệt chuyển thẳng sang BOD đã duyệt để bỏ qua bước duyệt của BOD.
            IF @CustomerType IN (N'Partner', N'Supplier', N'Khách vãng lai', N'Ứng viên phỏng vấn')
                SET @NewStatus = N'BOD đã duyệt';
            ELSE
                SET @NewStatus = N'PRD đã duyệt';
        END

        UPDATE [dbo].[CSR_Projects]
        SET [StatusId] = (SELECT Id FROM [dbo].[CSR_Statuses] WHERE [TenTrangThai] = @NewStatus), [UpdatedAt] = GETDATE()
        WHERE [Project_id] = @ProjectId;

        INSERT INTO [dbo].[CSR_ApprovalLogs]
            ([ProjectId], [Action], [Role], [ActorMNV], [ActorName], [Reason], [OldStatus], [NewStatus])
        VALUES
            (@ProjectId, N'Approve', @ActorRole, @ActorMNV, @ActorName, @Note, @OldStatus, @NewStatus);

        COMMIT TRANSACTION;
        SELECT @ProjectId AS [Project_id], @NewStatus AS [NewStatus],
               N'Đã phê duyệt thành công' AS [Message];
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        DECLARE @Err NVARCHAR(500) = ERROR_MESSAGE();
        RAISERROR(@Err, 16, 1);
    END CATCH
END
GO
