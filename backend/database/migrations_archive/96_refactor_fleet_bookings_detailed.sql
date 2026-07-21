-- Migration 96: Refactor Fleet_Bookings and create Fleet_BookingsDetailed table
USE CSR_DB;
GO

-- 1. Create Fleet_BookingsDetailed table if it doesn't exist
IF OBJECT_ID('dbo.Fleet_BookingsDetailed', 'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Fleet_BookingsDetailed] (
        [Id]             INT IDENTITY(1,1) PRIMARY KEY,
        [BookingCode]    NVARCHAR(30)   NOT NULL,
        [BookingCodeNo]  NVARCHAR(40)   NOT NULL UNIQUE, -- Suffix '-1', '-2'
        [PickupLocation] NVARCHAR(500)  NOT NULL,
        [Destination]    NVARCHAR(500)  NOT NULL,
        [Stops]          NVARCHAR(MAX)  NULL,            -- JSON array
        [PassengerCount] INT            NOT NULL DEFAULT 1,
        [Priority]       NVARCHAR(20)   NOT NULL DEFAULT N'Bình thường',
        [VehicleId]      INT            NULL FOREIGN KEY REFERENCES [dbo].[Fleet_Vehicles]([Id]),
        [DriverId]       INT            NULL FOREIGN KEY REFERENCES [dbo].[Fleet_Drivers]([Id]),
        [Notes]          NVARCHAR(1000) NULL,
        [Attendees]      NVARCHAR(MAX)  NULL,
        [AttendeesEmail] NVARCHAR(MAX)  NULL,
        [VehicleType]    NVARCHAR(100)  NULL DEFAULT N'Xe công ty',
        [CreatedAt]      DATETIME       NOT NULL DEFAULT GETDATE(),
        [UpdatedAt]      DATETIME       NOT NULL DEFAULT GETDATE()
    );
    PRINT 'Created Fleet_BookingsDetailed';
END
GO

-- 2. Migrate data from Fleet_Bookings to Fleet_BookingsDetailed if detailed is empty
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Fleet_Bookings') 
   AND NOT EXISTS (SELECT 1 FROM [dbo].[Fleet_BookingsDetailed])
BEGIN
    -- A. Insert departure leg (-1)
    INSERT INTO [dbo].[Fleet_BookingsDetailed]
        ([BookingCode], [BookingCodeNo], [PickupLocation], [Destination], [Stops],
         [PassengerCount], [Priority], [VehicleId], [DriverId], [Notes],
         [Attendees], [AttendeesEmail], [VehicleType], [CreatedAt], [UpdatedAt])
    SELECT
        [BookingCode],
        [BookingCode] + '-1',
        [PickupLocation],
        [Destination],
        [Stops],
        [PassengerCount],
        [Priority],
        [VehicleId],
        [DriverId],
        CASE WHEN [Notes] LIKE '{%' THEN ISNULL(JSON_VALUE([Notes], '$.userNotes'), [Notes]) ELSE [Notes] END,
        [Attendees],
        [AttendeesEmail],
        [VehicleType],
        [CreatedAt],
        [UpdatedAt]
    FROM [dbo].[Fleet_Bookings];

    -- B. Insert return leg (-2) for round trips
    INSERT INTO [dbo].[Fleet_BookingsDetailed]
        ([BookingCode], [BookingCodeNo], [PickupLocation], [Destination], [Stops],
         [PassengerCount], [Priority], [VehicleId], [DriverId], [Notes],
         [Attendees], [AttendeesEmail], [VehicleType], [CreatedAt], [UpdatedAt])
    SELECT
        [BookingCode],
        [BookingCode] + '-2',
        [Destination],
        [PickupLocation],
        CASE WHEN [Notes] LIKE '{%' THEN JSON_VALUE([Notes], '$.returnStops') ELSE NULL END,
        CASE WHEN [Notes] LIKE '{%' THEN ISNULL(TRY_CAST(JSON_VALUE([Notes], '$.returnPassengerCount') AS INT), [PassengerCount]) ELSE [PassengerCount] END,
        CASE WHEN [Notes] LIKE '{%' THEN ISNULL(JSON_VALUE([Notes], '$.returnPriority'), [Priority]) ELSE [Priority] END,
        CASE WHEN [Notes] LIKE '{%' THEN TRY_CAST(JSON_VALUE([Notes], '$.returnVehicleId') AS INT) ELSE NULL END,
        CASE WHEN [Notes] LIKE '{%' THEN TRY_CAST(JSON_VALUE([Notes], '$.returnDriverId') AS INT) ELSE NULL END,
        CASE WHEN [Notes] LIKE '{%' THEN JSON_VALUE([Notes], '$.returnAssignedNote') ELSE NULL END,
        CASE WHEN [Notes] LIKE '{%' THEN ISNULL(JSON_VALUE([Notes], '$.returnAttendees'), [Attendees]) ELSE [Attendees] END,
        CASE WHEN [Notes] LIKE '{%' THEN ISNULL(JSON_VALUE([Notes], '$.returnAttendeesEmail'), [AttendeesEmail]) ELSE [AttendeesEmail] END,
        CASE WHEN [Notes] LIKE '{%' THEN ISNULL(JSON_VALUE([Notes], '$.returnVehicleType'), [VehicleType]) ELSE [VehicleType] END,
        [CreatedAt],
        [UpdatedAt]
    FROM [dbo].[Fleet_Bookings]
    WHERE [ReturnTime] IS NOT NULL;

    PRINT 'Successfully migrated data to Fleet_BookingsDetailed';
END
GO

-- 3. Add ParentBookingCode column to Fleet_Bookings
IF COL_LENGTH('dbo.Fleet_Bookings', 'ParentBookingCode') IS NULL
BEGIN
    ALTER TABLE [dbo].[Fleet_Bookings] ADD [ParentBookingCode] NVARCHAR(30) NULL;
    PRINT 'Added column ParentBookingCode to Fleet_Bookings';
END
GO

-- 4. Drop old foreign keys and default constraints from Fleet_Bookings
DECLARE @sql NVARCHAR(MAX) = '';
SELECT @sql = @sql + 'ALTER TABLE [dbo].[Fleet_Bookings] DROP CONSTRAINT ' + name + ';'
FROM sys.foreign_keys
WHERE parent_object_id = OBJECT_ID('dbo.Fleet_Bookings')
  AND referenced_object_id IN (OBJECT_ID('dbo.Fleet_Vehicles'), OBJECT_ID('dbo.Fleet_Drivers'));

IF @sql <> ''
BEGIN
    EXEC sp_executesql @sql;
    PRINT 'Dropped reference foreign key constraints from Fleet_Bookings';
END
GO

DECLARE @drop_defaults NVARCHAR(MAX) = '';
SELECT @drop_defaults = @drop_defaults + 'ALTER TABLE [dbo].[Fleet_Bookings] DROP CONSTRAINT ' + d.name + ';'
FROM sys.default_constraints d
JOIN sys.columns c ON d.parent_column_id = c.column_id AND d.parent_object_id = c.object_id
WHERE d.parent_object_id = OBJECT_ID('dbo.Fleet_Bookings')
  AND c.name IN ('PickupLocation', 'Destination', 'Stops', 'PassengerCount', 'Priority',
                 'VehicleId', 'DriverId', 'Attendees', 'AttendeesEmail', 'VehicleType');

IF @drop_defaults <> ''
BEGIN
    EXEC sp_executesql @drop_defaults;
    PRINT 'Dropped default constraints from Fleet_Bookings';
END
GO

-- 5. Drop deprecated columns
IF COL_LENGTH('dbo.Fleet_Bookings', 'PickupLocation') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[Fleet_Bookings] DROP COLUMN
        [PickupLocation], [Destination], [Stops], [PassengerCount], [Priority],
        [VehicleId], [DriverId], [Attendees], [AttendeesEmail], [VehicleType];
    PRINT 'Dropped old deprecated columns from Fleet_Bookings';
END
GO
