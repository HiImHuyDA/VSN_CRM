-- Migration 85: Fleet Management Batch Import Stored Procedures
-- Add stored procedures for upserting vehicles and drivers from Excel import

USE CSR_DB;
GO

-- 1. SP: Upsert Vehicle by PlateNumber
CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_Vehicle_UpsertByPlate]
    @PlateNumber NVARCHAR(20),
    @Brand       NVARCHAR(100),
    @Model       NVARCHAR(100) = NULL,
    @TypeName    NVARCHAR(100) = NULL,
    @Seats       INT = 4,
    @Color       NVARCHAR(50) = NULL,
    @FuelType    NVARCHAR(50) = N'Xăng',
    @Status      NVARCHAR(50) = N'Sẵn sàng',
    @Notes       NVARCHAR(1000) = NULL,
    @IsActive    BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @TypeId INT = NULL;

    -- Lookup TypeId if TypeName is provided
    IF @TypeName IS NOT NULL AND LTRIM(RTRIM(@TypeName)) <> ''
    BEGIN
        SELECT TOP 1 @TypeId = [Id] FROM [dbo].[Fleet_VehicleTypes] WHERE [TypeName] = LTRIM(RTRIM(@TypeName));
        
        -- If vehicle type doesn't exist, create it automatically
        IF @TypeId IS NULL
        BEGIN
            INSERT INTO [dbo].[Fleet_VehicleTypes] ([TypeName], [Description], [IsActive])
            VALUES (LTRIM(RTRIM(@TypeName)), N'Tự động tạo từ import Excel', 1);
            SET @TypeId = SCOPE_IDENTITY();
        END
    END

    -- Check if PlateNumber already exists
    DECLARE @ExistingId INT = NULL;
    SELECT @ExistingId = [Id] FROM [dbo].[Fleet_Vehicles] WHERE [PlateNumber] = LTRIM(RTRIM(@PlateNumber));

    IF @ExistingId IS NULL
    BEGIN
        INSERT INTO [dbo].[Fleet_Vehicles]
            ([PlateNumber],[Brand],[Model],[TypeId],[Seats],[Color],[FuelType],[Status],[Notes],[IsActive])
        VALUES
            (LTRIM(RTRIM(@PlateNumber)),@Brand,@Model,@TypeId,@Seats,@Color,@FuelType,@Status,@Notes,@IsActive);
        SELECT SCOPE_IDENTITY() AS Id;
    END
    ELSE
    BEGIN
        UPDATE [dbo].[Fleet_Vehicles]
        SET [Brand]=@Brand,[Model]=@Model,[TypeId]=@TypeId,
            [Seats]=@Seats,[Color]=@Color,[FuelType]=@FuelType,[Status]=@Status,
            [Notes]=@Notes,[IsActive]=@IsActive,[UpdatedAt]=GETDATE()
        WHERE [Id]=@ExistingId;
        SELECT @ExistingId AS Id;
    END
END
GO

-- 2. SP: Upsert Driver by Phone or FullName
CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_Driver_Upsert]
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
    DECLARE @ExistingId INT = NULL;

    -- Try to match by Phone first
    IF @Phone IS NOT NULL AND LTRIM(RTRIM(@Phone)) <> ''
    BEGIN
        SELECT TOP 1 @ExistingId = [Id] FROM [dbo].[Fleet_Drivers] WHERE [Phone] = LTRIM(RTRIM(@Phone));
    END

    -- Fallback to match by FullName if not matched by Phone
    IF @ExistingId IS NULL
    BEGIN
        SELECT TOP 1 @ExistingId = [Id] FROM [dbo].[Fleet_Drivers] WHERE [FullName] = LTRIM(RTRIM(@FullName));
    END

    IF @ExistingId IS NULL
    BEGIN
        INSERT INTO [dbo].[Fleet_Drivers] ([FullName],[Phone],[LicenseNumber],[LicenseClass],[Status],[Notes],[IsActive])
        VALUES (LTRIM(RTRIM(@FullName)),@Phone,@LicenseNumber,@LicenseClass,@Status,@Notes,@IsActive);
        SELECT SCOPE_IDENTITY() AS Id;
    END
    ELSE
    BEGIN
        UPDATE [dbo].[Fleet_Drivers]
        SET [FullName]=LTRIM(RTRIM(@FullName)),[Phone]=@Phone,[LicenseNumber]=@LicenseNumber,
            [LicenseClass]=@LicenseClass,[Status]=@Status,[Notes]=@Notes,
            [IsActive]=@IsActive,[UpdatedAt]=GETDATE()
        WHERE [Id]=@ExistingId;
        SELECT @ExistingId AS Id;
    END
END
GO
