USE CSR_DB;
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CSR_Notifications]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[CSR_Notifications] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [Message] NVARCHAR(MAX) NOT NULL,
        [ActorMNV] NVARCHAR(50) NOT NULL,
        [ProjectId] VARCHAR(50) NULL,
        [CreatedAt] DATETIME DEFAULT GETDATE(),
        [IsRead] BIT DEFAULT 0
    );
END
GO

