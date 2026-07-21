USE CSR_DB;
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_UpsertLocation]
    @Id INT,
    @Name NVARCHAR(100),
    @IsActive BIT
AS
BEGIN
    SET NOCOUNT ON;

    IF @Id = 0
    BEGIN
        INSERT INTO [dbo].[CSR_Locations] ([Name], [IsActive]) VALUES (@Name, @IsActive);
    END
    ELSE
    BEGIN
        DECLARE @OldName NVARCHAR(100);
        SELECT @OldName = [Name] FROM [dbo].[CSR_Locations] WHERE [Id] = @Id;

        UPDATE [dbo].[CSR_Locations] SET [Name] = @Name, [IsActive] = @IsActive WHERE [Id] = @Id;

        -- Nếu đổi tên địa điểm, đồng bộ sang cấu hình công việc (nếu có)
        IF @OldName IS NOT NULL AND @OldName <> @Name
        BEGIN
            UPDATE [dbo].[CSR_TaskConfig] SET [Destination] = @Name WHERE [Destination] = @OldName;
        END
    END
END
GO
