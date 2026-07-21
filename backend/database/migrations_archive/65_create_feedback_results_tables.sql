-- Migration: Tạo bảng kết quả đánh giá phân rã của khách hàng và cập nhật Stored Procedure
-- 65_create_feedback_results_tables.sql

USE CSR_DB;
GO

-- 1. Tạo bảng Dimension nhóm tiêu chí mẹ
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'CSR_FeedbackCriteriaParent' AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[CSR_FeedbackCriteriaParent] (
        [Id]            INT IDENTITY(1,1)   PRIMARY KEY,
        [Name]          NVARCHAR(200)       NOT NULL UNIQUE
    );
    PRINT 'Created table: CSR_FeedbackCriteriaParent';
END
GO

-- Seed dữ liệu mẫu cho nhóm tiêu chí mẹ nếu bảng rỗng
IF NOT EXISTS (SELECT 1 FROM [dbo].[CSR_FeedbackCriteriaParent])
BEGIN
    INSERT INTO [dbo].[CSR_FeedbackCriteriaParent] ([Name])
    VALUES 
    (N'Nhà hàng'),
    (N'Chuyến xe'),
    (N'Văn phòng'),
    (N'Lời khen'),
    (N'Cải thiện'),
    (N'Đánh giá chung');
    PRINT 'Seeded data for CSR_FeedbackCriteriaParent';
END
GO

-- 2. Tạo bảng kết quả đánh giá phân rã chi tiết
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'CSR_FeedbackResultsDetail' AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[CSR_FeedbackResultsDetail] (
        [Id]            INT IDENTITY(1,1)   PRIMARY KEY,
        [Token]         NVARCHAR(128)       NOT NULL,
        [ParentId]      INT                 NOT NULL,
        [Name]          NVARCHAR(200)       NOT NULL,
        [RatingStars]   INT                 NOT NULL CHECK ([RatingStars] >= 1 AND [RatingStars] <= 5),
        [Comment]       NVARCHAR(1000)      NULL,
        [SubmittedAt]   DATETIME            NOT NULL DEFAULT GETDATE(),
        [VisitorName]   NVARCHAR(200)       NULL,
        [ResponseId]    NVARCHAR(100)       NULL,
        [ProjectId]     NVARCHAR(100)       NOT NULL,

        CONSTRAINT [FK_FeedbackResultsDetail_CriteriaParent] FOREIGN KEY ([ParentId]) 
            REFERENCES [dbo].[CSR_FeedbackCriteriaParent]([Id]),
        CONSTRAINT [FK_FeedbackResultsDetail_Projects] FOREIGN KEY ([ProjectId]) 
            REFERENCES [dbo].[CSR_Projects]([Project_id]) ON DELETE CASCADE
    );
    CREATE INDEX [IX_FeedbackResultsDetail_Token] ON [dbo].[CSR_FeedbackResultsDetail]([Token]);
    CREATE INDEX [IX_FeedbackResultsDetail_ProjectId] ON [dbo].[CSR_FeedbackResultsDetail]([ProjectId]);
    PRINT 'Created table: CSR_FeedbackResultsDetail';
END
GO

-- 3. Cập nhật Stored Procedure nộp phản hồi đánh giá
CREATE OR ALTER PROCEDURE [dbo].[usp_SubmitFeedback]
    @Token          NVARCHAR(128),
    @OverallRating  INT,
    @AnswersJson    NVARCHAR(MAX),
    @Comments       NVARCHAR(1000) = NULL,
    @VisitorName    NVARCHAR(200) = NULL,
    @ResponseId     NVARCHAR(100) = NULL
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

        -- Validate lại trạng thái và hạn dùng
        IF @InvitationId IS NULL
            RAISERROR(N'Mã xác thực không hợp lệ', 16, 1);
        
        IF @Status = N'Completed'
            RAISERROR(N'Đánh giá này đã được nộp trước đó', 16, 1);

        IF @Status = N'Cancelled'
            RAISERROR(N'Đường dẫn đánh giá này đã bị hủy bỏ', 16, 1);

        IF GETDATE() > @ExpireDate
            RAISERROR(N'Yêu cầu đánh giá đã hết hạn sử dụng', 16, 1);

        -- 1. Lưu kết quả thô vào CSR_FeedbackResponses
        INSERT INTO [dbo].[CSR_FeedbackResponses]
            ([InvitationId], [ProjectId], [OverallRating], [AnswersJson], [Comments], [SubmittedAt])
        VALUES
            (@InvitationId, @ProjectId, @OverallRating, @AnswersJson, @Comments, GETDATE());

        -- 2. Phân tách AnswersJson và chèn vào bảng kết quả chi tiết CSR_FeedbackResultsDetail
        -- Chỉ thực hiện nếu AnswersJson là một chuỗi JSON hợp lệ dạng mảng hoặc đối tượng
        IF ISJSON(@AnswersJson) > 0
        BEGIN
            INSERT INTO [dbo].[CSR_FeedbackResultsDetail]
                ([Token], [ParentId], [Name], [RatingStars], [Comment], [SubmittedAt], [VisitorName], [ResponseId], [ProjectId])
            SELECT 
                @Token,
                [parentId],
                [name],
                [rating],
                [comment],
                GETDATE(),
                COALESCE(@VisitorName, N'Khách'),
                @ResponseId,
                @ProjectId
            FROM OPENJSON(@AnswersJson)
            WITH (
                [parentId] INT            '$.parentId',
                [name]     NVARCHAR(200)  '$.name',
                [rating]   INT            '$.rating',
                [comment]  NVARCHAR(1000) '$.comment'
            );
        END

        -- 3. Cập nhật trạng thái thư mời
        UPDATE [dbo].[CSR_FeedbackInvitations]
        SET [Status] = N'Completed',
            [UsedDate] = GETDATE()
        WHERE Id = @InvitationId;

        COMMIT TRANSACTION;
        SELECT N'Success' AS [ResultStatus], N'Đã lưu đánh giá thành công' AS [Message];
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        DECLARE @Err NVARCHAR(500) = ERROR_MESSAGE();
        RAISERROR(@Err, 16, 1);
    END CATCH
END
GO
