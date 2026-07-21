USE CSR_DB;
GO

-- ============================================================
-- 1. usp_GetPRDUsersEmails — Lấy danh sách email PRD đang hoạt động
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_GetPRDUsersEmails]
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [Email] 
    FROM [dbo].[CSR_Users] 
    WHERE [Role] = 'PRD' AND [IsActive] = 1;
END
GO

-- ============================================================
-- 2. usp_GetEvaluationFormDetail — Lấy chi tiết form đánh giá và tiêu chí
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_GetEvaluationFormDetail]
    @FormId INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Recordset 0: Thông tin biểu mẫu
    SELECT * 
    FROM [dbo].[CSR_EvaluationForms] 
    WHERE [Id] = @FormId;

    -- Recordset 1: Danh sách tiêu chí sắp xếp theo thứ tự hiển thị
    SELECT * 
    FROM [dbo].[CSR_ReviewCriteria] 
    WHERE [FormId] = @FormId 
    ORDER BY [SortOrder] ASC;
END
GO

-- ============================================================
-- 3. usp_GetEvaluationCriteriaIds — Lấy danh sách Id tiêu chí theo FormId
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_GetEvaluationCriteriaIds]
    @FormId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [Id] 
    FROM [dbo].[CSR_ReviewCriteria] 
    WHERE [FormId] = @FormId;
END
GO

-- ============================================================
-- 4. usp_DeleteEvaluationCriteria — Xoá hoặc ẩn tiêu chí
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_DeleteEvaluationCriteria]
    @CriteriaId INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        -- Thử xoá trực tiếp
        DELETE FROM [dbo].[CSR_ReviewCriteria] WHERE [Id] = @CriteriaId;
    END TRY
    BEGIN CATCH
        -- Nếu lỗi khoá ngoại do có bản ghi đánh giá tham chiếu tới, ta chuyển sang ẩn
        UPDATE [dbo].[CSR_ReviewCriteria] 
        SET [IsActive] = 0, [FormId] = NULL 
        WHERE [Id] = @CriteriaId;
    END CATCH
END
GO

-- ============================================================
-- 5. usp_UpsertReviewCriteria — Thêm hoặc cập nhật tiêu chí đánh giá
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_UpsertReviewCriteria]
    @Id             INT,
    @FormId         INT,
    @CriteriaName   NVARCHAR(200),
    @Description    NVARCHAR(500),
    @CriteriaGroup  NVARCHAR(100),
    @SortOrder      INT,
    @IsRequired     BIT,
    @IsActive       BIT
AS
BEGIN
    SET NOCOUNT ON;
    IF @Id > 0
    BEGIN
        UPDATE [dbo].[CSR_ReviewCriteria]
        SET [FormId]        = @FormId,
            [CriteriaName]  = @CriteriaName,
            [Description]   = @Description,
            [CriteriaGroup] = @CriteriaGroup,
            [SortOrder]     = @SortOrder,
            [IsRequired]    = @IsRequired,
            [IsActive]      = @IsActive
        WHERE [Id] = @Id;
    END
    ELSE
    BEGIN
        INSERT INTO [dbo].[CSR_ReviewCriteria] 
            ([FormId], [CriteriaName], [Description], [CriteriaGroup], [SortOrder], [IsRequired], [IsActive])
        VALUES 
            (@FormId, @CriteriaName, @Description, @CriteriaGroup, @SortOrder, @IsRequired, @IsActive);
    END
END
GO

-- ============================================================
-- 6. usp_ToggleEvaluationForm — Kích hoạt hoặc ngưng hoạt động nhanh biểu mẫu
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_ToggleEvaluationForm]
    @Id       INT,
    @IsActive BIT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE [dbo].[CSR_EvaluationForms] 
    SET [IsActive] = @IsActive, [UpdatedAt] = GETDATE() 
    WHERE [Id] = @Id;
END
GO

-- ============================================================
-- 7. usp_GetTaskAttachmentById — Lấy đường dẫn file đính kèm của task
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_GetTaskAttachmentById]
    @AttachmentId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [FilePath], [FileName] 
    FROM [dbo].[CSR_TaskAttachments] 
    WHERE [Id] = @AttachmentId;
END
GO

-- ============================================================
-- 8. usp_GetDinnerRestaurants — Lấy danh sách nhà hàng tối và nhận xét
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_GetDinnerRestaurants]
AS
BEGIN
    SET NOCOUNT ON;

    -- Recordset 0: Danh sách nhà hàng tối
    SELECT 
        c.Id, c.Category, c.Name, c.Email, c.JsonData, c.IsActive,
        UsageCount = (SELECT COUNT(DISTINCT t.Project_id) FROM CSR_Tasks t WHERE t.Destination = c.Name AND t.IsActive = 1),
        AvgRating = (
            SELECT ROUND(AVG(CAST(r.Rating AS FLOAT)), 1)
            FROM CSR_Reviews r
            INNER JOIN CSR_ReviewCriteria rc ON r.CriteriaId = rc.Id
            INNER JOIN CSR_Tasks t ON t.Project_id = r.ProjectId AND t.IsActive = 1
            WHERE rc.CriteriaGroup = N'Ăn uống' AND t.Destination = c.Name
        ),
        ReviewCount = (
            SELECT COUNT(r.Id)
            FROM CSR_Reviews r
            INNER JOIN CSR_ReviewCriteria rc ON r.CriteriaId = rc.Id
            INNER JOIN CSR_Tasks t ON t.Project_id = r.ProjectId AND t.IsActive = 1
            WHERE rc.CriteriaGroup = N'Ăn uống' AND t.Destination = c.Name
        )
    FROM CSR_ConfigLists c
    WHERE c.Category = 'DinnerRestaurant'
    ORDER BY c.Name;

    -- Recordset 1: Bình luận, đánh giá của các nhà hàng
    SELECT 
        t.Destination AS RestaurantName,
        r.Comment,
        r.Rating,
        r.ReviewerName,
        r.CreatedAt
    FROM CSR_Reviews r
    INNER JOIN CSR_ReviewCriteria rc ON r.CriteriaId = rc.Id
    INNER JOIN CSR_Tasks t ON t.Project_id = r.ProjectId AND t.IsActive = 1
    WHERE rc.CriteriaGroup = N'Ăn uống' AND r.Comment IS NOT NULL AND r.Comment != ''
    ORDER BY r.CreatedAt DESC;
END
GO
