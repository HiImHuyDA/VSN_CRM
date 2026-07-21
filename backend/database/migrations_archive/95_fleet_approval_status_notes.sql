-- Migration 95: Add Notes parameter to usp_Fleet_Booking_UpdateStatus to allow storing return leg assignment details
USE CSR_DB;
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_Booking_UpdateStatus]
    @Id             INT,
    @NewStatus      NVARCHAR(50),
    @ActorName      NVARCHAR(200) = NULL,
    @VehicleId      INT           = NULL,
    @DriverId       INT           = NULL,
    @AssignedNote   NVARCHAR(1000) = NULL,
    @RejectedReason NVARCHAR(1000) = NULL,
    @CancelledReason NVARCHAR(1000) = NULL,
    @Notes          NVARCHAR(1000) = NULL
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
            [CompletedAt]     = CASE WHEN @NewStatus = N'Hoàn thành' THEN GETDATE()   ELSE [CompletedAt]  END,
            [Notes]           = CASE WHEN @Notes IS NOT NULL THEN @Notes ELSE [Notes] END
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

PRINT 'Migration 95 completed: added Notes parameter to usp_Fleet_Booking_UpdateStatus.';
GO
