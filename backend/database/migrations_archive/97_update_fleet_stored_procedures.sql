-- Migration 97: Update Fleet Stored Procedures for BookingsDetailed structure
USE CSR_DB;
GO

-- =========================================================================
-- 1. Create Stored Procedure
-- =========================================================================
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
        IF @VehicleId IS NOT NULL
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

-- =========================================================================
-- 2. Update Stored Procedure (Edit replacement flow)
-- =========================================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_Booking_Update]
    @Id              INT,
    -- Master fields
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
        -- Get old BookingCode
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
        IF @VehicleId IS NOT NULL
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

-- =========================================================================
-- 3. Detail Stored Procedure (dual recordset structure)
-- =========================================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_Booking_GetDetail]
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @BookingCode NVARCHAR(30);
    SELECT @BookingCode = [BookingCode] FROM [dbo].[Fleet_Bookings] WHERE [Id] = @Id;

    -- Recordset 1: Master joined with first leg (-1) for legacy backwards compatibility
    SELECT
        b.[Id], b.[BookingCode], b.[ParentBookingCode], b.[RequesterMNV], b.[RequesterName], b.[RequesterEmail],
        b.[RequesterDept], b.[DepartureTime], b.[ReturnTime], b.[Purpose], b.[Status],
        b.[AssignedNote], b.[ApprovedBy], b.[ApprovedAt],
        b.[RejectedReason], b.[CancelledReason], b.[CompletedAt],
        b.[CreatedAt], b.[UpdatedAt],
        
        -- Joined fields from first leg (-1)
        bd.[PickupLocation], bd.[Destination], bd.[Stops], bd.[PassengerCount], bd.[Priority], bd.[VehicleType],
        bd.[Attendees], bd.[AttendeesEmail], bd.[Notes],
        bd.[VehicleId], v.[PlateNumber] AS VehiclePlate, v.[Brand] AS VehicleBrand,
        v.[Model] AS VehicleModel, v.[Seats] AS VehicleSeats, v.[Color] AS VehicleColor,
        bd.[DriverId], d.[FullName] AS DriverName, d.[Phone] AS DriverPhone,
        d.[LicenseClass] AS DriverLicenseClass
    FROM [dbo].[Fleet_Bookings] b
    LEFT JOIN [dbo].[Fleet_BookingsDetailed] bd ON bd.[BookingCode] = b.[BookingCode] AND bd.[BookingCodeNo] = b.[BookingCode] + '-1'
    LEFT JOIN [dbo].[Fleet_Vehicles] v ON v.[Id] = bd.[VehicleId]
    LEFT JOIN [dbo].[Fleet_Drivers]  d ON d.[Id] = bd.[DriverId]
    WHERE b.[Id] = @Id;

    -- Recordset 2: Detailed legs
    SELECT
        bd.[Id], bd.[BookingCode], bd.[BookingCodeNo],
        bd.[PickupLocation], bd.[Destination], bd.[Stops],
        bd.[PassengerCount], bd.[Priority], bd.[VehicleType],
        bd.[Attendees], bd.[AttendeesEmail], bd.[Notes],
        bd.[VehicleId], v.[PlateNumber] AS VehiclePlate, v.[Brand] AS VehicleBrand,
        v.[Model] AS VehicleModel, v.[Seats] AS VehicleSeats, v.[Color] AS VehicleColor,
        bd.[DriverId], d.[FullName] AS DriverName, d.[Phone] AS DriverPhone,
        d.[LicenseClass] AS DriverLicenseClass,
        bd.[CreatedAt], bd.[UpdatedAt]
    FROM [dbo].[Fleet_BookingsDetailed] bd
    LEFT JOIN [dbo].[Fleet_Vehicles] v ON v.[Id] = bd.[VehicleId]
    LEFT JOIN [dbo].[Fleet_Drivers]  d ON d.[Id] = bd.[DriverId]
    WHERE bd.[BookingCode] = @BookingCode
    ORDER BY bd.[BookingCodeNo] ASC;
END;
GO

-- =========================================================================
-- 4. Dashboard List Stored Procedure
-- =========================================================================
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

    -- Resolve ManagerEmail
    DECLARE @ManagerEmail NVARCHAR(200) = NULL;
    IF @RequesterMNV IS NOT NULL
    BEGIN
        SELECT TOP 1 @ManagerEmail = Email FROM [dbo].[CSR_Employees] WHERE [MNV] = @RequesterMNV;
    END

    -- Count total
    SELECT COUNT(*) AS TotalCount
    FROM [dbo].[Fleet_Bookings] b
    LEFT JOIN [dbo].[Fleet_BookingsDetailed] bd ON bd.[BookingCode] = b.[BookingCode] AND bd.[BookingCodeNo] = b.[BookingCode] + '-1'
    WHERE
        (@SearchText IS NULL OR
            b.[BookingCode] LIKE '%' + @SearchText + '%' OR
            b.[RequesterName] LIKE '%' + @SearchText + '%' OR
            bd.[Destination] LIKE '%' + @SearchText + '%' OR
            bd.[PickupLocation] LIKE '%' + @SearchText + '%'
        )
        AND (@Status IS NULL OR b.[Status] = @Status)
        AND (
            @RequesterMNV IS NULL 
            OR b.[RequesterMNV] = @RequesterMNV 
            OR (@ManagerEmail IS NOT NULL AND b.[RequesterMNV] IN (
                SELECT [MNV] FROM [dbo].[CSR_Employees] WHERE [ManagerEmail] = @ManagerEmail
            ))
        )
        AND (@DateFrom IS NULL OR CAST(b.[DepartureTime] AS DATE) >= @DateFrom)
        AND (@DateTo   IS NULL OR CAST(b.[DepartureTime] AS DATE) <= @DateTo);

    -- Select page rows
    SELECT
        b.[Id], b.[BookingCode], b.[ParentBookingCode], b.[RequesterMNV], b.[RequesterName], b.[RequesterEmail],
        b.[RequesterDept], b.[DepartureTime], b.[ReturnTime], b.[Purpose], b.[Status],
        b.[ApprovedBy], b.[ApprovedAt],
        b.[RejectedReason], b.[CancelledReason],
        b.[CreatedAt], b.[UpdatedAt],
        
        -- Primary details from departure leg (-1)
        bd.[PickupLocation], bd.[Destination], bd.[PassengerCount], bd.[Priority], bd.[VehicleType],
        bd.[Attendees], bd.[AttendeesEmail], bd.[Notes],
        v.[PlateNumber] AS VehiclePlate, v.[Brand] AS VehicleBrand, v.[Model] AS VehicleModel,
        d.[FullName] AS DriverName, d.[Phone] AS DriverPhone
    FROM [dbo].[Fleet_Bookings] b
    LEFT JOIN [dbo].[Fleet_BookingsDetailed] bd ON bd.[BookingCode] = b.[BookingCode] AND bd.[BookingCodeNo] = b.[BookingCode] + '-1'
    LEFT JOIN [dbo].[Fleet_Vehicles] v ON v.[Id] = bd.[VehicleId]
    LEFT JOIN [dbo].[Fleet_Drivers]  d ON d.[Id] = bd.[DriverId]
    WHERE
        (@SearchText IS NULL OR
            b.[BookingCode] LIKE '%' + @SearchText + '%' OR
            b.[RequesterName] LIKE '%' + @SearchText + '%' OR
            bd.[Destination] LIKE '%' + @SearchText + '%' OR
            bd.[PickupLocation] LIKE '%' + @SearchText + '%'
        )
        AND (@Status IS NULL OR b.[Status] = @Status)
        AND (
            @RequesterMNV IS NULL 
            OR b.[RequesterMNV] = @RequesterMNV 
            OR (@ManagerEmail IS NOT NULL AND b.[RequesterMNV] IN (
                SELECT [MNV] FROM [dbo].[CSR_Employees] WHERE [ManagerEmail] = @ManagerEmail
            ))
        )
        AND (@DateFrom IS NULL OR CAST(b.[DepartureTime] AS DATE) >= @DateFrom)
        AND (@DateTo   IS NULL OR CAST(b.[DepartureTime] AS DATE) <= @DateTo)
    ORDER BY b.[CreatedAt] DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END;
GO

-- =========================================================================
-- 5. Status / Approval Update Stored Procedure (with copy history logic)
-- =========================================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_Booking_UpdateStatus]
    @Id                    INT,
    @NewStatus             NVARCHAR(50),
    @ActorName             NVARCHAR(200) = NULL,
    
    -- Departure Leg assignments
    @VehicleId             INT           = NULL,
    @DriverId              INT           = NULL,
    @AssignedNote          NVARCHAR(1000) = NULL,
    
    -- Return Leg assignments
    @ReturnVehicleId       INT           = NULL,
    @ReturnDriverId        INT           = NULL,
    @ReturnAssignedNote    NVARCHAR(1000) = NULL,
    
    -- Other
    @RejectedReason        NVARCHAR(1000) = NULL,
    @CancelledReason       NVARCHAR(1000) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        DECLARE @OldStatus NVARCHAR(50);
        DECLARE @OldCode NVARCHAR(30);
        SELECT @OldStatus = [Status], @OldCode = [BookingCode] FROM [dbo].[Fleet_Bookings] WHERE [Id] = @Id;

        IF @OldStatus IS NULL
            THROW 50001, N'Booking không tồn tại', 1;

        -- Guard state validations
        IF @NewStatus = N'Giám sát đã duyệt' AND @OldStatus <> N'Chờ phản hồi'
            THROW 50002, N'Booking đã được xử lý trước đó, không thể duyệt lại (Giám sát).', 1;
        IF @NewStatus = N'Giám sát từ chối' AND @OldStatus <> N'Chờ phản hồi'
            THROW 50002, N'Booking đã được xử lý trước đó, không thể từ chối lại (Giám sát).', 1;
        IF @NewStatus = N'Team Admin đã duyệt' AND @OldStatus <> N'Giám sát đã duyệt'
            THROW 50002, N'Booking chưa được Giám sát duyệt hoặc đã được xử lý trước đó.', 1;
        IF @NewStatus = N'Team Admin từ chối' AND @OldStatus <> N'Giám sát đã duyệt'
            THROW 50002, N'Booking chưa được Giám sát duyệt hoặc đã được xử lý trước đó.', 1;

        -- Handling cancellation "đẻ ra BookingCode mới"
        IF @NewStatus = N'Đã hủy'
        BEGIN
            -- Generate new BookingCode
            DECLARE @Year CHAR(4) = CAST(YEAR(GETDATE()) AS CHAR(4));
            DECLARE @Seq INT;
            SELECT @Seq = COUNT(*) + 1 FROM [dbo].[Fleet_Bookings] WHERE YEAR([CreatedAt]) = YEAR(GETDATE());
            DECLARE @NewCode NVARCHAR(30) = 'VE-' + @Year + '-' + RIGHT('0000' + CAST(@Seq AS NVARCHAR), 4);

            -- Get details of old booking
            DECLARE @ReqMNV NVARCHAR(50), @ReqName NVARCHAR(200), @ReqEmail NVARCHAR(200), @ReqDept NVARCHAR(200);
            DECLARE @DepTime DATETIME, @RetTime DATETIME, @Purp NVARCHAR(1000);
            SELECT 
                @ReqMNV = [RequesterMNV], @ReqName = [RequesterName], 
                @ReqEmail = [RequesterEmail], @ReqDept = [RequesterDept], @DepTime = [DepartureTime], 
                @RetTime = [ReturnTime], @Purp = [Purpose]
            FROM [dbo].[Fleet_Bookings]
            WHERE [Id] = @Id;

            -- Create new Master Booking with status 'Đã hủy'
            INSERT INTO [dbo].[Fleet_Bookings]
                ([BookingCode], [ParentBookingCode], [RequesterMNV], [RequesterName], [RequesterEmail], [RequesterDept],
                 [DepartureTime], [ReturnTime], [Purpose], [Status], [CancelledReason], [ApprovedBy], [ApprovedAt])
            VALUES
                (@NewCode, @OldCode, @ReqMNV, @ReqName, @ReqEmail, @ReqDept,
                 @DepTime, @RetTime, @Purp, N'Đã hủy', @CancelledReason, @ActorName, GETDATE());

            -- Duplicate legs from old to new BookingCode
            INSERT INTO [dbo].[Fleet_BookingsDetailed]
                ([BookingCode], [BookingCodeNo], [PickupLocation], [Destination], [Stops], [PassengerCount], [Priority],
                 [VehicleId], [DriverId], [Notes], [Attendees], [AttendeesEmail], [VehicleType], [CreatedAt], [UpdatedAt])
            SELECT
                @NewCode,
                REPLACE([BookingCodeNo], @OldCode, @NewCode),
                [PickupLocation], [Destination], [Stops], [PassengerCount], [Priority],
                [VehicleId], [DriverId], [Notes], [Attendees], [AttendeesEmail], [VehicleType], GETDATE(), GETDATE()
            FROM [dbo].[Fleet_BookingsDetailed]
            WHERE [BookingCode] = @OldCode;

            -- Update status of old booking to Đã hủy
            UPDATE [dbo].[Fleet_Bookings]
            SET [Status] = N'Đã hủy', [CancelledReason] = @CancelledReason, [UpdatedAt] = GETDATE()
            WHERE [Id] = @Id;

            COMMIT TRANSACTION;
            
            -- Call GetDetail SP on the new booking to return full result
            EXEC [dbo].[usp_Fleet_Booking_GetDetail] @Id = @Id; -- Return old/updated row or we can execute a simple select for compatibility
            RETURN;
        END

        -- Normal status updates (Approvals / Rejections)
        UPDATE [dbo].[Fleet_Bookings]
        SET
            [Status]          = @NewStatus,
            [UpdatedAt]       = GETDATE(),
            [AssignedNote]    = CASE WHEN @NewStatus = N'Team Admin đã duyệt' THEN @AssignedNote ELSE [AssignedNote] END,
            [ApprovedBy]      = CASE WHEN @NewStatus = N'Team Admin đã duyệt' THEN @ActorName    ELSE [ApprovedBy]   END,
            [ApprovedAt]      = CASE WHEN @NewStatus = N'Team Admin đã duyệt' THEN GETDATE()     ELSE [ApprovedAt]   END,
            [RejectedReason]  = CASE WHEN @NewStatus IN (N'Từ chối', N'Giám sát từ chối', N'Team Admin từ chối') THEN @RejectedReason ELSE [RejectedReason] END,
            [CompletedAt]     = CASE WHEN @NewStatus = N'Hoàn thành' THEN GETDATE()   ELSE [CompletedAt]  END
        WHERE [Id] = @Id;

        -- Update Departure Leg (-1) details
        IF @NewStatus = N'Team Admin đã duyệt'
        BEGIN
            UPDATE [dbo].[Fleet_BookingsDetailed]
            SET
                [VehicleId] = ISNULL(@VehicleId, [VehicleId]),
                [DriverId]  = ISNULL(@DriverId, [DriverId]),
                [Notes]     = @AssignedNote,
                [UpdatedAt] = GETDATE()
            WHERE [BookingCode] = @OldCode AND [BookingCodeNo] = @OldCode + '-1';

            -- Update Return Leg (-2) details if return leg exists
            IF EXISTS (SELECT 1 FROM [dbo].[Fleet_BookingsDetailed] WHERE [BookingCode] = @OldCode AND [BookingCodeNo] = @OldCode + '-2')
            BEGIN
                UPDATE [dbo].[Fleet_BookingsDetailed]
                SET
                    [VehicleId] = ISNULL(@ReturnVehicleId, [VehicleId]),
                    [DriverId]  = ISNULL(@ReturnDriverId, [DriverId]),
                    [Notes]     = @ReturnAssignedNote,
                    [UpdatedAt] = GETDATE()
                WHERE [BookingCode] = @OldCode AND [BookingCodeNo] = @OldCode + '-2';
            END
        END

        COMMIT TRANSACTION;

        -- Return full updated details
        EXEC [dbo].[usp_Fleet_Booking_GetDetail] @Id = @Id;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- =========================================================================
-- 6. Calendar Stored Procedure (leg level scheduling)
-- =========================================================================
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
        b.[Id],
        b.[BookingCode],
        bd.[BookingCodeNo],
        b.[RequesterName],
        b.[RequesterDept],
        bd.[PickupLocation],
        bd.[Destination],
        -- Map dates dynamically based on leg suffix (-1 is DepartureTime, -2 is ReturnTime)
        CASE WHEN bd.[BookingCodeNo] LIKE '%-2' THEN b.[ReturnTime] ELSE b.[DepartureTime] END AS [DepartureTime],
        CASE WHEN bd.[BookingCodeNo] LIKE '%-2' THEN NULL ELSE b.[ReturnTime] END AS [ReturnTime],
        b.[Purpose],
        bd.[PassengerCount],
        bd.[Priority],
        b.[Status],
        bd.[VehicleType],
        bd.[VehicleId],
        v.[PlateNumber] AS VehiclePlate, v.[Brand] AS VehicleBrand,
        v.[Model] AS VehicleModel, v.[Seats] AS VehicleSeats,
        v.[TypeId],
        vt.[TypeName] AS VehicleTypeName,
        bd.[DriverId],
        d.[FullName] AS DriverName, d.[Phone] AS DriverPhone,
        b.[AssignedNote],
        bd.[Notes],
        bd.[Attendees]
    FROM [dbo].[Fleet_BookingsDetailed] bd
    JOIN [dbo].[Fleet_Bookings] b ON b.[BookingCode] = bd.[BookingCode]
    LEFT JOIN [dbo].[Fleet_Vehicles]     v  ON v.[Id] = bd.[VehicleId]
    LEFT JOIN [dbo].[Fleet_VehicleTypes] vt ON vt.[Id] = v.[TypeId]
    LEFT JOIN [dbo].[Fleet_Drivers]      d  ON d.[Id] = bd.[DriverId]
    WHERE
        -- Date ranges checking based on dynamic leg dates
        CAST(CASE WHEN bd.[BookingCodeNo] LIKE '%-2' THEN b.[ReturnTime] ELSE b.[DepartureTime] END AS DATE) <= @DateTo
        AND CAST(CASE WHEN bd.[BookingCodeNo] LIKE '%-2' THEN b.[ReturnTime] ELSE b.[DepartureTime] END AS DATE) >= @DateFrom
        AND (@VehicleId IS NULL OR bd.[VehicleId] = @VehicleId)
        AND (@DriverId IS NULL OR bd.[DriverId] = @DriverId)
        AND (@Status IS NULL OR b.[Status] = @Status)
        AND b.[Status] NOT IN (N'Đã hủy', N'Từ chối', N'Giám sát từ chối', N'Team Admin từ chối')
    ORDER BY CASE WHEN bd.[BookingCodeNo] LIKE '%-2' THEN b.[ReturnTime] ELSE b.[DepartureTime] END ASC;
END;
GO

PRINT 'Migration 97 completed successfully: refactored all Fleet stored procedures.';
GO
