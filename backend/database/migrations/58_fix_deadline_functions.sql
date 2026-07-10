USE CSR_DB;
GO

-- 1. Sửa hàm fn_CalculateDeadline để tránh vòng lặp vô hạn khi OnboardDate là NULL
CREATE OR ALTER FUNCTION [dbo].[fn_CalculateDeadline]
(
    @OnboardDate    DATE,
    @LeadTime       INT      -- Số ngày làm việc trước onboard
)
RETURNS DATE
AS
BEGIN
    -- Nếu @OnboardDate là NULL hoặc @LeadTime là NULL, trả về NULL ngay lập tức
    IF @OnboardDate IS NULL OR @LeadTime IS NULL
        RETURN NULL;

    DECLARE @Result DATE = @OnboardDate;
    DECLARE @DaysSubtracted INT = 0;

    -- Lùi ngược @LeadTime ngày làm việc (bỏ qua T7, CN)
    -- Giới hạn vòng lặp tối đa 100 lần để đề phòng mọi trường hợp treo
    WHILE @DaysSubtracted < @LeadTime AND @DaysSubtracted < 100
    BEGIN
        SET @Result = DATEADD(DAY, -1, @Result);
        -- Bỏ qua thứ 7 (7) và chủ nhật (1) trong DATEPART(WEEKDAY,...)
        -- DATEPART: 1=CN, 2=T2, 3=T3, 4=T4, 5=T5, 6=T6, 7=T7
        IF DATEPART(WEEKDAY, @Result) NOT IN (1, 7)
        BEGIN
            SET @DaysSubtracted = @DaysSubtracted + 1;
        END
    END

    RETURN @Result;
END;
GO

PRINT 'Fix for fn_CalculateDeadline function (added NULL check and loop counter protection) applied successfully!';
GO
