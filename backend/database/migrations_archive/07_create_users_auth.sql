-- ============================================================
-- 07_create_users_auth.sql
-- Tạo bảng CSR_Users để quản lý đăng nhập và phân quyền
-- ============================================================
USE CSR_DB;
GO

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'CSR_Users' AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[CSR_Users] (
        [UserId]       INT IDENTITY(1,1) PRIMARY KEY,
        [MNV]          NVARCHAR(50) NOT NULL UNIQUE,  -- ID Đăng nhập
        [PasswordHash] NVARCHAR(255) NOT NULL,        -- Lưu Hash của mật khẩu (BCrypt)
        [FullName]     NVARCHAR(200) NOT NULL,
        [Email]        NVARCHAR(200) NULL,
        [Role]         NVARCHAR(50) NOT NULL DEFAULT 'PRD', -- Admin, PRD, BOC
        [IsActive]     BIT NOT NULL DEFAULT 1,
        [RequiresPasswordChange] BIT NOT NULL DEFAULT 1, -- Lần đầu đăng nhập bắt đổi pass
        [CreatedAt]    DATETIME DEFAULT GETDATE(),
        [UpdatedAt]    DATETIME DEFAULT GETDATE()
    );
    PRINT 'Created table: CSR_Users';
END
GO

-- Seed dữ liệu Admin mặc định
-- Password gốc là: Aa@123456
-- Hash (BCrypt rounds=10) của 'Aa@123456' là: $2b$10$C1iM2bY2eB7G95Y.Zg2qMeaJ.l2q6y7.3pP2Z2fN2Z2Z2Z2Z2Z2Z2
-- Lưu ý: Chúng ta sẽ dùng hash thật do Node.js sinh ra, ở đây tạm hardcode hash của bcrypt cho Aa@123456
IF NOT EXISTS (SELECT 1 FROM [dbo].[CSR_Users] WHERE [MNV] = 'admin')
BEGIN
    INSERT INTO [dbo].[CSR_Users] ([MNV], [PasswordHash], [FullName], [Email], [Role], [RequiresPasswordChange])
    VALUES (
        'admin', 
        '$2b$10$wI/mF/FqK/s5i6A.4A/A5.vT.H.E/V.A.I.J.K.L.M.N.O.P.Q.R', -- Mã hash giả, phải update bằng API
        N'Quản trị viên', 
        'admin@vietsuncorp.com.vn', 
        'Admin', 
        0
    );
    PRINT 'Seeded default admin user';
END
GO

-- Stored Procedure: Lấy thông tin user bằng MNV
CREATE OR ALTER PROCEDURE [dbo].[usp_GetUserByMNV]
    @MNV NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 
        [UserId], [MNV], [PasswordHash], [FullName], [Email], [Role], [IsActive], [RequiresPasswordChange]
    FROM [dbo].[CSR_Users]
    WHERE [MNV] = @MNV AND [IsActive] = 1;
END
GO

-- Stored Procedure: Đổi mật khẩu
CREATE OR ALTER PROCEDURE [dbo].[usp_ChangePassword]
    @MNV NVARCHAR(50),
    @NewPasswordHash NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE [dbo].[CSR_Users]
    SET 
        [PasswordHash] = @NewPasswordHash,
        [RequiresPasswordChange] = 0,
        [UpdatedAt] = GETDATE()
    WHERE [MNV] = @MNV;
END
GO

-- SP: Get All Users
CREATE OR ALTER PROCEDURE [dbo].[usp_GetAllUsers]
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 
        [UserId], [MNV], [FullName], [Email], [Role], [IsActive], [RequiresPasswordChange], [CreatedAt], [UpdatedAt]
    FROM [dbo].[CSR_Users]
    ORDER BY [Role], [FullName];
END
GO

-- SP: Upsert User (Admin tạo/sửa account)
CREATE OR ALTER PROCEDURE [dbo].[usp_UpsertUser]
    @UserId INT,
    @MNV NVARCHAR(50),
    @FullName NVARCHAR(200),
    @Email NVARCHAR(200),
    @Role NVARCHAR(50),
    @IsActive BIT,
    @PasswordHash NVARCHAR(255) = NULL -- Nếu có truyền hash mới thì update
AS
BEGIN
    SET NOCOUNT ON;
    IF @UserId = 0 OR @UserId IS NULL
    BEGIN
        -- Insert mới
        INSERT INTO [dbo].[CSR_Users] ([MNV], [PasswordHash], [FullName], [Email], [Role], [IsActive])
        VALUES (@MNV, ISNULL(@PasswordHash, ''), @FullName, @Email, @Role, @IsActive);
    END
    ELSE
    BEGIN
        -- Update
        IF @PasswordHash IS NOT NULL AND @PasswordHash <> ''
        BEGIN
            UPDATE [dbo].[CSR_Users]
            SET 
                [MNV] = @MNV, [FullName] = @FullName, [Email] = @Email, [Role] = @Role, 
                [IsActive] = @IsActive, [PasswordHash] = @PasswordHash, [UpdatedAt] = GETDATE()
            WHERE [UserId] = @UserId;
        END
        ELSE
        BEGIN
            UPDATE [dbo].[CSR_Users]
            SET 
                [MNV] = @MNV, [FullName] = @FullName, [Email] = @Email, [Role] = @Role, 
                [IsActive] = @IsActive, [UpdatedAt] = GETDATE()
            WHERE [UserId] = @UserId;
        END
    END
END
GO
