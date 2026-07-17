-- Migration 93: Fix usp_Fleet_Booking_Update
-- Bug: khi sửa 1 booking đã từng được duyệt/phân xe (VehicleId, DriverId, ApprovedBy...),
-- SP reset Status về 'Chờ phản hồi' nhưng KHÔNG xoá thông tin xe/tài xế/duyệt cũ,
-- khiến booking hiển thị "đang chờ duyệt" nhưng vẫn còn dính xe/tài xế của lần duyệt trước
-- (dữ liệu treo, gây hiểu nhầm khi xem chi tiết booking).
USE CSR_DB;
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_Booking_Update]
    @Id              INT,
    @PickupLocation  NVARCHAR(500),
    @Destination     NVARCHAR(500),
    @Stops           NVARCHAR(MAX)  = NULL,
    @DepartureTime   DATETIME,
    @ReturnTime      DATETIME       = NULL,
    @Purpose         NVARCHAR(1000),
    @PassengerCount  INT,
    @Priority        NVARCHAR(20),
    @Notes           NVARCHAR(1000) = NULL,
    @Attendees       NVARCHAR(MAX)  = NULL,
    @AttendeesEmail  NVARCHAR(MAX)  = NULL,
    @VehicleType     NVARCHAR(100)  = N'Xe công ty'
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM [dbo].[Fleet_Bookings] WHERE [Id] = @Id)
            THROW 50002, N'Booking không tồn tại', 1;

        UPDATE [dbo].[Fleet_Bookings]
        SET
            [PickupLocation] = @PickupLocation,
            [Destination]    = @Destination,
            [Stops]          = @Stops,
            [DepartureTime]  = @DepartureTime,
            [ReturnTime]     = @ReturnTime,
            [Purpose]        = @Purpose,
            [PassengerCount] = @PassengerCount,
            [Priority]       = @Priority,
            [Notes]          = @Notes,
            [Attendees]      = @Attendees,
            [AttendeesEmail] = @AttendeesEmail,
            [VehicleType]    = @VehicleType,
            [Status]         = N'Chờ phản hồi',
            -- Xoá sạch thông tin xe/tài xế/duyệt của lần xử lý trước, vì đơn quay lại
            -- từ đầu quy trình duyệt (Giám sát -> Team Admin), tránh dữ liệu treo/hiển thị sai.
            [VehicleId]      = NULL,
            [DriverId]       = NULL,
            [AssignedNote]   = NULL,
            [ApprovedBy]     = NULL,
            [ApprovedAt]     = NULL,
            [RejectedReason] = NULL,
            [UpdatedAt]      = GETDATE()
        WHERE [Id] = @Id;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

PRINT 'Migration 93: usp_Fleet_Booking_Update now clears stale vehicle/driver/approval info when resetting a booking back to Chờ phản hồi on edit.';
GO