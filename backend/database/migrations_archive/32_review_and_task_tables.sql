USE CSR_DB;
GO

-- 1. Bảng CSR_ReviewCriteria (Tiêu chí đánh giá)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CSR_ReviewCriteria]') AND type = N'U')
BEGIN
    CREATE TABLE [dbo].[CSR_ReviewCriteria] (
        [Id]            INT IDENTITY(1,1)   NOT NULL,
        [CriteriaName]  NVARCHAR(200)       NOT NULL,
        [Description]   NVARCHAR(500)       NULL,
        [CriteriaGroup] NVARCHAR(100)       NOT NULL,       -- Ví dụ: Đón tiếp, Ăn uống, Phòng họp, Thái độ...
        [SortOrder]     INT                 NOT NULL DEFAULT 0,
        [IsRequired]    BIT                 NOT NULL DEFAULT 0,
        [IsActive]      BIT                 NOT NULL DEFAULT 1,
        [CreatedAt]     DATETIME            NOT NULL DEFAULT GETDATE(),

        CONSTRAINT [PK_CSR_ReviewCriteria] PRIMARY KEY CLUSTERED ([Id] ASC)
    );
    PRINT 'Created table: CSR_ReviewCriteria';
END
GO

-- 2. Bảng CSR_Reviews (Đánh giá của khách hàng cho đơn tiếp khách)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CSR_Reviews]') AND type = N'U')
BEGIN
    CREATE TABLE [dbo].[CSR_Reviews] (
        [Id]            INT IDENTITY(1,1)   NOT NULL,
        [ProjectId]     NVARCHAR(100)       NOT NULL,
        [CriteriaId]    INT                 NOT NULL,
        [Rating]        INT                 NOT NULL,       -- 1 - 5 sao
        [Comment]       NVARCHAR(MAX)       NULL,
        [ReviewerName]  NVARCHAR(200)       NULL,
        [CreatedAt]     DATETIME            NOT NULL DEFAULT GETDATE(),

        CONSTRAINT [PK_CSR_Reviews] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [FK_CSR_Reviews_Projects] FOREIGN KEY ([ProjectId]) REFERENCES [dbo].[CSR_Projects] ([Project_id]) ON DELETE CASCADE,
        CONSTRAINT [FK_CSR_Reviews_Criteria] FOREIGN KEY ([CriteriaId]) REFERENCES [dbo].[CSR_ReviewCriteria] ([Id])
    );
    PRINT 'Created table: CSR_Reviews';
END
GO

-- 3. Thêm cột TaskStatus vào bảng CSR_Tasks nếu chưa có
IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID('dbo.CSR_Tasks') 
      AND name = 'TaskStatus'
)
BEGIN
    ALTER TABLE [dbo].[CSR_Tasks]
    ADD [TaskStatus] NVARCHAR(50) NOT NULL DEFAULT N'Chưa bắt đầu';
    PRINT 'Added column TaskStatus to CSR_Tasks';
END
GO

-- 4. Bảng CSR_TaskNotes (Ghi chú công việc trong Kanban/Detail)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CSR_TaskNotes]') AND type = N'U')
BEGIN
    CREATE TABLE [dbo].[CSR_TaskNotes] (
        [Id]            INT IDENTITY(1,1)   NOT NULL,
        [TaskId]        NVARCHAR(150)       NOT NULL,
        [Content]       NVARCHAR(MAX)       NOT NULL,
        [AuthorMNV]     NVARCHAR(50)        NULL,
        [AuthorName]    NVARCHAR(200)       NULL,
        [CreatedAt]     DATETIME            NOT NULL DEFAULT GETDATE(),

        CONSTRAINT [PK_CSR_TaskNotes] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [FK_CSR_TaskNotes_Tasks] FOREIGN KEY ([TaskId]) REFERENCES [dbo].[CSR_Tasks] ([Task_id]) ON DELETE CASCADE
    );
    PRINT 'Created table: CSR_TaskNotes';
END
GO

-- 5. Bảng CSR_TaskAttachments (File đính kèm công việc)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CSR_TaskAttachments]') AND type = N'U')
BEGIN
    CREATE TABLE [dbo].[CSR_TaskAttachments] (
        [Id]            INT IDENTITY(1,1)   NOT NULL,
        [TaskId]        NVARCHAR(150)       NOT NULL,
        [FileName]      NVARCHAR(500)       NOT NULL,
        [FilePath]      NVARCHAR(1000)      NOT NULL,
        [FileSize]      BIGINT              NULL,
        [UploadedBy]    NVARCHAR(200)       NULL,
        [CreatedAt]     DATETIME            NOT NULL DEFAULT GETDATE(),

        CONSTRAINT [PK_CSR_TaskAttachments] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [FK_CSR_TaskAttachments_Tasks] FOREIGN KEY ([TaskId]) REFERENCES [dbo].[CSR_Tasks] ([Task_id]) ON DELETE CASCADE
    );
    PRINT 'Created table: CSR_TaskAttachments';
END
GO

-- Seed dữ liệu mẫu cho tiêu chí đánh giá nếu bảng rỗng
IF NOT EXISTS (SELECT 1 FROM [dbo].[CSR_ReviewCriteria])
BEGIN
    INSERT INTO [dbo].[CSR_ReviewCriteria] ([CriteriaName], [Description], [CriteriaGroup], [SortOrder], [IsRequired], [IsActive])
    VALUES 
    (N'Thái độ tiếp đón', N'Thái độ của nhân viên hỗ trợ, nhân sự phụ trách tiếp đón khách', N'Tiếp đón', 1, 1, 1),
    (N'Chất lượng xe đưa đón', N'Sự đúng giờ, sạch sẽ và thái độ của tài xế', N'Di chuyển', 2, 0, 1),
    (N'Phòng họp & Thiết bị', N'Độ sạch sẽ của phòng họp, trà nước, thiết bị âm thanh, máy chiếu', N'Hậu cần', 3, 1, 1),
    (N'Chất lượng bữa ăn', N'Mức độ ngon miệng, phục vụ của nhà hàng', N'Hậu cần', 4, 0, 1),
    (N'Tổng quan chương trình', N'Sự chu đáo, chuyên nghiệp và hiệu quả chung của chương trình đón tiếp', N'Tổng hợp', 5, 1, 1);
    PRINT 'Seed data to CSR_ReviewCriteria';
END
GO
