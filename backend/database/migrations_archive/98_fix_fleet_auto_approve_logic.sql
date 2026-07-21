-- Migration 98: Fix Fleet Booking Auto-Approve logic to only trigger when Priority is VIP
USE CSR_DB;
GO

-- 1. Update usp_Fleet_Booking_Create
CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_Booking_Create]
    -- Master fields
    @RequesterMNV    NVARCHAR(50)   = NULL,
    @RequesterName   NVARCHAR(200),
    @RequesterEmail  NVARCHAR(200)  = NULL,
    @RequesterDept   NVARCHAR(200)  = NULL,
    @DepartureTime   DATETIME,
    @ReturnTime      DATETIME       = NULL,
    @Purpose         NVARCHAR(1000),
    @ParentBookingCode NVARCHAR(30) = NULL,
    
    -- Departure Leg fields
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

    -- Return Leg fields
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
        -- Generate BookingCode: VE-YYYY-XXXX
        DECLARE @Year CHAR(4) = CAST(YEAR(GETDATE()) AS CHAR(4));
        DECLARE @Seq INT;
        SELECT @Seq = COUNT(*) + 1
        FROM [dbo].[Fleet_Bookings]
        WHERE YEAR([CreatedAt]) = YEAR(GETDATE());
        DECLARE @Code NVARCHAR(30) = 'VE-' + @Year + '-' + RIGHT('0000' + CAST(@Seq AS NVARCHAR), 4);

        -- Initial Status
        DECLARE @InitStatus NVARCHAR(50) = N'Chờ phản hồi';
        IF @Priority = N'VIP' AND @VehicleId IS NOT NULL
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

        -- Insert Departure Leg (-1)
        INSERT INTO [dbo].[Fleet_BookingsDetailed]
            ([BookingCode], [BookingCodeNo], [PickupLocation], [Destination], [Stops],
             [PassengerCount], [Priority], [VehicleId], [DriverId], [Notes],
             [Attendees], [AttendeesEmail], [VehicleType])
        VALUES
            (@Code, @Code + '-1', @PickupLocation, @Destination, @Stops,
             @PassengerCount, @Priority, @VehicleId, @DriverId, @Notes,
             @Attendees, @AttendeesEmail, @VehicleType);

        -- Insert Return Leg (-2) if ReturnTime is set
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

-- 2. Update usp_Fleet_Booking_Update
CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_Booking_Update]
    @Id              INT,
    @RequesterMNV    NVARCHAR(50)   = NULL,
    @RequesterName   NVARCHAR(200),
    @RequesterEmail  NVARCHAR(200)  = NULL,
    @RequesterDept   NVARCHAR(200)  = NULL,
    @DepartureTime   DATETIME,
    @ReturnTime      DATETIME       = NULL,
    @Purpose         NVARCHAR(1000),
    
    -- Departure Leg fields
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

    -- Return Leg fields
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
            THROW 50001, N'Booking không tồn tại', 1;

        -- Update old booking status to 'Đã chỉnh sửa'
        UPDATE [dbo].[Fleet_Bookings]
        SET [Status] = N'Đã chỉnh sửa', [UpdatedAt] = GETDATE()
        WHERE [Id] = @Id;

        -- Generate new BookingCode
        DECLARE @Year CHAR(4) = CAST(YEAR(GETDATE()) AS CHAR(4));
        DECLARE @Seq INT;
        SELECT @Seq = COUNT(*) + 1
        FROM [dbo].[Fleet_Bookings]
        WHERE YEAR([CreatedAt]) = YEAR(GETDATE());
        DECLARE @NewCode NVARCHAR(30) = 'VE-' + @Year + '-' + RIGHT('0000' + CAST(@Seq AS NVARCHAR), 4);

        -- Determine initial status
        DECLARE @InitStatus NVARCHAR(50) = N'Chờ phản hồi';
        IF @Priority = N'VIP' AND @VehicleId IS NOT NULL
            SET @InitStatus = N'Team Admin đã duyệt';

        -- Create new Master Booking row
        INSERT INTO [dbo].[Fleet_Bookings]
            ([BookingCode], [ParentBookingCode], [RequesterMNV], [RequesterName], [RequesterEmail], [RequesterDept],
             [DepartureTime], [ReturnTime], [Purpose], [Status], [ApprovedBy], [ApprovedAt])
        VALUES
            (@NewCode, @OldCode, @RequesterMNV, @RequesterName, @RequesterEmail, @RequesterDept,
             @DepartureTime, @ReturnTime, @Purpose, @InitStatus,
             CASE WHEN @InitStatus = N'Team Admin đã duyệt' THEN @RequesterName ELSE NULL END,
             CASE WHEN @InitStatus = N'Team Admin đã duyệt' THEN GETDATE() ELSE NULL END);

        DECLARE @NewId INT = SCOPE_IDENTITY();

        -- Create departure leg detailed row (-1)
        INSERT INTO [dbo].[Fleet_BookingsDetailed]
            ([BookingCode], [BookingCodeNo], [PickupLocation], [Destination], [Stops],
             [PassengerCount], [Priority], [VehicleId], [DriverId], [Notes],
             [Attendees], [AttendeesEmail], [VehicleType])
        VALUES
            (@NewCode, @NewCode + '-1', @PickupLocation, @Destination, @Stops,
             @PassengerCount, @Priority, @VehicleId, @DriverId, @Notes,
             @Attendees, @AttendeesEmail, @VehicleType);

        -- Create return leg detailed row (-2) if ReturnTime is set
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
