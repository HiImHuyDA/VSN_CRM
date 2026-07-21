-- ============================================================
-- 06_update_employees_table.sql
-- Thêm cột FileModifiedAt và SyncedAt vào CSR_Employees
-- để track khi nào file Excel thay đổi → cần sync lại
-- ============================================================
USE CSR_DB;
GO

-- Thêm cột FileModifiedAt: thời điểm file Excel được sửa lần cuối
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.CSR_Employees')
      AND name = 'FileModifiedAt'
)
BEGIN
    ALTER TABLE [dbo].[CSR_Employees]
    ADD [FileModifiedAt] DATETIME NULL;
    PRINT 'Added column: FileModifiedAt';
END
GO

-- Thêm cột SyncedAt: thời điểm chạy sync lần gần nhất
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.CSR_Employees')
      AND name = 'SyncedAt'
)
BEGIN
    ALTER TABLE [dbo].[CSR_Employees]
    ADD [SyncedAt] DATETIME NULL DEFAULT GETDATE();
    PRINT 'Added column: SyncedAt';
END
GO

-- Tạo bảng CSR_SyncLog để ghi lịch sử đồng bộ
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'CSR_SyncLog' AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[CSR_SyncLog] (
        [Id]              INT IDENTITY(1,1) PRIMARY KEY,
        [SyncType]        NVARCHAR(50)    NOT NULL,   -- 'employees', 'suppliers'
        [Status]          NVARCHAR(20)    NOT NULL,   -- 'success', 'error'
        [RowsAffected]    INT             NULL,
        [FileModifiedAt]  DATETIME        NULL,       -- Thời điểm file Excel được sửa
        [Message]         NVARCHAR(500)   NULL,
        [CreatedAt]       DATETIME        NOT NULL DEFAULT GETDATE()
    );
    PRINT 'Created table: CSR_SyncLog';
END
GO

-- Stored Procedure: Upsert nhân viên (dùng cho Python sync script)
-- Python truyền JSON danh sách nhân viên + fileModifiedAt
CREATE OR ALTER PROCEDURE [dbo].[usp_SyncEmployees]
    @EmployeesJson  NVARCHAR(MAX),
    @FileModifiedAt DATETIME
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        -- Tạo bảng tạm từ JSON
        DECLARE @NewData TABLE (
            [FullName] NVARCHAR(200),
            [Email]    NVARCHAR(200),
            [MNV]      NVARCHAR(50)
        );

        INSERT INTO @NewData ([FullName], [Email], [MNV])
        SELECT [FullName], [Email], [MNV]
        FROM OPENJSON(@EmployeesJson)
        WITH (
            [FullName] NVARCHAR(200) '$.fullName',
            [Email]    NVARCHAR(200) '$.email',
            [MNV]      NVARCHAR(50)  '$.mnv'
        );

        -- Đánh dấu tất cả inactive trước
        UPDATE [dbo].[CSR_Employees] SET [IsActive] = 0;

        -- Upsert: cập nhật nếu đã có (theo Email), thêm mới nếu chưa có
        MERGE [dbo].[CSR_Employees] AS target
        USING @NewData AS source ON target.[Email] = source.[Email]
        WHEN MATCHED THEN
            UPDATE SET
                [FullName]       = source.[FullName],
                [MNV]            = source.[MNV],
                [IsActive]       = 1,
                [FileModifiedAt] = @FileModifiedAt,
                [SyncedAt]       = GETDATE()
        WHEN NOT MATCHED THEN
            INSERT ([FullName], [Email], [MNV], [IsActive], [FileModifiedAt], [SyncedAt])
            VALUES (source.[FullName], source.[Email], source.[MNV],
                    1, @FileModifiedAt, GETDATE());

        DECLARE @Rows INT = @@ROWCOUNT;

        -- Ghi log
        INSERT INTO [dbo].[CSR_SyncLog] ([SyncType], [Status], [RowsAffected], [FileModifiedAt], [Message])
        VALUES ('employees', 'success', @Rows, @FileModifiedAt,
                CAST(@Rows AS NVARCHAR) + N' nhân viên đã được đồng bộ');

        COMMIT TRANSACTION;

        -- Trả về kết quả
        SELECT @Rows AS [RowsAffected], @FileModifiedAt AS [FileModifiedAt],
               N'Đồng bộ thành công' AS [Message];

    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        DECLARE @Err NVARCHAR(500) = ERROR_MESSAGE();
        INSERT INTO [dbo].[CSR_SyncLog] ([SyncType], [Status], [Message])
        VALUES ('employees', 'error', @Err);
        RAISERROR(@Err, 16, 1);
    END CATCH
END
GO

-- SP: Lấy thông tin sync gần nhất (để FE hiển thị trạng thái)
CREATE OR ALTER PROCEDURE [dbo].[usp_GetSyncStatus]
AS
BEGIN
    SET NOCOUNT ON;

    -- Số nhân viên hiện có
    DECLARE @EmpCount INT;
    SELECT @EmpCount = COUNT(*) FROM [dbo].[CSR_Employees] WHERE [IsActive] = 1;

    -- Lần sync gần nhất
    SELECT TOP 1
        @EmpCount                   AS [EmployeeCount],
        [RowsAffected],
        [FileModifiedAt],
        [Message],
        [CreatedAt]                 AS [LastSyncAt],
        [Status]
    FROM [dbo].[CSR_SyncLog]
    WHERE [SyncType] = 'employees'
    ORDER BY [CreatedAt] DESC;
END
GO

PRINT '=== Employee sync infrastructure ready ===';
GO
