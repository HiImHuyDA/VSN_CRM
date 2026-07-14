-- Migration 84: Update usp_SyncEmployees output block to include Email inside @MergedOutput
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

        -- Lấy danh sách nhân viên hiện tại đang Active nhưng KHÔNG CÓ trong Excel
        DECLARE @MissingEmployees TABLE (
            [MNV] NVARCHAR(50),
            [FullName] NVARCHAR(200),
            [Department] NVARCHAR(200)
        );
        INSERT INTO @MissingEmployees ([MNV], [FullName], [Department])
        SELECT [MNV], [FullName], [Department]
        FROM [dbo].[CSR_Employees]
        WHERE [StatusId] = 1 -- 1 = Hoạt động
          AND [MNV] NOT IN (SELECT [MNV] FROM @NewData);

        -- Đánh dấu tất cả inactive (StatusId = 2) trước (2 = Dừng)
        UPDATE [dbo].[CSR_Employees] SET [StatusId] = 2;

        -- Dùng OUTPUT để lấy danh sách nhân viên mới (Action = 'INSERT')
        DECLARE @MergedOutput TABLE (
            [ActionType] NVARCHAR(10),
            [MNV] NVARCHAR(50),
            [FullName] NVARCHAR(200),
            [Email]    NVARCHAR(200),
            [Department] NVARCHAR(200)
        );

        -- Upsert: cập nhật nếu đã có (theo MNV), thêm mới nếu chưa có
        MERGE [dbo].[CSR_Employees] AS target
        USING @NewData AS source ON target.[MNV] = source.[MNV]
        WHEN MATCHED THEN
            UPDATE SET
                [FullName]       = source.[FullName],
                [Email]          = source.[Email],
                [Department]     = source.[Department],
                [StatusId]       = 1, -- 1 = Hoạt động
                [FileModifiedAt] = @FileModifiedAt,
                [SyncedAt]       = GETDATE()
        WHEN NOT MATCHED THEN
            INSERT ([FullName], [Email], [MNV], [Department], [StatusId], [FileModifiedAt], [SyncedAt])
            VALUES (source.[FullName], source.[Email], source.[MNV], source.[Department],
                    1, @FileModifiedAt, GETDATE())
        OUTPUT $action, inserted.[MNV], inserted.[FullName], inserted.[Email], inserted.[Department] 
        INTO @MergedOutput;

        DECLARE @Rows INT = @@ROWCOUNT;

        -- KHOÁ TÀI KHOẢN (CSR_Users) CỦA CÁC NHÂN VIÊN ĐÃ NGHỈ VIỆC
        UPDATE U
        SET U.[StatusId] = 2, -- 2 = Dừng
            U.[UpdatedAt] = GETDATE()
        FROM [dbo].[CSR_Users] U
        WHERE U.[Role] NOT IN ('Admin', 'BOD', 'PRD')
          AND U.[MNV] NOT IN (SELECT [MNV] FROM @NewData);

        -- Ghi log
        INSERT INTO [dbo].[CSR_SyncLog] ([SyncType], [Status], [RowsAffected], [FileModifiedAt], [Message])
        VALUES ('employees', 'success', @Rows, @FileModifiedAt,
                CAST(@Rows AS NVARCHAR) + N' nhân viên đã được đồng bộ (theo mã MNV)');

        COMMIT TRANSACTION;

        -- Tạo chuỗi JSON trả về
        DECLARE @MissingJson NVARCHAR(MAX) = (
            SELECT [MNV], [FullName], [Department] 
            FROM @MissingEmployees FOR JSON AUTO
        );
        DECLARE @NewJson NVARCHAR(MAX) = (
            SELECT [MNV], [FullName], [Email], [Department] 
            FROM @MergedOutput WHERE [ActionType] = 'INSERT' FOR JSON AUTO
        );

        SELECT @Rows AS [RowsAffected], 
               @FileModifiedAt AS [FileModifiedAt],
               N'Đồng bộ thành công theo mã MNV' AS [Message],
               ISNULL(@MissingJson, '[]') AS [MissingEmployees],
               ISNULL(@NewJson, '[]') AS [NewEmployees];

    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        DECLARE @Err NVARCHAR(500) = ERROR_MESSAGE();
        INSERT INTO [dbo].[CSR_SyncLog] ([SyncType], [Status], [Message])
        VALUES ('employees', 'error', @Err);
        RAISERROR(@Err, 16, 1);
    END CATCH
END;
GO

PRINT 'Migration 84: Hoan thanh.';
GO
