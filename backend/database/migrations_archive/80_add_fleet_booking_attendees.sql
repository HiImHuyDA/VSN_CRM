-- Migration 80: Add Attendees and support VIP creation select in Fleet Bookings
USE CSR_DB;
GO

-- 1. Them cot Attendees va AttendeesEmail vao bang Fleet_Bookings
IF COL_LENGTH('dbo.Fleet_Bookings', 'Attendees') IS NULL
BEGIN
    ALTER TABLE [dbo].[Fleet_Bookings]
    ADD [Attendees] NVARCHAR(MAX) NULL;
    PRINT 'Da them cot Attendees vao Fleet_Bookings.';
END
GO

IF COL_LENGTH('dbo.Fleet_Bookings', 'AttendeesEmail') IS NULL
BEGIN
    ALTER TABLE [dbo].[Fleet_Bookings]
    ADD [AttendeesEmail] NVARCHAR(MAX) NULL;
    PRINT 'Da them cot AttendeesEmail vao Fleet_Bookings.';
END
GO

-- 2. Cap nhat stored procedure tao booking: ho tro VehicleId, DriverId, Attendees, AttendeesEmail
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

        -- Quyen quyet dinh trang thai: neu gan xe ngay luc tao thi status la N'Đã duyệt', nguoc lai la N'Chờ duyệt'
        DECLARE @InitStatus NVARCHAR(50) = N'Chờ duyệt';
        IF @VehicleId IS NOT NULL
        BEGIN
            SET @InitStatus = N'Đã duyệt';
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
             CASE WHEN @InitStatus = N'Đã duyệt' THEN @RequesterName ELSE NULL END,
             CASE WHEN @InitStatus = N'Đã duyệt' THEN GETDATE() ELSE NULL END);

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

-- 3. Cap nhat stored procedure lay chi tiet booking: them cot Attendees, AttendeesEmail
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
        b.[Notes], b.[Attendees], b.[AttendeesEmail], b.[CreatedAt], b.[UpdatedAt]
    FROM [dbo].[Fleet_Bookings] b
    LEFT JOIN [dbo].[Fleet_Vehicles] v ON v.[Id] = b.[VehicleId]
    LEFT JOIN [dbo].[Fleet_Drivers]  d ON d.[Id] = b.[DriverId]
    WHERE b.[Id] = @Id;
END
GO

-- 4. Cap nhat stored procedure xuat Excel
CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_Booking_Export]
    @Status        NVARCHAR(50)   = NULL,
    @RequesterMNV  NVARCHAR(50)   = NULL,
    @DateFrom      DATE           = NULL,
    @DateTo        DATE           = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        b.[BookingCode] AS N'Mã đặt xe',
        FORMAT(b.[CreatedAt], 'dd/MM/yyyy') AS N'Ngày tạo',
        b.[RequesterName] AS N'Người đặt',
        b.[RequesterDept] AS N'Phòng ban',
        b.[PickupLocation] AS N'Điểm đón',
        b.[Destination] AS N'Điểm đến',
        FORMAT(b.[DepartureTime], 'dd/MM/yyyy HH:mm') AS N'Giờ khởi hành',
        FORMAT(b.[ReturnTime], 'dd/MM/yyyy HH:mm') AS N'Giờ về',
        CAST(b.[PassengerCount] AS NVARCHAR) AS N'Số người',
        b.[Attendees] AS N'Người tham gia đi cùng',
        b.[AttendeesEmail] AS N'Email người tham gia',
        b.[Priority] AS N'Độ ưu tiên',
        b.[Purpose] AS N'Mục đích',
        b.[Status] AS N'Trạng thái',
        ISNULL(v.[PlateNumber] + ' - ' + v.[Brand], '') AS N'Xe phân công',
        ISNULL(d.[FullName], '') AS N'Tài xế',
        ISNULL(d.[Phone], '') AS N'SĐT tài xế',
        b.[ApprovedBy] AS N'Người duyệt',
        FORMAT(b.[ApprovedAt], 'dd/MM/yyyy HH:mm') AS N'Thời gian duyệt',
        ISNULL(b.[RejectedReason], '') AS N'Lý do từ chối',
        ISNULL(b.[Notes], '') AS N'Ghi chú'
    FROM [dbo].[Fleet_Bookings] b
    LEFT JOIN [dbo].[Fleet_Vehicles] v ON v.[Id] = b.[VehicleId]
    LEFT JOIN [dbo].[Fleet_Drivers]  d ON d.[Id] = b.[DriverId]
    WHERE
        (@Status IS NULL OR b.[Status] = @Status)
        AND (@RequesterMNV IS NULL OR b.[RequesterMNV] = @RequesterMNV)
        AND (@DateFrom IS NULL OR CAST(b.[DepartureTime] AS DATE) >= @DateFrom)
        AND (@DateTo   IS NULL OR CAST(b.[DepartureTime] AS DATE) <= @DateTo)
    ORDER BY b.[CreatedAt] DESC;
END
GO

PRINT 'Migration 80: Hoan thanh. Da cap nhat table schema va stored procedures cho Fleet Bookings.';
GO
