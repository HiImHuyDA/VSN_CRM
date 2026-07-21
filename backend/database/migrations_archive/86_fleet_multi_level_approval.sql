-- Migration 86: Fleet management multi level approval, status module column, and ManagerEmail field
USE CSR_DB;
GO

-- 1. Add ManagerEmail to CSR_Employees if not exists
IF COL_LENGTH('dbo.CSR_Employees', 'ManagerEmail') IS NULL
BEGIN
    ALTER TABLE [dbo].[CSR_Employees]
    ADD [ManagerEmail] NVARCHAR(200) NULL;
    PRINT 'Added ManagerEmail column to CSR_Employees';
END
GO

-- 2. Add Module to CSR_Statuses if not exists
IF COL_LENGTH('dbo.CSR_Statuses', 'Module') IS NULL
BEGIN
    ALTER TABLE [dbo].[CSR_Statuses]
    ADD [Module] NVARCHAR(20) NOT NULL DEFAULT 'All';
    PRINT 'Added Module column to CSR_Statuses';
END
GO

-- 3. Seed new statuses & update Module for existing ones
IF EXISTS (SELECT 1 FROM [dbo].[CSR_Statuses])
BEGIN
    -- Update existing statuses
    UPDATE [dbo].[CSR_Statuses] SET [Module] = 'All' WHERE [TenTrangThai] IN (N'Chờ phản hồi', N'Hoàn thành', N'Đã hủy', N'Đã huỷ');
    UPDATE [dbo].[CSR_Statuses] SET [Module] = 'CSR' WHERE [TenTrangThai] IN (N'PRD đã duyệt', N'PRD từ chối', N'BOD đã duyệt', N'BOD từ chối', N'Mới');

    -- Insert new statuses for Fleet
    IF NOT EXISTS (SELECT 1 FROM [dbo].[CSR_Statuses] WHERE [Id] = 11)
        INSERT INTO [dbo].[CSR_Statuses] ([Id], [TenTrangThai], [Module]) VALUES (11, N'Giám sát đã duyệt', 'Fleet');
    IF NOT EXISTS (SELECT 1 FROM [dbo].[CSR_Statuses] WHERE [Id] = 12)
        INSERT INTO [dbo].[CSR_Statuses] ([Id], [TenTrangThai], [Module]) VALUES (12, N'Giám sát từ chối', 'Fleet');
    IF NOT EXISTS (SELECT 1 FROM [dbo].[CSR_Statuses] WHERE [Id] = 13)
        INSERT INTO [dbo].[CSR_Statuses] ([Id], [TenTrangThai], [Module]) VALUES (13, N'Team Admin đã duyệt', 'Fleet');
    IF NOT EXISTS (SELECT 1 FROM [dbo].[CSR_Statuses] WHERE [Id] = 14)
        INSERT INTO [dbo].[CSR_Statuses] ([Id], [TenTrangThai], [Module]) VALUES (14, N'Team Admin từ chối', 'Fleet');
    
    PRINT 'Seeded new fleet statuses';
END
GO

-- 4. ALTER stored procedure usp_Fleet_Booking_Create to use 'Chờ phản hồi' as default status
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
    @AttendeesEmail  NVARCHAR(MAX)  = NULL
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
             [VehicleId],[DriverId],[Attendees],[AttendeesEmail],[ApprovedBy],[ApprovedAt])
        VALUES
            (@Code,@RequesterMNV,@RequesterName,@RequesterEmail,@RequesterDept,
             @PickupLocation,@Destination,@Stops,@DepartureTime,@ReturnTime,
             @Purpose,@PassengerCount,@Priority,@Notes,@InitStatus,
             @VehicleId,@DriverId,@Attendees,@AttendeesEmail,
             CASE WHEN @InitStatus = N'Team Admin đã duyệt' THEN @RequesterName ELSE NULL END,
             CASE WHEN @InitStatus = N'Team Admin đã duyệt' THEN GETDATE() ELSE NULL END);

        DECLARE @NewId INT = SCOPE_IDENTITY();
        SELECT @NewId AS Id, @Code AS BookingCode, @InitStatus AS Status;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO

-- 5. ALTER stored procedure usp_Fleet_Booking_UpdateStatus to handle new status list
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
        -- Kiem tra booking ton tai
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

        -- Tra ve thong tin day du de gui email
        SELECT
            b.[Id], b.[BookingCode], b.[RequesterName], b.[RequesterEmail], b.[RequesterDept],
            b.[PickupLocation], b.[Destination], b.[DepartureTime], b.[ReturnTime],
            b.[Purpose], b.[PassengerCount], b.[Priority], b.[Status],
            v.[PlateNumber] AS VehiclePlate, v.[Brand] AS VehicleBrand, v.[Model] AS VehicleModel,
            d.[FullName] AS DriverName, d.[Phone] AS DriverPhone,
            b.[AssignedNote], b.[RejectedReason], b.[CancelledReason]
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
END
GO

-- 6. CREATE stored procedure usp_Fleet_Booking_Update for editing booking
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
    @AttendeesEmail  NVARCHAR(MAX)  = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM [dbo].[Fleet_Bookings] WHERE [Id] = @Id)
            THROW 50002, N'Booking không tồn tại', 1;

        -- Reset status back to N'Chờ phản hồi' when updated/edited
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
            [Status]         = N'Chờ phản hồi',
            [UpdatedAt]      = GETDATE()
        WHERE [Id] = @Id;

        SELECT @Id AS Id, N'Cập nhật booking thành công' AS Message;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO
