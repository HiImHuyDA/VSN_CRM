-- Migration 92: Fix lỗ hổng "regression trạng thái" khi có duyệt trễ/duyệt trùng từ Teams
-- (đơn đã tiến xa hơn qua web, nhưng thẻ Teams cũ vẫn còn sống và bị click sau đó)
-- Áp dụng nguyên tắc: LUÔN kiểm tra OldStatus hiện tại đúng như tiền đề mong đợi trước khi ghi đè.
-- Nếu không đúng tiền đề -> RAISERROR (bị bắt và no-op an toàn ở tầng gọi, không xoá nhầm dữ liệu).
USE CSR_DB;
GO

-- 1. usp_ApproveSubmission: thêm guard cho nhánh PRD duyệt (nhánh BOD đã có guard từ trước)
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
            -- GUARD MỚI: đơn chỉ được PRD duyệt khi đang ở "Chờ phản hồi".
            -- Nếu đơn đã tiến xa hơn (PRD đã duyệt/BOD đã duyệt/Hoàn thành/Đã hủy/bị từ chối...)
            -- thì đây là 1 lần duyệt trễ/duyệt trùng (VD: click thẻ Teams cũ) -> từ chối, KHÔNG ghi đè.
            IF @OldStatus <> N'Chờ phản hồi'
                RAISERROR(N'Đơn đã được xử lý trước đó (trạng thái hiện tại: %s). Yêu cầu duyệt này đã lỗi thời.', 16, 1, @OldStatus);

            -- Nếu loại khách hàng không phải Brand (Partner, Supplier, Khách vãng lai, Ứng viên phỏng vấn)
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

-- 2. usp_Fleet_Booking_UpdateStatus: thêm guard OldStatus cho từng bước chuyển hợp lệ
CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_Booking_UpdateStatus]
    @Id             INT,
    @NewStatus      NVARCHAR(50),
    @ActorName      NVARCHAR(200) = NULL,
    @VehicleId      INT           = NULL,
    @DriverId       INT           = NULL,
    @AssignedNote   NVARCHAR(1000) = NULL,
    @RejectedReason NVARCHAR(1000) = NULL,
    @CancelledReason NVARCHAR(1000) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        DECLARE @OldStatus NVARCHAR(50);
        SELECT @OldStatus = [Status] FROM [dbo].[Fleet_Bookings] WHERE [Id] = @Id;

        IF @OldStatus IS NULL
            THROW 50001, N'Booking không tồn tại', 1;

        -- GUARD: mỗi bước chuyển trạng thái chỉ hợp lệ từ đúng 1 (vài) trạng thái tiền đề.
        -- Nếu không khớp -> coi là hành động trễ/trùng (VD: click lại thẻ Teams cũ sau khi
        -- booking đã được xử lý ở kênh khác - web hoặc Teams khác) -> từ chối, KHÔNG ghi đè.
        IF @NewStatus = N'Giám sát đã duyệt' AND @OldStatus <> N'Chờ phản hồi'
            THROW 50002, N'Booking đã được xử lý trước đó, không thể duyệt lại (Giám sát).', 1;
        IF @NewStatus = N'Giám sát từ chối' AND @OldStatus <> N'Chờ phản hồi'
            THROW 50002, N'Booking đã được xử lý trước đó, không thể từ chối lại (Giám sát).', 1;
        IF @NewStatus = N'Team Admin đã duyệt' AND @OldStatus <> N'Giám sát đã duyệt'
            THROW 50002, N'Booking chưa được Giám sát duyệt hoặc đã được xử lý trước đó.', 1;
        IF @NewStatus = N'Team Admin từ chối' AND @OldStatus <> N'Giám sát đã duyệt'
            THROW 50002, N'Booking chưa được Giám sát duyệt hoặc đã được xử lý trước đó.', 1;

        UPDATE [dbo].[Fleet_Bookings]
        SET
            [Status]          = @NewStatus,
            [UpdatedAt]       = GETDATE(),
            [VehicleId]       = CASE WHEN @NewStatus = N'Team Admin đã duyệt' THEN ISNULL(@VehicleId, [VehicleId]) ELSE [VehicleId] END,
            [DriverId]        = CASE WHEN @NewStatus = N'Team Admin đã duyệt' THEN ISNULL(@DriverId,  [DriverId])  ELSE [DriverId]  END,
            [AssignedNote]    = CASE WHEN @NewStatus = N'Team Admin đã duyệt' THEN @AssignedNote ELSE [AssignedNote] END,
            [ApprovedBy]      = CASE WHEN @NewStatus = N'Team Admin đã duyệt' THEN @ActorName    ELSE [ApprovedBy]   END,
            [ApprovedAt]      = CASE WHEN @NewStatus = N'Team Admin đã duyệt' THEN GETDATE()     ELSE [ApprovedAt]   END,
            [RejectedReason]  = CASE WHEN @NewStatus IN (N'Từ chối', N'Giám sát từ chối', N'Team Admin từ chối') THEN @RejectedReason ELSE [RejectedReason] END,
            [CancelledReason] = CASE WHEN @NewStatus = N'Đã hủy'   THEN @CancelledReason ELSE [CancelledReason] END,
            [CompletedAt]     = CASE WHEN @NewStatus = N'Hoàn thành' THEN GETDATE()   ELSE [CompletedAt]  END
        WHERE [Id] = @Id;

        SELECT
            b.[Id], b.[BookingCode], b.[RequesterName], b.[RequesterEmail], b.[RequesterDept],
            b.[RequesterMNV],
            b.[PickupLocation], b.[Destination], b.[DepartureTime], b.[ReturnTime],
            b.[Purpose], b.[PassengerCount], b.[Priority], b.[Status],
            v.[PlateNumber] AS VehiclePlate, v.[Brand] AS VehicleBrand, v.[Model] AS VehicleModel,
            v.[Seats] AS VehicleSeats,
            d.[FullName] AS DriverName, d.[Phone] AS DriverPhone,
            b.[AssignedNote], b.[RejectedReason], b.[CancelledReason], b.[VehicleType],
            b.[Attendees], b.[AttendeesEmail],
            b.[Notes]
        FROM [dbo].[Fleet_Bookings] b
        LEFT JOIN [dbo].[Fleet_Vehicles] v ON v.[Id] = b.[VehicleId]
        LEFT JOIN [dbo].[Fleet_Drivers]  d ON d.[Id] = b.[DriverId]
        WHERE b.[Id] = @Id;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

PRINT 'Migration 92: Added OldStatus precondition guards to usp_ApproveSubmission (PRD branch) and usp_Fleet_Booking_UpdateStatus to prevent stale/duplicate Teams approvals from regressing status.';
GO