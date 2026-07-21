-- ============================================================
-- 02_create_functions.sql
-- Các hàm SQL xử lý business logic
-- ============================================================
USE CSR_DB;
GO

-- ============================================================
-- fn_CalculateDeadline
-- Tính ngày deadline = OnboardDate - LeadTime (ngày làm việc)
-- SQL Server tự tính, Node.js không cần biết công thức này
-- ============================================================
CREATE OR ALTER FUNCTION [dbo].[fn_CalculateDeadline]
(
    @OnboardDate    DATE,
    @LeadTime       INT      -- Số ngày làm việc trước onboard
)
RETURNS DATE
AS
BEGIN
    DECLARE @Result DATE = @OnboardDate;
    DECLARE @DaysSubtracted INT = 0;

    -- Lùi ngược @LeadTime ngày làm việc (bỏ qua T7, CN)
    WHILE @DaysSubtracted < @LeadTime
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
END
GO

-- ============================================================
-- fn_GenerateProjectId
-- Tạo Project_id theo format: YYYYMMDD_HHMMSS_<CustomerAbbr>
-- Ví dụ: 20250315_093045_ASICS
-- ============================================================
CREATE OR ALTER FUNCTION [dbo].[fn_GenerateProjectId]
(
    @SubmitTimestamp    BIGINT,         -- Unix timestamp milliseconds
    @CustomerName       NVARCHAR(200)
)
RETURNS NVARCHAR(100)
AS
BEGIN
    DECLARE @DateStr    NVARCHAR(8);
    DECLARE @TimeStr    NVARCHAR(6);
    DECLARE @CustAbbr   NVARCHAR(50);
    DECLARE @DT         DATETIME;

    -- Chuyển timestamp ms -> datetime
    SET @DT = DATEADD(MILLISECOND, @SubmitTimestamp % 1000,
                DATEADD(SECOND, (@SubmitTimestamp / 1000) % 60,
                  DATEADD(MINUTE, (@SubmitTimestamp / 60000) % 60,
                    DATEADD(HOUR, (@SubmitTimestamp / 3600000) % 24,
                      CAST('1970-01-01' AS DATETIME)))));

    -- Thêm offset UTC+7
    SET @DT = DATEADD(HOUR, 7, @DT);

    SET @DateStr = FORMAT(@DT, 'yyyyMMdd');
    SET @TimeStr = FORMAT(@DT, 'HHmmss');

    -- Lấy tối đa 20 ký tự đầu của tên khách, bỏ dấu cách
    SET @CustAbbr = UPPER(LEFT(REPLACE(LTRIM(RTRIM(@CustomerName)), ' ', '_'), 20));

    RETURN @DateStr + '_' + @TimeStr + '_' + @CustAbbr;
END
GO

-- ============================================================
-- fn_GenerateTaskId
-- Tạo Task_id: <Project_id>_<Destination>_<TaskIndex>
-- ============================================================
CREATE OR ALTER FUNCTION [dbo].[fn_GenerateTaskId]
(
    @ProjectId      NVARCHAR(100),
    @Destination    NVARCHAR(100),
    @TaskIndex      INT             -- Số thứ tự task trong project
)
RETURNS NVARCHAR(150)
AS
BEGIN
    DECLARE @DestAbbr NVARCHAR(20);
    SET @DestAbbr = UPPER(LEFT(REPLACE(@Destination, ' ', ''), 10));
    RETURN @ProjectId + '_' + @DestAbbr + '_' + RIGHT('000' + CAST(@TaskIndex AS NVARCHAR(3)), 3);
END
GO

-- ============================================================
-- fn_GetReminderDate
-- Tính ngày nhắc nhở = DeadlineDate - 1 ngày làm việc
-- ============================================================
CREATE OR ALTER FUNCTION [dbo].[fn_GetReminderDate]
(
    @DeadlineDate DATE
)
RETURNS DATE
AS
BEGIN
    RETURN [dbo].[fn_CalculateDeadline](@DeadlineDate, 1);
END
GO

PRINT '=== Functions created successfully ===';
GO
