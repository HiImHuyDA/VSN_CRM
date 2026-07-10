-- Migration: Tạo các bảng lưu trữ Feedback và các Stored Procedure liên quan
-- 63_create_feedback_tables.sql

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'CSR_FeedbackInvitations' AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[CSR_FeedbackInvitations] (
        [Id]            INT IDENTITY(1,1)   PRIMARY KEY,
        [Token]         NVARCHAR(128)       NOT NULL UNIQUE,
        [ProjectId]     NVARCHAR(100)       NOT NULL,
        [VisitorId]     INT                 NOT NULL,
        [CreatedDate]   DATETIME            NOT NULL DEFAULT GETDATE(),
        [ExpireDate]    DATETIME            NOT NULL,
        [UsedDate]      DATETIME            NULL,
        [Status]        NVARCHAR(50)        NOT NULL DEFAULT N'Pending', -- Pending, Completed, Expired, Cancelled
        [CreatedBy]     NVARCHAR(100)       NULL,
        CONSTRAINT [FK_FeedbackInvitations_Projects] FOREIGN KEY ([ProjectId]) 
            REFERENCES [dbo].[CSR_Projects]([Project_id]) ON DELETE CASCADE
    );
    CREATE INDEX [IX_FeedbackInvitations_Token] ON [dbo].[CSR_FeedbackInvitations]([Token]);
    PRINT 'Created table: CSR_FeedbackInvitations';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'CSR_FeedbackResponses' AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[CSR_FeedbackResponses] (
        [Id]            INT IDENTITY(1,1)   PRIMARY KEY,
        [InvitationId]  INT                 NOT NULL UNIQUE,
        [ProjectId]     NVARCHAR(100)       NOT NULL,
        [OverallRating] INT                 NOT NULL CHECK ([OverallRating] >= 1 AND [OverallRating] <= 5),
        [AnswersJson]   NVARCHAR(MAX)       NOT NULL,
        [Comments]      NVARCHAR(1000)      NULL,
        [SubmittedAt]   DATETIME            NOT NULL DEFAULT GETDATE(),
        CONSTRAINT [FK_FeedbackResponses_Invitations] FOREIGN KEY ([InvitationId]) 
            REFERENCES [dbo].[CSR_FeedbackInvitations]([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_FeedbackResponses_Projects] FOREIGN KEY ([ProjectId]) 
            REFERENCES [dbo].[CSR_Projects]([Project_id])
    );
    PRINT 'Created table: CSR_FeedbackResponses';
END
GO

-- 3. Stored Procedure xác thực token
CREATE OR ALTER PROCEDURE [dbo].[usp_ValidateFeedbackToken]
    @Token NVARCHAR(128)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @InvitationId INT;
    DECLARE @Status NVARCHAR(50);
    DECLARE @ExpireDate DATETIME;
    DECLARE @ProjectId NVARCHAR(100);
    DECLARE @VisitorId INT;

    SELECT 
        @InvitationId = Id,
        @Status = [Status],
        @ExpireDate = ExpireDate,
        @ProjectId = ProjectId,
        @VisitorId = VisitorId
    FROM [dbo].[CSR_FeedbackInvitations]
    WHERE [Token] = @Token;

    -- Kiểm tra nếu không tìm thấy token
    IF @InvitationId IS NULL
    BEGIN
        SELECT N'Invalid' AS [ValidationStatus], N'Đường dẫn đánh giá không hợp lệ hoặc không tồn tại.' AS [Message];
        RETURN;
    END

    -- Kiểm tra nếu đã sử dụng
    IF @Status = N'Completed'
    BEGIN
        SELECT N'Used' AS [ValidationStatus], N'Đánh giá này đã được thực hiện trước đó.' AS [Message];
        RETURN;
    END

    -- Kiểm tra nếu bị hủy
    IF @Status = N'Cancelled'
    BEGIN
        SELECT N'Cancelled' AS [ValidationStatus], N'Đường dẫn đánh giá này đã bị hủy bỏ bởi quản trị viên.' AS [Message];
        RETURN;
    END

    -- Kiểm tra hết hạn
    IF GETDATE() > @ExpireDate
    BEGIN
        -- Cập nhật trạng thái sang Expired để đồng bộ dữ liệu
        UPDATE [dbo].[CSR_FeedbackInvitations]
        SET [Status] = N'Expired'
        WHERE Id = @InvitationId;

        SELECT N'Expired' AS [ValidationStatus], N'Yêu cầu đánh giá đã hết hạn sử dụng.' AS [Message];
        RETURN;
    END

    -- Nếu hợp lệ
    -- Lấy thông tin Tên khách hàng từ CSR_Projects
    DECLARE @CustomerName NVARCHAR(200);
    DECLARE @GuestReps NVARCHAR(MAX);

    SELECT 
        @CustomerName = CustomerName,
        @GuestReps = GuestReps
    FROM [dbo].[CSR_Projects]
    WHERE [Project_id] = @ProjectId;

    -- Trả về trạng thái hợp lệ cùng thông tin dự án
    SELECT 
        N'Valid' AS [ValidationStatus],
        N'Hợp lệ' AS [Message],
        @InvitationId AS [InvitationId],
        @ProjectId AS [ProjectId],
        @CustomerName AS [CustomerName],
        @VisitorId AS [VisitorId],
        @GuestReps AS [GuestReps];

    -- Trả về thêm recordset chứa danh sách tiêu chí đánh giá hoạt động
    SELECT [Id], [CriteriaName], [Description], [CriteriaGroup], [SortOrder], [IsRequired]
    FROM [dbo].[CSR_ReviewCriteria]
    WHERE [StatusId] = 1
    ORDER BY [SortOrder] ASC;
END
GO

-- 4. Stored Procedure nộp kết quả phản hồi
CREATE OR ALTER PROCEDURE [dbo].[usp_SubmitFeedback]
    @Token          NVARCHAR(128),
    @OverallRating  INT,
    @AnswersJson    NVARCHAR(MAX),
    @Comments       NVARCHAR(1000) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        DECLARE @InvitationId INT;
        DECLARE @ProjectId NVARCHAR(100);
        DECLARE @Status NVARCHAR(50);
        DECLARE @ExpireDate DATETIME;

        SELECT 
            @InvitationId = Id,
            @ProjectId = ProjectId,
            @Status = [Status],
            @ExpireDate = ExpireDate
        FROM [dbo].[CSR_FeedbackInvitations]
        WHERE [Token] = @Token;

        -- Validate lại trạng thái và hạn dùng trong transaction để chống replay
        IF @InvitationId IS NULL
            RAISERROR(N'Mã xác thực không hợp lệ', 16, 1);
        
        IF @Status = N'Completed'
            RAISERROR(N'Đánh giá này đã được nộp trước đó', 16, 1);

        IF @Status = N'Cancelled'
            RAISERROR(N'Đường dẫn đánh giá này đã bị hủy bỏ', 16, 1);

        IF GETDATE() > @ExpireDate
            RAISERROR(N'Yêu cầu đánh giá đã hết hạn sử dụng', 16, 1);

        -- 1. Lưu kết quả vào CSR_FeedbackResponses
        INSERT INTO [dbo].[CSR_FeedbackResponses]
            ([InvitationId], [ProjectId], [OverallRating], [AnswersJson], [Comments], [SubmittedAt])
        VALUES
            (@InvitationId, @ProjectId, @OverallRating, @AnswersJson, @Comments, GETDATE());

        -- 2. Cập nhật trạng thái thư mời
        UPDATE [dbo].[CSR_FeedbackInvitations]
        SET [Status] = N'Completed',
            [UsedDate] = GETDATE()
        WHERE Id = @InvitationId;

        COMMIT TRANSACTION;
        SELECT N'Success' AS [ResultStatus], N'Đã lưu đánh giá thành công' AS [Message];
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        DECLARE @Err NVARCHAR(500) = ERROR_MESSAGE();
        RAISERROR(@Err, 16, 1);
    END CATCH
END
GO
