-- Migration: Tạo các Stored Procedure quản lý Feedback tuân thủ quy tắc đặt tên dự án
-- 64_create_feedback_stored_procedures.sql

-- 1. Stored Procedure lấy danh sách thư mời
CREATE OR ALTER PROCEDURE [dbo].[usp_Feedback_Invitation_List]
    @Status         NVARCHAR(50) = NULL,
    @ProjectId      NVARCHAR(100) = NULL,
    @CustomerName   NVARCHAR(200) = NULL,
    @Host           NVARCHAR(200) = NULL,
    @DateStart      DATETIME = NULL,
    @DateEnd        DATETIME = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT i.Id, i.Token, i.ProjectId, i.VisitorId, i.CreatedDate, i.ExpireDate, i.UsedDate, i.Status, i.CreatedBy,
           p.CustomerName, p.SubmitterName, p.MeetingTopic, p.GuestReps
    FROM [dbo].[CSR_FeedbackInvitations] i
    INNER JOIN [dbo].[CSR_Projects] p ON i.ProjectId = p.Project_id
    WHERE 1=1
      AND (@Status IS NULL OR i.[Status] = @Status)
      AND (@ProjectId IS NULL OR i.ProjectId = @ProjectId)
      AND (@CustomerName IS NULL OR p.CustomerName LIKE '%' + @CustomerName + '%')
      AND (@Host IS NULL OR p.SubmitterName LIKE '%' + @Host + '%' OR p.SubmitterEmail LIKE '%' + @Host + '%')
      AND (@DateStart IS NULL OR i.CreatedDate >= @DateStart)
      AND (@DateEnd IS NULL OR i.CreatedDate <= @DateEnd)
    ORDER BY i.CreatedDate DESC;
END
GO

-- 2. Stored Procedure thực hiện resend và trả về thông tin gửi mail
CREATE OR ALTER PROCEDURE [dbo].[usp_Feedback_Invitation_Resend]
    @InvitationId   INT,
    @NewToken       NVARCHAR(128),
    @NewExpireDate  DATETIME
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;
    BEGIN TRY
        -- Cập nhật thông tin thư mời
        UPDATE [dbo].[CSR_FeedbackInvitations]
        SET [Token] = @NewToken,
            [ExpireDate] = @NewExpireDate,
            [Status] = N'Pending',
            [UsedDate] = NULL
        WHERE Id = @InvitationId;

        -- Trả về thông tin chi tiết thư mời để gọi Graph API
        SELECT i.Id, i.ProjectId, i.VisitorId, p.CustomerName, p.GuestReps, p.SubmitterName, p.SubmitDate
        FROM [dbo].[CSR_FeedbackInvitations] i
        INNER JOIN [dbo].[CSR_Projects] p ON i.ProjectId = p.Project_id
        WHERE i.Id = @InvitationId;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        DECLARE @Err NVARCHAR(500) = ERROR_MESSAGE();
        RAISERROR(@Err, 16, 1);
    END CATCH
END
GO

-- 3. Stored Procedure hủy thư mời
CREATE OR ALTER PROCEDURE [dbo].[usp_Feedback_Invitation_Cancel]
    @InvitationId   INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE [dbo].[CSR_FeedbackInvitations]
    SET [Status] = N'Cancelled'
    WHERE Id = @InvitationId;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO

-- 4. Stored Procedure lấy danh sách phản hồi đánh giá
CREATE OR ALTER PROCEDURE [dbo].[usp_Feedback_Response_List]
    @Rating         INT = NULL,
    @CustomerName   NVARCHAR(200) = NULL,
    @Host           NVARCHAR(200) = NULL,
    @DateStart      DATETIME = NULL,
    @DateEnd        DATETIME = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT r.Id, r.InvitationId, r.ProjectId, r.OverallRating, r.AnswersJson, r.Comments, r.SubmittedAt,
           p.CustomerName, p.SubmitterName, p.MeetingTopic, i.VisitorId, p.GuestReps
    FROM [dbo].[CSR_FeedbackResponses] r
    INNER JOIN [dbo].[CSR_Projects] p ON r.ProjectId = p.Project_id
    INNER JOIN [dbo].[CSR_FeedbackInvitations] i ON r.InvitationId = i.Id
    WHERE 1=1
      AND (@Rating IS NULL OR r.OverallRating = @Rating)
      AND (@CustomerName IS NULL OR p.CustomerName LIKE '%' + @CustomerName + '%')
      AND (@Host IS NULL OR p.SubmitterName LIKE '%' + @Host + '%' OR p.SubmitterEmail LIKE '%' + @Host + '%')
      AND (@DateStart IS NULL OR r.SubmittedAt >= @DateStart)
      AND (@DateEnd IS NULL OR r.SubmittedAt <= @DateEnd)
    ORDER BY r.SubmittedAt DESC;
END
GO
