-- Migration 100: Fix logic tự động duyệt (auto-approve) cho đơn VIP khứ hồi
-- Bug: usp_Fleet_Booking_Create/Update chỉ kiểm tra chặng ĐI (@Priority='VIP' AND @VehicleId IS NOT NULL)
-- để quyết định InitStatus = 'Team Admin đã duyệt'. Nếu là đơn khứ hồi (@ReturnTime IS NOT NULL) mà
-- chặng VỀ chưa được chọn xe (dù @ReturnPriority='VIP'), toàn bộ đơn vẫn bị tự động duyệt xong,
-- khiến chặng về "treo" (không có xe/tài xế) dù đơn hiển thị đã hoàn tất duyệt.
-- Fix: chỉ auto-approve khi TẤT CẢ các chặng có mặt đều đã VIP + có xe.
USE CSR_DB;
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_Booking_Create]
    @RequesterMNV    NVARCHAR(50)   = NULL,
    @RequesterName   NVARCHAR(200),
    @RequesterEmail  NVARCHAR(200)  = NULL,
    @RequesterDept   NVARCHAR(200)  = NULL,
    @DepartureTime   DATETIME,
    @ReturnTime      DATETIME       = NULL,
    @Purpose         NVARCHAR(1000),
    @ParentBookingCode NVARCHAR(30) = NULL,
    @PickupLocation  NVARCHAR(500),
    @Destination     NVARCHAR(500),
    @Stops           NVARCHAR(MAX)  = NULL,
    @PassengerCount  INT            = 1,
    @Priority        NVARCHAR(20)   = N'Bình thường',
    @VehicleType     NVARCHAR(100)  = N'Xe công ty',
    @Attendees       NVARCHAR(MAX)  = NULL,
    @AttendeesEmail  NVARCHAR(MAX)  = NULL,
    @Notes           NVARCHAR(1000) = NULL,
    @VehicleId       INT            = NULL,
    @DriverId        INT            = NULL,
    @ReturnStops          NVARCHAR(MAX)  = NULL,
    @ReturnPassengerCount INT            = 1,
    @ReturnPriority       NVARCHAR(20)   = N'Bình thường',
    @ReturnVehicleType    NVARCHAR(100)  = N'Xe công ty',
    @ReturnAttendees      NVARCHAR(MAX)  = NULL,
    @ReturnAttendeesEmail NVARCHAR(MAX)  = NULL,
    @ReturnNotes          NVARCHAR(1000) = NULL,
    @ReturnVehicleId      INT            = NULL,
    @ReturnDriverId       INT            = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        DECLARE @Year CHAR(4) = CAST(YEAR(GETDATE()) AS CHAR(4));
        DECLARE @Seq INT;
        SELECT @Seq = COUNT(*) + 1
        FROM [dbo].[Fleet_Bookings]
        WHERE YEAR([CreatedAt]) = YEAR(GETDATE());
        DECLARE @Code NVARCHAR(30) = 'VE-' + @Year + '-' + RIGHT('0000' + CAST(@Seq AS NVARCHAR), 4);

        -- Auto-approve: chỉ khi chặng đi VIP+có xe, VÀ (không phải khứ hồi HOẶC chặng về cũng VIP+có xe)
        DECLARE @InitStatus NVARCHAR(50) = N'Chờ phản hồi';
        IF (@Priority = N'VIP' AND @VehicleId IS NOT NULL)
           AND (@ReturnTime IS NULL OR (@ReturnPriority = N'VIP' AND @ReturnVehicleId IS NOT NULL))
        BEGIN
            SET @InitStatus = N'Team Admin đã duyệt';
        END

        INSERT INTO [dbo].[Fleet_Bookings]
            ([BookingCode], [ParentBookingCode], [RequesterMNV], [RequesterName], [RequesterEmail], [RequesterDept],
             [DepartureTime], [ReturnTime], [Purpose], [Status], [ApprovedBy], [ApprovedAt])
        VALUES
            (@Code, @ParentBookingCode, @RequesterMNV, @RequesterName, @RequesterEmail, @RequesterDept,
             @DepartureTime, @ReturnTime, @Purpose, @InitStatus,
             CASE WHEN @InitStatus = N'Team Admin đã duyệt' THEN @RequesterName ELSE NULL END,
             CASE WHEN @InitStatus = N'Team Admin đã duyệt' THEN GETDATE() ELSE NULL END);

        DECLARE @NewId INT = SCOPE_IDENTITY();

        INSERT INTO [dbo].[Fleet_BookingsDetailed]
            ([BookingCode], [BookingCodeNo], [PickupLocation], [Destination], [Stops],
             [PassengerCount], [Priority], [VehicleId], [DriverId], [Notes],
             [Attendees], [AttendeesEmail], [VehicleType])
        VALUES
            (@Code, @Code + '-1', @PickupLocation, @Destination, @Stops,
             @PassengerCount, @Priority, @VehicleId, @DriverId, @Notes,
             @Attendees, @AttendeesEmail, @VehicleType);

        IF @ReturnTime IS NOT NULL
        BEGIN
            INSERT INTO [dbo].[Fleet_BookingsDetailed]
                ([BookingCode], [BookingCodeNo], [PickupLocation], [Destination], [Stops],
                 [PassengerCount], [Priority], [VehicleId], [DriverId], [Notes],
                 [Attendees], [AttendeesEmail], [VehicleType])
            VALUES
                (@Code, @Code + '-2', @Destination, @PickupLocation, @ReturnStops,
                 @ReturnPassengerCount, @ReturnPriority, @ReturnVehicleId, @ReturnDriverId, @ReturnNotes,
                 @ReturnAttendees, @ReturnAttendeesEmail, @ReturnVehicleType);
        END

        SELECT @NewId AS Id, @Code AS BookingCode, @InitStatus AS Status;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- usp_Fleet_Booking_Update: áp dụng đúng cùng logic auto-approve như trên
CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_Booking_Update]
    @Id              INT,
    @RequesterMNV    NVARCHAR(50)   = NULL,
    @RequesterName   NVARCHAR(200),
    @RequesterEmail  NVARCHAR(200)  = NULL,
    @RequesterDept   NVARCHAR(200)  = NULL,
    @DepartureTime   DATETIME,
    @ReturnTime      DATETIME       = NULL,
    @Purpose         NVARCHAR(1000),
    @PickupLocation  NVARCHAR(500),
    @Destination     NVARCHAR(500),
    @Stops           NVARCHAR(MAX)  = NULL,
    @PassengerCount  INT            = 1,
    @Priority        NVARCHAR(20)   = N'Bình thường',
    @VehicleType     NVARCHAR(100)  = N'Xe công ty',
    @Attendees       NVARCHAR(MAX)  = NULL,
    @AttendeesEmail  NVARCHAR(MAX)  = NULL,
    @Notes           NVARCHAR(1000) = NULL,
    @VehicleId       INT            = NULL,
    @DriverId        INT            = NULL,
    @ReturnStops          NVARCHAR(MAX)  = NULL,
    @ReturnPassengerCount INT            = 1,
    @ReturnPriority       NVARCHAR(20)   = N'Bình thường',
    @ReturnVehicleType    NVARCHAR(100)  = N'Xe công ty',
    @ReturnAttendees      NVARCHAR(MAX)  = NULL,
    @ReturnAttendeesEmail NVARCHAR(MAX)  = NULL,
    @ReturnNotes          NVARCHAR(1000) = NULL,
    @ReturnVehicleId      INT            = NULL,
    @ReturnDriverId       INT            = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        DECLARE @OldCode NVARCHAR(30);
        SELECT @OldCode = [BookingCode] FROM [dbo].[Fleet_Bookings] WHERE [Id] = @Id;
        IF @OldCode IS NULL
            THROW 50002, N'Booking không tồn tại', 1;

        UPDATE [dbo].[Fleet_Bookings]
        SET [Status] = N'Đã chỉnh sửa', [UpdatedAt] = GETDATE()
        WHERE [Id] = @Id;

        DECLARE @Year CHAR(4) = CAST(YEAR(GETDATE()) AS CHAR(4));
        DECLARE @Seq INT;
        SELECT @Seq = COUNT(*) + 1
        FROM [dbo].[Fleet_Bookings]
        WHERE YEAR([CreatedAt]) = YEAR(GETDATE());
        DECLARE @NewCode NVARCHAR(30) = 'VE-' + @Year + '-' + RIGHT('0000' + CAST(@Seq AS NVARCHAR), 4);

        -- Auto-approve: cùng logic với usp_Fleet_Booking_Create (xét đủ cả 2 chặng)
        DECLARE @InitStatus NVARCHAR(50) = N'Chờ phản hồi';
        IF (@Priority = N'VIP' AND @VehicleId IS NOT NULL)
           AND (@ReturnTime IS NULL OR (@ReturnPriority = N'VIP' AND @ReturnVehicleId IS NOT NULL))
        BEGIN
            SET @InitStatus = N'Team Admin đã duyệt';
        END

        INSERT INTO [dbo].[Fleet_Bookings]
            ([BookingCode], [ParentBookingCode], [RequesterMNV], [RequesterName], [RequesterEmail], [RequesterDept],
             [DepartureTime], [ReturnTime], [Purpose], [Status], [ApprovedBy], [ApprovedAt])
        VALUES
            (@NewCode, @OldCode, @RequesterMNV, @RequesterName, @RequesterEmail, @RequesterDept,
             @DepartureTime, @ReturnTime, @Purpose, @InitStatus,
             CASE WHEN @InitStatus = N'Team Admin đã duyệt' THEN @RequesterName ELSE NULL END,
             CASE WHEN @InitStatus = N'Team Admin đã duyệt' THEN GETDATE() ELSE NULL END);

        DECLARE @NewId INT = SCOPE_IDENTITY();

        INSERT INTO [dbo].[Fleet_BookingsDetailed]
            ([BookingCode], [BookingCodeNo], [PickupLocation], [Destination], [Stops],
             [PassengerCount], [Priority], [VehicleId], [DriverId], [Notes],
             [Attendees], [AttendeesEmail], [VehicleType])
        VALUES
            (@NewCode, @NewCode + '-1', @PickupLocation, @Destination, @Stops,
             @PassengerCount, @Priority, @VehicleId, @DriverId, @Notes,
             @Attendees, @AttendeesEmail, @VehicleType);

        IF @ReturnTime IS NOT NULL
        BEGIN
            INSERT INTO [dbo].[Fleet_BookingsDetailed]
                ([BookingCode], [BookingCodeNo], [PickupLocation], [Destination], [Stops],
                 [PassengerCount], [Priority], [VehicleId], [DriverId], [Notes],
                 [Attendees], [AttendeesEmail], [VehicleType])
            VALUES
                (@NewCode, @NewCode + '-2', @Destination, @PickupLocation, @ReturnStops,
                 @ReturnPassengerCount, @ReturnPriority, @ReturnVehicleId, @ReturnDriverId, @ReturnNotes,
                 @ReturnAttendees, @ReturnAttendeesEmail, @ReturnVehicleType);
        END

        SELECT @NewId AS Id, @NewCode AS BookingCode, @InitStatus AS Status;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

PRINT 'Migration 100: Fixed VIP auto-approve logic to check both legs (departure + return) before auto-approving a round-trip booking.';
GO