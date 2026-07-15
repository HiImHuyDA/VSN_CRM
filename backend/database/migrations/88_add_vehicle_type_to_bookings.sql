-- ============================================================
-- Migration 88: Add VehicleType To Bookings Table and Procedures
-- ============================================================
USE CSR_DB;
GO

-- 1. Them cot VehicleType vao Fleet_Bookings neu chua ton tai
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Fleet_Bookings') AND name = 'VehicleType')
BEGIN
    ALTER TABLE [dbo].[Fleet_Bookings] ADD [VehicleType] NVARCHAR(100) NULL DEFAULT N'Xe công ty';
    PRINT 'Added column VehicleType to Fleet_Bookings';
END
GO

-- Cap nhat cac don cu neu co gia tri Null
UPDATE [dbo].[Fleet_Bookings]
SET [VehicleType] = N'Xe công ty'
WHERE [VehicleType] IS NULL;
GO

-- 2. Cap nhat stored procedure usp_Fleet_Booking_Create
CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_Booking_Create]
    @RequesterMNV    NVARCHAR(50)   = NULL,
    @RequesterName   NVARCHAR(200),
    @RequesterEmail  NVARCHAR(200)  = NULL,
    @RequesterDept   NVARCHAR(200)  = NULL,
    @PickupLocation  NVARCHAR(500),
    @Destination     NVARCHAR(500),
    @Stops           NVARCHAR(MAX)  = NULL,
    @DepartureTime   DATETIME,
    @ReturnTime      DATETIME       = NULL,
    @Purpose         NVARCHAR(1000),
    @PassengerCount  INT            = 1,
    @Priority        NVARCHAR(20)   = N'Bình thường',
    @Notes           NVARCHAR(1000) = NULL,
    @VehicleId       INT            = NULL,
    @DriverId        INT            = NULL,
    @Attendees       NVARCHAR(MAX)  = NULL,
    @AttendeesEmail  NVARCHAR(MAX)  = NULL,
    @VehicleType     NVARCHAR(100)  = N'Xe công ty'
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        -- Sinh BookingCode: VE-YYYY-XXXX
        DECLARE @Year CHAR(4) = CAST(YEAR(GETDATE()) AS CHAR(4));
        DECLARE @Seq INT;
        SELECT @Seq = COUNT(*) + 1
        FROM [dbo].[Fleet_Bookings]
        WHERE YEAR([CreatedAt]) = YEAR(GETDATE());
        DECLARE @Code NVARCHAR(30) = 'VE-' + @Year + '-' + RIGHT('0000' + CAST(@Seq AS NVARCHAR), 4);

        -- Quyen quyet dinh trang thai: neu gan xe ngay luc tao thi status la N'Team Admin đã duyệt', nguoc lai la N'Chờ phản hồi'
        DECLARE @InitStatus NVARCHAR(50) = N'Chờ phản hồi';
        IF @VehicleId IS NOT NULL
        BEGIN
            SET @InitStatus = N'Team Admin đã duyệt';
        END

        INSERT INTO [dbo].[Fleet_Bookings]
            ([BookingCode],[RequesterMNV],[RequesterName],[RequesterEmail],[RequesterDept],
             [PickupLocation],[Destination],[Stops],[DepartureTime],[ReturnTime],
             [Purpose],[PassengerCount],[Priority],[Notes],[Status],
             [VehicleId],[DriverId],[Attendees],[AttendeesEmail],[ApprovedBy],[ApprovedAt],[VehicleType])
        VALUES
            (@Code,@RequesterMNV,@RequesterName,@RequesterEmail,@RequesterDept,
             @PickupLocation,@Destination,@Stops,@DepartureTime,@ReturnTime,
             @Purpose,@PassengerCount,@Priority,@Notes,@InitStatus,
             @VehicleId,@DriverId,@Attendees,@AttendeesEmail,
             CASE WHEN @InitStatus = N'Team Admin đã duyệt' THEN @RequesterName ELSE NULL END,
             CASE WHEN @InitStatus = N'Team Admin đã duyệt' THEN GETDATE() ELSE NULL END,
             @VehicleType);

        DECLARE @NewId INT = SCOPE_IDENTITY();
        SELECT @NewId AS Id, @Code AS BookingCode, @InitStatus AS Status;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- 3. Cap nhat stored procedure usp_Fleet_Booking_Update
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

-- 4. Cap nhat stored procedure usp_Fleet_Booking_GetDetail
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
        b.[Notes], b.[CreatedAt], b.[UpdatedAt], b.[VehicleType]
    FROM [dbo].[Fleet_Bookings] b
    LEFT JOIN [dbo].[Fleet_Vehicles] v ON v.[Id] = b.[VehicleId]
    LEFT JOIN [dbo].[Fleet_Drivers]  d ON d.[Id] = b.[DriverId]
    WHERE b.[Id] = @Id;
END;
GO

-- 5. Cap nhat stored procedure usp_Fleet_Booking_List
CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_Booking_List]
    @SearchText    NVARCHAR(200)  = NULL,
    @Status        NVARCHAR(50)   = NULL,
    @RequesterMNV  NVARCHAR(50)   = NULL,
    @DateFrom      DATE           = NULL,
    @DateTo        DATE           = NULL,
    @PageNumber    INT            = 1,
    @PageSize      INT            = 20
AS
BEGIN
    SET NOCOUNT ON;

    SELECT COUNT(*) AS TotalCount
    FROM [dbo].[Fleet_Bookings] b
    WHERE
        (@SearchText IS NULL OR
            b.[BookingCode] LIKE '%' + @SearchText + '%' OR
            b.[RequesterName] LIKE '%' + @SearchText + '%' OR
            b.[Destination] LIKE '%' + @SearchText + '%' OR
            b.[PickupLocation] LIKE '%' + @SearchText + '%'
        )
        AND (@Status IS NULL OR b.[Status] = @Status)
        AND (@RequesterMNV IS NULL OR b.[RequesterMNV] = @RequesterMNV)
        AND (@DateFrom IS NULL OR CAST(b.[DepartureTime] AS DATE) >= @DateFrom)
        AND (@DateTo   IS NULL OR CAST(b.[DepartureTime] AS DATE) <= @DateTo);

    SELECT
        b.[Id], b.[BookingCode], b.[RequesterMNV], b.[RequesterName], b.[RequesterEmail],
        b.[RequesterDept], b.[PickupLocation], b.[Destination],
        b.[DepartureTime], b.[ReturnTime], b.[Purpose],
        b.[PassengerCount], b.[Priority], b.[Status],
        v.[PlateNumber] AS VehiclePlate, v.[Brand] AS VehicleBrand, v.[Model] AS VehicleModel,
        d.[FullName] AS DriverName, d.[Phone] AS DriverPhone,
        b.[ApprovedBy], b.[ApprovedAt],
        b.[RejectedReason], b.[CancelledReason],
        b.[CreatedAt], b.[UpdatedAt], b.[VehicleType]
    FROM [dbo].[Fleet_Bookings] b
    LEFT JOIN [dbo].[Fleet_Vehicles] v ON v.[Id] = b.[VehicleId]
    LEFT JOIN [dbo].[Fleet_Drivers]  d ON d.[Id] = b.[DriverId]
    WHERE
        (@SearchText IS NULL OR
            b.[BookingCode] LIKE '%' + @SearchText + '%' OR
            b.[RequesterName] LIKE '%' + @SearchText + '%' OR
            b.[Destination] LIKE '%' + @SearchText + '%' OR
            b.[PickupLocation] LIKE '%' + @SearchText + '%'
        )
        AND (@Status IS NULL OR b.[Status] = @Status)
        AND (@RequesterMNV IS NULL OR b.[RequesterMNV] = @RequesterMNV)
        AND (@DateFrom IS NULL OR CAST(b.[DepartureTime] AS DATE) >= @DateFrom)
        AND (@DateTo   IS NULL OR CAST(b.[DepartureTime] AS DATE) <= @DateTo)
    ORDER BY b.[CreatedAt] DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END;
GO

-- 6. Cap nhat stored procedure usp_Fleet_Booking_UpdateStatus
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
            b.[PickupLocation], b.[Destination], b.[DepartureTime], b.[ReturnTime],
            b.[Purpose], b.[PassengerCount], b.[Priority], b.[Status],
            v.[PlateNumber] AS VehiclePlate, v.[Brand] AS VehicleBrand, v.[Model] AS VehicleModel,
            d.[FullName] AS DriverName, d.[Phone] AS DriverPhone,
            b.[AssignedNote], b.[RejectedReason], b.[CancelledReason], b.[VehicleType]
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
