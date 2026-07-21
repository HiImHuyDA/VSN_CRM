-- ============================================================
-- Migration 78: Fleet Management Phase 1 — Tables & Stored Procedures
-- Tao cac bang du lieu va stored procedures cho quan ly xe
-- ============================================================
USE CSR_DB;
GO

-- ============================================================
-- SECTION 1: TABLES
-- ============================================================

-- 1. Loai xe (Sedan, Van 7 cho, Bus 16 cho, ...)
IF OBJECT_ID('dbo.Fleet_VehicleTypes', 'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Fleet_VehicleTypes] (
        [Id]          INT IDENTITY(1,1) PRIMARY KEY,
        [TypeName]    NVARCHAR(100) NOT NULL,
        [Description] NVARCHAR(500) NULL,
        [IsActive]    BIT NOT NULL DEFAULT 1,
        [CreatedAt]   DATETIME NOT NULL DEFAULT GETDATE()
    );
    PRINT 'Created Fleet_VehicleTypes';
END
GO

-- 2. Danh sach xe
IF OBJECT_ID('dbo.Fleet_Vehicles', 'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Fleet_Vehicles] (
        [Id]          INT IDENTITY(1,1) PRIMARY KEY,
        [PlateNumber] NVARCHAR(20)  NOT NULL UNIQUE,  -- Bien so xe
        [Brand]       NVARCHAR(100) NOT NULL,           -- Hang xe
        [Model]       NVARCHAR(100) NULL,               -- Model xe
        [TypeId]      INT NULL FOREIGN KEY REFERENCES [dbo].[Fleet_VehicleTypes]([Id]),
        [Seats]       INT NOT NULL DEFAULT 4,           -- So cho ngoi
        [Color]       NVARCHAR(50)  NULL,
        [FuelType]    NVARCHAR(50)  NULL DEFAULT N'Xăng',  -- Xang / Dau / Dien
        [Status]      NVARCHAR(50)  NOT NULL DEFAULT N'Sẵn sàng',  -- San sang / Bao duong / Ngung
        [Notes]       NVARCHAR(1000) NULL,
        [IsActive]    BIT NOT NULL DEFAULT 1,
        [CreatedAt]   DATETIME NOT NULL DEFAULT GETDATE(),
        [UpdatedAt]   DATETIME NOT NULL DEFAULT GETDATE()
    );
    PRINT 'Created Fleet_Vehicles';
END
GO

-- 3. Danh sach tai xe
IF OBJECT_ID('dbo.Fleet_Drivers', 'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Fleet_Drivers] (
        [Id]             INT IDENTITY(1,1) PRIMARY KEY,
        [FullName]       NVARCHAR(200) NOT NULL,
        [Phone]          NVARCHAR(20)  NULL,
        [LicenseNumber]  NVARCHAR(50)  NULL,           -- So bang lai
        [LicenseClass]   NVARCHAR(10)  NULL,           -- Hang bang lai: B1, B2, C, D, ...
        [Status]         NVARCHAR(50)  NOT NULL DEFAULT N'Sẵn sàng',  -- San sang / Nghi / Ngung
        [Notes]          NVARCHAR(1000) NULL,
        [IsActive]       BIT NOT NULL DEFAULT 1,
        [CreatedAt]      DATETIME NOT NULL DEFAULT GETDATE(),
        [UpdatedAt]      DATETIME NOT NULL DEFAULT GETDATE()
    );
    PRINT 'Created Fleet_Drivers';
END
GO

-- 4. Danh sach yeu cau dat xe (Bookings)
IF OBJECT_ID('dbo.Fleet_Bookings', 'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Fleet_Bookings] (
        [Id]               INT IDENTITY(1,1) PRIMARY KEY,
        [BookingCode]      NVARCHAR(30)   NOT NULL UNIQUE,  -- VD: VE-2026-0001
        [RequesterMNV]     NVARCHAR(50)   NULL,
        [RequesterName]    NVARCHAR(200)  NOT NULL,
        [RequesterEmail]   NVARCHAR(200)  NULL,
        [RequesterDept]    NVARCHAR(200)  NULL,
        [PickupLocation]   NVARCHAR(500)  NOT NULL,         -- Diem don
        [Destination]      NVARCHAR(500)  NOT NULL,         -- Diem den chinh
        [Stops]            NVARCHAR(MAX)  NULL,             -- JSON array cac diem dung
        [DepartureTime]    DATETIME       NOT NULL,         -- Thoi gian khoi hanh mong muon
        [ReturnTime]       DATETIME       NULL,             -- Thoi gian ve (neu co)
        [Purpose]          NVARCHAR(1000) NOT NULL,         -- Muc dich chuyen di
        [PassengerCount]   INT NOT NULL DEFAULT 1,
        [Priority]         NVARCHAR(20)   NOT NULL DEFAULT N'Bình thường', -- Binh thuong / Khan / VIP
        [Status]           NVARCHAR(50)   NOT NULL DEFAULT N'Chờ duyệt',
        -- Phan cong xe va tai xe (khi duyet)
        [VehicleId]        INT NULL FOREIGN KEY REFERENCES [dbo].[Fleet_Vehicles]([Id]),
        [DriverId]         INT NULL FOREIGN KEY REFERENCES [dbo].[Fleet_Drivers]([Id]),
        [AssignedNote]     NVARCHAR(1000) NULL,             -- Ghi chu khi phan cong
        -- Thong tin xu ly
        [ApprovedBy]       NVARCHAR(100) NULL,
        [ApprovedAt]       DATETIME NULL,
        [RejectedReason]   NVARCHAR(1000) NULL,
        [CancelledReason]  NVARCHAR(1000) NULL,
        [CompletedAt]      DATETIME NULL,
        [Notes]            NVARCHAR(1000) NULL,
        [CreatedAt]        DATETIME NOT NULL DEFAULT GETDATE(),
        [UpdatedAt]        DATETIME NOT NULL DEFAULT GETDATE()
    );
    -- Index cho cac truong filter pho bien
    CREATE INDEX IX_Fleet_Bookings_Status     ON [dbo].[Fleet_Bookings]([Status]);
    CREATE INDEX IX_Fleet_Bookings_Requester  ON [dbo].[Fleet_Bookings]([RequesterMNV]);
    CREATE INDEX IX_Fleet_Bookings_Departure  ON [dbo].[Fleet_Bookings]([DepartureTime]);
    PRINT 'Created Fleet_Bookings';
END
GO

-- ============================================================
-- SECTION 2: SEED DATA
-- ============================================================

-- Seed loai xe mac dinh
IF NOT EXISTS (SELECT 1 FROM [dbo].[Fleet_VehicleTypes])
BEGIN
    INSERT INTO [dbo].[Fleet_VehicleTypes] ([TypeName], [Description]) VALUES
        (N'Sedan 4 chỗ',   N'Xe con 4 chỗ ngồi'),
        (N'SUV 7 chỗ',     N'Xe 7 chỗ ngồi'),
        (N'Van 9 chỗ',     N'Xe van 9 chỗ ngồi'),
        (N'Bus 16 chỗ',    N'Xe khách 16 chỗ ngồi'),
        (N'Bus 29 chỗ',    N'Xe khách 29 chỗ ngồi'),
        (N'Bus 45 chỗ',    N'Xe khách 45 chỗ ngồi');
    PRINT 'Seeded Fleet_VehicleTypes';
END
GO

-- ============================================================
-- SECTION 3: STORED PROCEDURES
-- ============================================================

-- SP: Lay danh sach loai xe
CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_VehicleType_List]
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [Id], [TypeName], [Description], [IsActive], [CreatedAt]
    FROM [dbo].[Fleet_VehicleTypes]
    ORDER BY [TypeName];
END
GO

-- SP: Luu loai xe (them moi / cap nhat)
CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_VehicleType_Save]
    @Id          INT,
    @TypeName    NVARCHAR(100),
    @Description NVARCHAR(500) = NULL,
    @IsActive    BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    IF @Id = 0
    BEGIN
        INSERT INTO [dbo].[Fleet_VehicleTypes] ([TypeName], [Description], [IsActive])
        VALUES (@TypeName, @Description, @IsActive);
        SELECT SCOPE_IDENTITY() AS Id;
    END
    ELSE
    BEGIN
        UPDATE [dbo].[Fleet_VehicleTypes]
        SET [TypeName] = @TypeName, [Description] = @Description, [IsActive] = @IsActive
        WHERE [Id] = @Id;
        SELECT @Id AS Id;
    END
END
GO

-- SP: Lay danh sach xe
CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_Vehicle_List]
    @IsActive BIT = NULL,
    @Status   NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        v.[Id], v.[PlateNumber], v.[Brand], v.[Model],
        v.[TypeId], t.[TypeName],
        v.[Seats], v.[Color], v.[FuelType],
        v.[Status], v.[Notes], v.[IsActive],
        v.[CreatedAt], v.[UpdatedAt]
    FROM [dbo].[Fleet_Vehicles] v
    LEFT JOIN [dbo].[Fleet_VehicleTypes] t ON t.[Id] = v.[TypeId]
    WHERE (@IsActive IS NULL OR v.[IsActive] = @IsActive)
      AND (@Status   IS NULL OR v.[Status]   = @Status)
    ORDER BY v.[PlateNumber];
END
GO

-- SP: Luu thong tin xe
CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_Vehicle_Save]
    @Id          INT,
    @PlateNumber NVARCHAR(20),
    @Brand       NVARCHAR(100),
    @Model       NVARCHAR(100) = NULL,
    @TypeId      INT = NULL,
    @Seats       INT = 4,
    @Color       NVARCHAR(50) = NULL,
    @FuelType    NVARCHAR(50) = N'Xăng',
    @Status      NVARCHAR(50) = N'Sẵn sàng',
    @Notes       NVARCHAR(1000) = NULL,
    @IsActive    BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    IF @Id = 0
    BEGIN
        INSERT INTO [dbo].[Fleet_Vehicles]
            ([PlateNumber],[Brand],[Model],[TypeId],[Seats],[Color],[FuelType],[Status],[Notes],[IsActive])
        VALUES
            (@PlateNumber,@Brand,@Model,@TypeId,@Seats,@Color,@FuelType,@Status,@Notes,@IsActive);
        SELECT SCOPE_IDENTITY() AS Id;
    END
    ELSE
    BEGIN
        UPDATE [dbo].[Fleet_Vehicles]
        SET [PlateNumber]=@PlateNumber,[Brand]=@Brand,[Model]=@Model,[TypeId]=@TypeId,
            [Seats]=@Seats,[Color]=@Color,[FuelType]=@FuelType,[Status]=@Status,
            [Notes]=@Notes,[IsActive]=@IsActive,[UpdatedAt]=GETDATE()
        WHERE [Id]=@Id;
        SELECT @Id AS Id;
    END
END
GO

-- SP: Lay danh sach tai xe
CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_Driver_List]
    @IsActive BIT = NULL,
    @Status   NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [Id],[FullName],[Phone],[LicenseNumber],[LicenseClass],[Status],[Notes],[IsActive],[CreatedAt],[UpdatedAt]
    FROM [dbo].[Fleet_Drivers]
    WHERE (@IsActive IS NULL OR [IsActive] = @IsActive)
      AND (@Status   IS NULL OR [Status]   = @Status)
    ORDER BY [FullName];
END
GO

-- SP: Luu thong tin tai xe
CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_Driver_Save]
    @Id             INT,
    @FullName       NVARCHAR(200),
    @Phone          NVARCHAR(20)  = NULL,
    @LicenseNumber  NVARCHAR(50)  = NULL,
    @LicenseClass   NVARCHAR(10)  = NULL,
    @Status         NVARCHAR(50)  = N'Sẵn sàng',
    @Notes          NVARCHAR(1000) = NULL,
    @IsActive       BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    IF @Id = 0
    BEGIN
        INSERT INTO [dbo].[Fleet_Drivers] ([FullName],[Phone],[LicenseNumber],[LicenseClass],[Status],[Notes],[IsActive])
        VALUES (@FullName,@Phone,@LicenseNumber,@LicenseClass,@Status,@Notes,@IsActive);
        SELECT SCOPE_IDENTITY() AS Id;
    END
    ELSE
    BEGIN
        UPDATE [dbo].[Fleet_Drivers]
        SET [FullName]=@FullName,[Phone]=@Phone,[LicenseNumber]=@LicenseNumber,
            [LicenseClass]=@LicenseClass,[Status]=@Status,[Notes]=@Notes,
            [IsActive]=@IsActive,[UpdatedAt]=GETDATE()
        WHERE [Id]=@Id;
        SELECT @Id AS Id;
    END
END
GO

-- SP: Tao booking xe moi — sinh BookingCode tu dong
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
    @Notes           NVARCHAR(1000) = NULL
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

        INSERT INTO [dbo].[Fleet_Bookings]
            ([BookingCode],[RequesterMNV],[RequesterName],[RequesterEmail],[RequesterDept],
             [PickupLocation],[Destination],[Stops],[DepartureTime],[ReturnTime],
             [Purpose],[PassengerCount],[Priority],[Notes],[Status])
        VALUES
            (@Code,@RequesterMNV,@RequesterName,@RequesterEmail,@RequesterDept,
             @PickupLocation,@Destination,@Stops,@DepartureTime,@ReturnTime,
             @Purpose,@PassengerCount,@Priority,@Notes,N'Chờ duyệt');

        DECLARE @NewId INT = SCOPE_IDENTITY();
        SELECT @NewId AS Id, @Code AS BookingCode;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO

-- SP: Danh sach booking (co phan trang va bo loc)
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

    -- Tong so ban ghi (de phan trang)
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

    -- Du lieu trang hien tai
    SELECT
        b.[Id], b.[BookingCode], b.[RequesterMNV], b.[RequesterName], b.[RequesterEmail],
        b.[RequesterDept], b.[PickupLocation], b.[Destination],
        b.[DepartureTime], b.[ReturnTime], b.[Purpose],
        b.[PassengerCount], b.[Priority], b.[Status],
        v.[PlateNumber] AS VehiclePlate, v.[Brand] AS VehicleBrand, v.[Model] AS VehicleModel,
        d.[FullName] AS DriverName, d.[Phone] AS DriverPhone,
        b.[ApprovedBy], b.[ApprovedAt],
        b.[RejectedReason], b.[CancelledReason],
        b.[CreatedAt], b.[UpdatedAt]
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
END
GO

-- SP: Lay chi tiet 1 booking
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
        b.[Notes], b.[CreatedAt], b.[UpdatedAt]
    FROM [dbo].[Fleet_Bookings] b
    LEFT JOIN [dbo].[Fleet_Vehicles] v ON v.[Id] = b.[VehicleId]
    LEFT JOIN [dbo].[Fleet_Drivers]  d ON d.[Id] = b.[DriverId]
    WHERE b.[Id] = @Id;
END
GO

-- SP: Cap nhat trang thai booking (Duyet / Tu choi / Huy / Hoan thanh)
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
            [VehicleId]       = CASE WHEN @NewStatus = N'Đã duyệt' THEN ISNULL(@VehicleId, [VehicleId]) ELSE [VehicleId] END,
            [DriverId]        = CASE WHEN @NewStatus = N'Đã duyệt' THEN ISNULL(@DriverId,  [DriverId])  ELSE [DriverId]  END,
            [AssignedNote]    = CASE WHEN @NewStatus = N'Đã duyệt' THEN @AssignedNote ELSE [AssignedNote] END,
            [ApprovedBy]      = CASE WHEN @NewStatus = N'Đã duyệt' THEN @ActorName    ELSE [ApprovedBy]   END,
            [ApprovedAt]      = CASE WHEN @NewStatus = N'Đã duyệt' THEN GETDATE()     ELSE [ApprovedAt]   END,
            [RejectedReason]  = CASE WHEN @NewStatus = N'Từ chối'  THEN @RejectedReason ELSE [RejectedReason] END,
            [CancelledReason] = CASE WHEN @NewStatus = N'Đã hủy'   THEN @CancelledReason ELSE [CancelledReason] END,
            [CompletedAt]     = CASE WHEN @NewStatus = N'Hoàn thành' THEN GETDATE()   ELSE [CompletedAt]  END
        WHERE [Id] = @Id;

        -- Tra ve thong tin day du de gui email
        SELECT
            b.[Id], b.[BookingCode], b.[RequesterName], b.[RequesterEmail],
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

-- SP: Export tat ca booking (khong phan trang, cho Excel export)
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

-- SP: Lay danh sach Admin email de gui thong bao
CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_GetAdminEmails]
AS
BEGIN
    SET NOCOUNT ON;
    SELECT DISTINCT Email
    FROM [dbo].[CSR_Users]
    WHERE [Role] = 'Admin'
      AND [StatusId] = 1
      AND [Email] IS NOT NULL
      AND [Email] <> '';
END
GO

PRINT 'Migration 78: Fleet Management Phase 1 — Hoan thanh. Created 4 tables, seeded vehicle types, created 11 stored procedures.';
GO
