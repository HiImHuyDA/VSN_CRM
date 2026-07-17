-- Migration 94: Đồng nhất hành vi Sửa đơn giữa Fleet và CSR
-- Trước đây: sửa Fleet booking sẽ reset Status về 'Chờ phản hồi' + xoá VehicleId/DriverId/
-- ApprovedBy... (migration 93) rồi tự động gửi lại yêu cầu duyệt Giám sát mới.
-- Theo yêu cầu: Fleet áp dụng cùng logic "giữ nguyên" như CSR - sửa nội dung đơn KHÔNG
-- làm thay đổi Status hiện tại, KHÔNG gửi lại yêu cầu duyệt mới, KHÔNG đụng tới
-- VehicleId/DriverId/ApprovedBy/ApprovedAt (giữ nguyên thông tin đã phân xe nếu có).
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

        -- Chỉ cập nhật nội dung đơn, KHÔNG đụng tới [Status], [VehicleId], [DriverId],
        -- [AssignedNote], [ApprovedBy], [ApprovedAt] (giữ nguyên trạng thái duyệt hiện tại,
        -- đồng nhất hành vi với usp_UpdateSubmission bên module CSR).
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

PRINT 'Migration 94: usp_Fleet_Booking_Update no longer resets Status or clears vehicle/driver/approval info on edit - matches CSR behavior.';
GO