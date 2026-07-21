-- Migration 81: Create LocationMaster for address caching
USE CSR_DB;
GO

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'LocationMaster' AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[LocationMaster] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [AddressQuery] NVARCHAR(500) NOT NULL UNIQUE,
        [DisplayName] NVARCHAR(500) NOT NULL,
        [Latitude] DECIMAL(12, 9) NULL,
        [Longitude] DECIMAL(12, 9) NULL,
        [Source] NVARCHAR(50) DEFAULT 'Google',
        [SearchCount] INT DEFAULT 1,
        [CreatedAt] DATETIME DEFAULT GETDATE(),
        [UpdatedAt] DATETIME DEFAULT GETDATE()
    );
    
    -- Create index for speed
    CREATE INDEX IX_LocationMaster_Query ON [dbo].[LocationMaster]([AddressQuery]);
    PRINT 'Da tao bang LocationMaster va index.';
END
GO

-- Copy existing system locations from CSR_Locations if they are not already cached
INSERT INTO [dbo].[LocationMaster] ([AddressQuery], [DisplayName], [Latitude], [Longitude], [Source])
SELECT 
    LOWER(RTRIM(LTRIM([Name]))), 
    [Name], 
    10.7769, -- Default to HCMC Lat
    106.7009, -- Default to HCMC Lng
    'System'
FROM [dbo].[CSR_Locations] l
WHERE l.[StatusId] = 1
  AND LOWER(RTRIM(LTRIM(l.[Name]))) NOT IN (SELECT [AddressQuery] FROM [dbo].[LocationMaster]);
GO

PRINT 'Migration 81: Hoan thanh.';
GO
