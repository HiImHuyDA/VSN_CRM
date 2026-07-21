USE CSR_DB;
GO

-- =========================================================================
-- 1. Update stored procedure: usp_Submission_List
-- =========================================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_Submission_List]
    @SearchText     NVARCHAR(200)   = '',
    @Status         NVARCHAR(50)    = '',
    @ActorRole      NVARCHAR(50)    = '',
    @ActorMNV       NVARCHAR(50)    = '',
    @PageNumber     INT             = 1,
    @PageSize       INT             = 20,
    @Tab            NVARCHAR(50)    = 'tracking'
AS
BEGIN
    SET NOCOUNT ON;

    -- Resolve ManagerEmail
    DECLARE @ManagerEmail NVARCHAR(200) = NULL;
    SELECT TOP 1 @ManagerEmail = Email FROM [dbo].[CSR_Employees] WHERE [MNV] = @ActorMNV;

    -- Auto complete eligible guest submissions
    UPDATE p
    SET p.[StatusId] = 7, p.[UpdatedAt] = GETDATE()
    FROM [dbo].[CSR_Projects] p
    WHERE p.[StatusId] = 5
      AND p.[RecordType] IN (1, 2)
      AND NOT EXISTS (
          SELECT 1 
          FROM [dbo].[CSR_Tasks] t
          WHERE t.[Project_id] = p.[Project_id]
            AND t.[StatusId] = 1
            AND t.[OnboardDate] >= CAST(GETDATE() AS DATE)
      )
      AND EXISTS (
          SELECT 1 
          FROM [dbo].[CSR_Tasks] t
          WHERE t.[Project_id] = p.[Project_id]
            AND t.[StatusId] = 1
      );

    WITH LatestVersions AS (
        SELECT 
            [Project_id], 
            ROW_NUMBER() OVER (PARTITION BY [ParentId] ORDER BY [Version] DESC) as rn,
            MIN([CreatedAt]) OVER (PARTITION BY [ParentId]) as OriginalCreatedAt
        FROM [dbo].[vw_SubmissionSummary]
    )
    SELECT
        v.[Project_id], v.[ParentId], v.[RecordType], v.[Version], v.[SubmitDate], v.[CustomerType], v.[CustomerName],
        v.[SubmitterName], v.[MeetingTopic], v.[Status],
        lv.OriginalCreatedAt AS [CreatedAt],
        CASE 
            WHEN v.[RecordType] = 1 THEN v.[UpdatedAt]
            ELSE v.[CreatedAt] 
        END AS [UpdatedAt],
        v.[TotalDays], v.[OnboardDates], v.[Destinations], v.[TotalTasks], v.[UrgentTasks]
    FROM [dbo].[vw_SubmissionSummary] v
    INNER JOIN LatestVersions lv ON v.[Project_id] = lv.[Project_id] AND lv.rn = 1
    WHERE
        (
            -- User: only see own submissions or their managed employees' submissions
            (@ActorRole = 'User' AND (
                v.[SubmitterMNV] = @ActorMNV
                OR (@ManagerEmail IS NOT NULL AND v.[SubmitterEmail] IN (
                    SELECT Email FROM [dbo].[CSR_Employees] WHERE ManagerEmail = @ManagerEmail
                ))
            ))
            -- Other roles: see all
            OR (@ActorRole != 'User')
        )
        AND (@SearchText = '' OR [CustomerName] LIKE '%' + @SearchText + '%'
                         OR [SubmitterName] LIKE '%' + @SearchText + '%'
                         OR v.[Project_id]   LIKE '%' + @SearchText + '%')
        AND (@Status = '' OR [Status] = @Status)
        AND (
            -- Tab Theo dõi yêu cầu
            (@Tab = 'tracking' AND (
                (@ActorRole = 'BOD' AND [Status] = N'PRD đã duyệt')
                OR (@ActorRole != 'BOD' AND [Status] IN (N'Chờ phản hồi', N'PRD đã duyệt'))
            ))
            -- Tab Tra cứu yêu cầu
            OR (ISNULL(@Tab, '') != 'tracking' AND (
                -- Admin/PRD/TeamAdmin: see all
                (@ActorRole NOT IN ('BOD', 'User'))
                -- BOD: see own creations or those waiting/approved/rejected by BOD
                OR (@ActorRole = 'BOD' AND (
                    v.[SubmitterMNV] = @ActorMNV
                    OR [Status] IN (N'PRD đã duyệt', N'BOD đã duyệt', N'BOD từ chối', N'Hoàn thành')
                ))
                -- User: see own or managed employees'
                OR (@ActorRole = 'User' AND (
                    v.[SubmitterMNV] = @ActorMNV
                    OR (@ManagerEmail IS NOT NULL AND v.[SubmitterEmail] IN (
                        SELECT Email FROM [dbo].[CSR_Employees] WHERE ManagerEmail = @ManagerEmail
                    ))
                ))
            ))
        )
    ORDER BY lv.OriginalCreatedAt DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;

    -- Record count
    WITH LatestVersions AS (
        SELECT [Project_id], ROW_NUMBER() OVER (PARTITION BY [ParentId] ORDER BY [Version] DESC) as rn
        FROM [dbo].[vw_SubmissionSummary]
    )
    SELECT COUNT(*) AS [TotalCount]
    FROM [dbo].[vw_SubmissionSummary] v
    INNER JOIN LatestVersions lv ON v.[Project_id] = lv.[Project_id] AND lv.rn = 1
    WHERE
        (
            (@ActorRole = 'User' AND (
                v.[SubmitterMNV] = @ActorMNV
                OR (@ManagerEmail IS NOT NULL AND v.[SubmitterEmail] IN (
                    SELECT Email FROM [dbo].[CSR_Employees] WHERE ManagerEmail = @ManagerEmail
                ))
            ))
            OR (@ActorRole != 'User')
        )
        AND (@SearchText = '' OR [CustomerName] LIKE '%' + @SearchText + '%'
                         OR [SubmitterName] LIKE '%' + @SearchText + '%'
                         OR v.[Project_id]   LIKE '%' + @SearchText + '%')
        AND (@Status = '' OR [Status] = @Status)
        AND (
            (@Tab = 'tracking' AND (
                (@ActorRole = 'BOD' AND [Status] = N'PRD đã duyệt')
                OR (@ActorRole != 'BOD' AND [Status] IN (N'Chờ phản hồi', N'PRD đã duyệt'))
            ))
            OR (ISNULL(@Tab, '') != 'tracking' AND (
                (@ActorRole NOT IN ('BOD', 'User'))
                OR (@ActorRole = 'BOD' AND (
                    v.[SubmitterMNV] = @ActorMNV
                    OR [Status] IN (N'PRD đã duyệt', N'BOD đã duyệt', N'BOD từ chối', N'Hoàn thành')
                ))
                OR (@ActorRole = 'User' AND (
                    v.[SubmitterMNV] = @ActorMNV
                    OR (@ManagerEmail IS NOT NULL AND v.[SubmitterEmail] IN (
                        SELECT Email FROM [dbo].[CSR_Employees] WHERE ManagerEmail = @ManagerEmail
                    ))
                ))
            ))
        );
END;
GO

-- =========================================================================
-- 2. Update stored procedure: usp_Fleet_Booking_List
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
        AND (
            @RequesterMNV IS NULL 
            OR b.[RequesterMNV] = @RequesterMNV 
            OR (@ManagerEmail IS NOT NULL AND b.[RequesterMNV] IN (
                SELECT [MNV] FROM [dbo].[CSR_Employees] WHERE [ManagerEmail] = @ManagerEmail
            ))
        )
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

PRINT 'Migration 89 completed successfully: updated usp_Submission_List and usp_Fleet_Booking_List stored procedures.';
GO
