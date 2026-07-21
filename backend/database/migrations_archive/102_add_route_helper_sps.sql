-- 102_add_route_helper_sps.sql — Add helper SPs for routes to eliminate inline SQL

-- 1. usp_User_CheckExistsByMNV
CREATE OR ALTER PROCEDURE usp_User_CheckExistsByMNV
    @MNV NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT UserId FROM [dbo].[CSR_Users] WHERE MNV = @MNV;
END
GO

-- 2. usp_Location_CheckExistsByName
CREATE OR ALTER PROCEDURE usp_Location_CheckExistsByName
    @Name NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT Id FROM [dbo].[CSR_Locations] WHERE [Name] = @Name;
END
GO

-- 3. usp_TaskConfig_CheckExists
CREATE OR ALTER PROCEDURE usp_TaskConfig_CheckExists
    @Destination NVARCHAR(200),
    @TaskName NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT Id FROM [dbo].[CSR_TaskConfig] WHERE [Destination] = @Destination AND [TaskName] = @TaskName;
END
GO

-- 4. usp_ConfigList_CheckExists
CREATE OR ALTER PROCEDURE usp_ConfigList_CheckExists
    @Category NVARCHAR(50),
    @Name NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT Id FROM [dbo].[CSR_ConfigLists] WHERE [Category] = @Category AND [Name] = @Name;
END
GO

-- 5. usp_Employee_GetEmailByMNV
CREATE OR ALTER PROCEDURE usp_Employee_GetEmailByMNV
    @MNV NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT Email, FullName, Department FROM [dbo].[CSR_Employees] WHERE MNV = @MNV;
END
GO

-- 6. usp_Employee_CheckIsManager
CREATE OR ALTER PROCEDURE usp_Employee_CheckIsManager
    @CreatorMNV NVARCHAR(50),
    @ManagerEmail NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 1 AS IsManager FROM [dbo].[CSR_Employees] WHERE MNV = @CreatorMNV AND ManagerEmail = @ManagerEmail;
END
GO

-- 7. usp_ApprovalLog_GetLastCancelReason
CREATE OR ALTER PROCEDURE usp_ApprovalLog_GetLastCancelReason
    @ProjectId NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP 1 Reason FROM [dbo].[CSR_ApprovalLogs] WHERE ProjectId = @ProjectId AND Action = 'Cancel' ORDER BY CreatedAt DESC;
END
GO

-- 8. usp_User_GetByMNV
CREATE OR ALTER PROCEDURE usp_User_GetByMNV
    @MNV NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT FullName, Email, Role, Department FROM [dbo].[CSR_Users] WHERE MNV = @MNV;
END
GO

-- 9. usp_LocationMaster_Search
CREATE OR ALTER PROCEDURE usp_LocationMaster_Search
    @SearchText NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT DisplayName, Latitude, Longitude, Source FROM [dbo].[LocationMaster] WHERE AddressQuery LIKE '%' + @SearchText + '%';
END
GO

-- 10. usp_LocationMaster_GetByQuery
CREATE OR ALTER PROCEDURE usp_LocationMaster_GetByQuery
    @Query NVARCHAR(500)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT Id, DisplayName, Latitude, Longitude, Source FROM [dbo].[LocationMaster] WHERE AddressQuery = @Query;
END
GO

-- 11. usp_LocationMaster_Upsert
CREATE OR ALTER PROCEDURE usp_LocationMaster_Upsert
    @AddressQuery NVARCHAR(500),
    @DisplayName NVARCHAR(500),
    @Latitude FLOAT,
    @Longitude FLOAT,
    @Source NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM [dbo].[LocationMaster] WHERE AddressQuery = @AddressQuery)
    BEGIN
        UPDATE [dbo].[LocationMaster]
        SET DisplayName = @DisplayName, Latitude = @Latitude, Longitude = @Longitude, Source = @Source
        WHERE AddressQuery = @AddressQuery;
    END
    ELSE
    BEGIN
        INSERT INTO [dbo].[LocationMaster] (AddressQuery, DisplayName, Latitude, Longitude, Source)
        VALUES (@AddressQuery, @DisplayName, @Latitude, @Longitude, @Source);
    END
END
GO
