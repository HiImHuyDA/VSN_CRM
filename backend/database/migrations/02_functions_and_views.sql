-- =============================================
-- 02_functions_and_views.sql — Consolidated Master Functions & Views
-- =============================================

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

CREATE OR ALTER FUNCTION dbo.fn_diagramobjects() 
	RETURNS int
	WITH EXECUTE AS N'dbo'
	AS
	BEGIN
		declare @id_upgraddiagrams		int
		declare @id_sysdiagrams			int
		declare @id_helpdiagrams		int
		declare @id_helpdiagramdefinition	int
		declare @id_creatediagram	int
		declare @id_renamediagram	int
		declare @id_alterdiagram 	int 
		declare @id_dropdiagram		int
		declare @InstalledObjects	int

		select @InstalledObjects = 0

		select 	@id_upgraddiagrams = object_id(N'dbo.sp_upgraddiagrams'),
			@id_sysdiagrams = object_id(N'dbo.sysdiagrams'),
			@id_helpdiagrams = object_id(N'dbo.sp_helpdiagrams'),
			@id_helpdiagramdefinition = object_id(N'dbo.sp_helpdiagramdefinition'),
			@id_creatediagram = object_id(N'dbo.sp_creatediagram'),
			@id_renamediagram = object_id(N'dbo.sp_renamediagram'),
			@id_alterdiagram = object_id(N'dbo.sp_alterdiagram'), 
			@id_dropdiagram = object_id(N'dbo.sp_dropdiagram')

		if @id_upgraddiagrams is not null
			select @InstalledObjects = @InstalledObjects + 1
		if @id_sysdiagrams is not null
			select @InstalledObjects = @InstalledObjects + 2
		if @id_helpdiagrams is not null
			select @InstalledObjects = @InstalledObjects + 4
		if @id_helpdiagramdefinition is not null
			select @InstalledObjects = @InstalledObjects + 8
		if @id_creatediagram is not null
			select @InstalledObjects = @InstalledObjects + 16
		if @id_renamediagram is not null
			select @InstalledObjects = @InstalledObjects + 32
		if @id_alterdiagram  is not null
			select @InstalledObjects = @InstalledObjects + 64
		if @id_dropdiagram is not null
			select @InstalledObjects = @InstalledObjects + 128
		
		return @InstalledObjects 
	END
GO

CREATE OR ALTER FUNCTION [dbo].[fn_GenerateProjectId]
(
    @SubmitTimestamp    BIGINT,
    @CustomerName       NVARCHAR(200)
)
RETURNS NVARCHAR(100)
AS
BEGIN
    DECLARE @MaxId INT;
    
    -- Lấy giá trị Project_id lớn nhất hiện tại (chỉ lấy các ID là số nguyên)
    SELECT @MaxId = ISNULL(MAX(
        CASE 
            WHEN ISNUMERIC(Project_id) = 1 THEN CAST(Project_id AS INT)
            ELSE 0 
        END
    ), 0)
    FROM [dbo].[CSR_Projects];
    
    RETURN CAST(@MaxId + 1 AS NVARCHAR(100));
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

CREATE OR ALTER VIEW [dbo].[vw_ActiveTasks]
AS
SELECT
    t.[Task_id],
    t.[Project_id],
    p.[CustomerName],
    p.[CustomerType],
    p.[SubmitterName],
    t.[OnboardDate],
    t.[Destination],
    t.[TaskName],
    t.[TaskDetail],
    t.[Assignee],
    t.[AssigneeEmail],
    t.[Supervisor],
    t.[SupervisorEmail],
    t.[DeadlineDate],
    t.[ReminderDate],
    t.[Vehicle],
    t.[PassengerCount],
    t.[FlightRoute],
    t.[ReturnDate],
    t.[MealOption],
    t.[MeetingRoom],
    t.[MeetingRoomEmail],
    t.[MeetingStartTime],
    t.[MeetingEndTime],
    t.[CalendarEventId],
    t.[ContentType],
    CASE
        WHEN t.[DeadlineDate] < CAST(GETDATE() AS DATE) THEN N'Quá hạn'
        WHEN t.[DeadlineDate] = CAST(GETDATE() AS DATE) THEN N'Hôm nay'
        WHEN t.[DeadlineDate] <= DATEADD(DAY, 3, CAST(GETDATE() AS DATE)) THEN N'Sắp đến hạn'
        ELSE N'Trong hạn'
    END                                     AS [DeadlineStatus],
    DATEDIFF(DAY, CAST(GETDATE() AS DATE), t.[DeadlineDate])
                                            AS [DaysUntilDeadline]
FROM
    [dbo].[CSR_Tasks] t
    INNER JOIN [dbo].[CSR_Projects] p ON t.[Project_id] = p.[Project_id]
WHERE
    t.[StatusId] = 1;
GO

CREATE OR ALTER VIEW [dbo].[vw_SubmissionSummary]
AS
SELECT
    p.[Project_id],
    p.[ParentId],
    p.[RecordType],
    p.[Version],
    p.[SubmitDate],
    p.[CustomerType],
    p.[CustomerName],
    p.[SubmitterName],
    p.[SubmitterEmail],
    p.[SubmitterMNV],
    p.[MeetingTopic],
    s.TenTrangThai AS [Status],
    p.[CreatedAt],
    p.[UpdatedAt],
    -- Dem so ngay tiep don tu JSON
    ISNULL((SELECT COUNT(*) FROM OPENJSON(p.AgendaJsonData)), 0) AS [TotalDays],
    -- Trich xuat ngay tu JSON
    STUFF((
        SELECT DISTINCT ', ' + CONVERT(NVARCHAR(10), CAST(JSON_VALUE(j.value, '$.date') AS DATE), 103)
        FROM OPENJSON(p.AgendaJsonData) j
        ORDER BY ', ' + CONVERT(NVARCHAR(10), CAST(JSON_VALUE(j.value, '$.date') AS DATE), 103)
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS [OnboardDates],
    -- Trich xuat dia diem tu JSON
    STUFF((
        SELECT DISTINCT ', ' + k.[key]
        FROM OPENJSON(p.AgendaJsonData) j
        CROSS APPLY OPENJSON(JSON_QUERY(j.value, '$.agenda')) k
        ORDER BY ', ' + k.[key]
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS [Destinations],
    -- Dem tong so task
    ISNULL((SELECT COUNT(*) FROM [dbo].[CSR_Tasks] t WHERE t.[Project_id] = p.[Project_id]), 0) AS [TotalTasks],
    -- Dem so task khan cap
    ISNULL((SELECT SUM(CASE WHEN t.[DeadlineDate] <= CAST(GETDATE() AS DATE) AND t.[StatusId] = 1 THEN 1 ELSE 0 END) 
     FROM [dbo].[CSR_Tasks] t WHERE t.[Project_id] = p.[Project_id]), 0) AS [UrgentTasks]
FROM
    [dbo].[CSR_Projects] p
    INNER JOIN [dbo].[CSR_Statuses] s ON p.[StatusId] = s.[Id];
GO

