-- ============================================================
-- Migration 89: Fix Fleet SPs (Attendees/AttendeesEmail) + Calendar SP
-- ============================================================
USE CSR_DB;
GO

-- 1. Fix usp_Fleet_Booking_GetDetail - them Attendees, AttendeesEmail
CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_Booking_GetDetail]
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        b.[Id], b.[BookingCode], b.[RequesterMNV], b.[RequesterName], b.[RequesterEmail],
        b.[RequesterDept], b.[PickupLocation], b.[Destination], b.[Stops],
        b.[DepartureTime], b.[ReturnTime], b.[Purpose],
        b.[PassengerCount], b.[Priority], b.[Status],
        b.[VehicleId], v.[PlateNumber] AS VehiclePlate, v.[Brand] AS VehicleBrand,
        v.[Model] AS VehicleModel, v.[Seats] AS VehicleSeats, v.[Color] AS VehicleColor,
        b.[DriverId], d.[FullName] AS DriverName, d.[Phone] AS DriverPhone,
        d.[LicenseClass] AS DriverLicenseClass,
        b.[AssignedNote], b.[ApprovedBy], b.[ApprovedAt],
        b.[RejectedReason], b.[CancelledReason], b.[CompletedAt],
        b.[Notes], b.[CreatedAt], b.[UpdatedAt], b.[VehicleType],
        b.[Attendees], b.[AttendeesEmail]
    FROM [dbo].[Fleet_Bookings] b
    LEFT JOIN [dbo].[Fleet_Vehicles] v ON v.[Id] = b.[VehicleId]
    LEFT JOIN [dbo].[Fleet_Drivers]  d ON d.[Id] = b.[DriverId]
    WHERE b.[Id] = @Id;
END;
GO

-- 2. Fix usp_Fleet_Booking_UpdateStatus - them Attendees, AttendeesEmail trong SELECT output
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
        IF NOT EXISTS (SELECT 1 FROM [dbo].[Fleet_Bookings] WHERE [Id] = @Id)
            THROW 50001, N'Booking không tồn tại', 1;

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

-- 3. Tao moi usp_Fleet_Booking_GetCalendar - dung cho man hinh lich xe
-- Tra ve danh sach booking theo tuan (DateFrom -> DateTo) cho tung xe
CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_Booking_GetCalendar]
    @DateFrom   DATE,
    @DateTo     DATE,
    @VehicleId  INT  = NULL,
    @DriverId   INT  = NULL,
    @Status     NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        b.[Id], b.[BookingCode],
        b.[RequesterName], b.[RequesterDept],
        b.[PickupLocation], b.[Destination],
        b.[DepartureTime], b.[ReturnTime],
        b.[Purpose], b.[PassengerCount], b.[Priority],
        b.[Status], b.[VehicleType],
        b.[VehicleId],
        v.[PlateNumber] AS VehiclePlate, v.[Brand] AS VehicleBrand,
        v.[Model] AS VehicleModel, v.[Seats] AS VehicleSeats,
        v.[TypeId],
        vt.[TypeName] AS VehicleTypeName,
        b.[DriverId],
        d.[FullName] AS DriverName, d.[Phone] AS DriverPhone,
        b.[AssignedNote], b.[Notes],
        b.[Attendees]
    FROM [dbo].[Fleet_Bookings] b
    LEFT JOIN [dbo].[Fleet_Vehicles]     v  ON v.[Id] = b.[VehicleId]
    LEFT JOIN [dbo].[Fleet_VehicleTypes] vt ON vt.[Id] = v.[TypeId]
    LEFT JOIN [dbo].[Fleet_Drivers]      d  ON d.[Id] = b.[DriverId]
    WHERE
        CAST(b.[DepartureTime] AS DATE) <= @DateTo
        AND (b.[ReturnTime] IS NULL OR CAST(b.[ReturnTime] AS DATE) >= @DateFrom)
        AND (@VehicleId IS NULL OR b.[VehicleId] = @VehicleId)
        AND (@DriverId IS NULL OR b.[DriverId] = @DriverId)
        AND (@Status IS NULL OR b.[Status] = @Status)
        AND b.[Status] NOT IN (N'Đã hủy', N'Từ chối', N'Giám sát từ chối', N'Team Admin từ chối')
    ORDER BY b.[DepartureTime] ASC;
END;
GO

PRINT 'Migration 89 completed: Fixed Fleet SPs (Attendees + AttendeesEmail) and added Calendar SP';
GO
