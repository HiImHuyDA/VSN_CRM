-- ============================================================
-- 24_alter_usp_SyncEmployees.sql
-- ============================================================
USE CSR_DB;
GO

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
            [MNV]      NVARCHAR(50),
            [Department] NVARCHAR(200)
        );

        INSERT INTO @NewData ([FullName], [Email], [MNV], [Department])
        SELECT [FullName], [Email], [MNV], [Department]
        FROM OPENJSON(@EmployeesJson)
        WITH (
            [FullName] NVARCHAR(200) '$.fullName',
            [Email]    NVARCHAR(200) '$.email',
            [MNV]      NVARCHAR(50)  '$.mnv',
            [Department] NVARCHAR(200) '$.department'
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
                [Department]     = source.[Department],
                [IsActive]       = 1,
                [FileModifiedAt] = @FileModifiedAt,
                [SyncedAt]       = GETDATE()
        WHEN NOT MATCHED THEN
            INSERT ([FullName], [Email], [MNV], [Department], [IsActive], [FileModifiedAt], [SyncedAt])
            VALUES (source.[FullName], source.[Email], source.[MNV], source.[Department],
                    1, @FileModifiedAt, GETDATE());

        DECLARE @Rows INT = @@ROWCOUNT;

        -- KHOÁ TÀI KHOẢN (CSR_Users) CỦA CÁC NHÂN VIÊN ĐÃ NGHỈ VIỆC
        -- (Không có trong file Excel lần này)
        -- Ngoại trừ Admin, BOD, PRD
        UPDATE U
        SET U.[IsActive] = 0, U.[UpdatedAt] = GETDATE()
        FROM [dbo].[CSR_Users] U
        WHERE U.[Role] NOT IN ('Admin', 'BOD', 'PRD')
          AND U.[MNV] NOT IN (SELECT [MNV] FROM @NewData);

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
