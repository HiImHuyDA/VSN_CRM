const fs = require('fs');
const path = require('path');
const dump = require('../tests/db_schema_dump.json');

const migrationsDir = path.join(__dirname, '../../database/migrations');

// 1. Generate 01_schema_tables_and_indexes.sql
function generateTablesSql() {
  const tableMap = {};
  dump.columns.forEach(c => {
    if (!tableMap[c.TableName]) tableMap[c.TableName] = [];
    tableMap[c.TableName].push(c);
  });

  let sqlText = `-- =============================================\n`;
  sqlText += `-- 01_schema_tables_and_indexes.sql — Consolidated Master Table Definitions\n`;
  sqlText += `-- =============================================\n\n`;

  for (const [tableName, cols] of Object.entries(tableMap)) {
    if (tableName === 'sysdiagrams') continue;

    sqlText += `IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = '${tableName}')\nBEGIN\n`;
    sqlText += `    CREATE TABLE [dbo].[${tableName}] (\n`;

    const colDefs = cols.map(c => {
      let def = `        [${c.ColumnName}] [${c.DataType}]`;
      if (['nvarchar', 'varchar', 'char', 'nchar', 'binary', 'varbinary'].includes(c.DataType)) {
        def += `(${c.MaxLength === -1 ? 'MAX' : c.MaxLength})`;
      } else if (['decimal', 'numeric'].includes(c.DataType)) {
        def += `(18, 2)`;
      }
      if (c.IsIdentity) def += ` IDENTITY(1,1)`;
      if (c.IsNullable) def += ` NULL`; else def += ` NOT NULL`;
      if (c.DefaultValue) def += ` DEFAULT ${c.DefaultValue}`;
      return def;
    });

    sqlText += colDefs.join(',\n');
    sqlText += `\n    );\nEND;\nGO\n\n`;
  }

  return sqlText;
}

// Custom overrides for legacy SPs that had outdated column references
const spOverrides = {
  usp_CopyEmailTemplate: `CREATE OR ALTER PROCEDURE [dbo].[usp_CopyEmailTemplate]
    @SourceId INT
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO [dbo].[CSR_EmailCampaignTemplates] (
        [Purpose], [TemplateName], [StartDate], [EndDate], [Location],
        [IsAllCustomer], [Customers], [SenderName], [SenderEmail],
        [RecipientName], [RecipientEmail], [EmailSubject], [EmailBody],
        [StatusId], [CreatedAt], [UpdatedAt]
    )
    SELECT
        [Purpose],
        [TemplateName] + ' (Copy)',
        [StartDate],
        [EndDate],
        [Location],
        [IsAllCustomer],
        [Customers],
        [SenderName],
        [SenderEmail],
        [RecipientName],
        [RecipientEmail],
        [EmailSubject],
        [EmailBody],
        2, -- Dừng
        GETDATE(),
        GETDATE()
    FROM [dbo].[CSR_EmailCampaignTemplates]
    WHERE [Id] = @SourceId;
    
    SELECT SCOPE_IDENTITY() AS NewId;
END`,

  usp_CopyTaskConfig: `CREATE OR ALTER PROCEDURE [dbo].[usp_CopyTaskConfig]
    @FromDestination NVARCHAR(100),
    @ToDestination NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO [dbo].[CSR_TaskConfig] (
        [Destination], [TaskName], [Description],
        [AssigneeId], [AssigneeName], [AssigneeEmail],
        [SupervisorId], [SupervisorName], [SupervisorEmail],
        [IsCompulsory], [LeadtimeDays], [StatusId]
    )
    SELECT 
        @ToDestination, t.[TaskName], t.[Description],
        t.[AssigneeId], t.[AssigneeName], t.[AssigneeEmail],
        t.[SupervisorId], t.[SupervisorName], t.[SupervisorEmail],
        t.[IsCompulsory], t.[LeadtimeDays], t.[StatusId]
    FROM [dbo].[CSR_TaskConfig] t
    WHERE t.[Destination] = @FromDestination
      AND NOT EXISTS (
          SELECT 1 FROM [dbo].[CSR_TaskConfig] t2 
          WHERE t2.[Destination] = @ToDestination AND t2.[TaskName] = t.[TaskName]
      );
END`,

  usp_TaskConfig_GetDefaultsByDestinations: `CREATE OR ALTER PROCEDURE [dbo].[usp_TaskConfig_GetDefaultsByDestinations]
    @Destinations NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;

    CREATE TABLE #Dests (Dest NVARCHAR(100));
    INSERT INTO #Dests (Dest)
    SELECT LTRIM(RTRIM(value))
    FROM STRING_SPLIT(@Destinations, ',');

    SELECT
        d.Dest AS RequestedDestination,
        tc.Id,
        tc.Destination,
        tc.TaskName,
        tc.Description,
        tc.AssigneeName,
        tc.AssigneeEmail,
        tc.SupervisorName,
        tc.SupervisorEmail,
        tc.IsCompulsory,
        tc.LeadtimeDays,
        CAST(CASE WHEN tc.StatusId = 1 THEN 1 ELSE 0 END AS BIT) AS IsActive
    FROM #Dests d
    JOIN dbo.CSR_TaskConfig tc ON tc.Destination = d.Dest
    WHERE tc.StatusId = 1
    ORDER BY d.Dest, tc.Id;

    DROP TABLE #Dests;
END`,

  usp_DeleteEvaluationCriteria: `CREATE OR ALTER PROCEDURE [dbo].[usp_DeleteEvaluationCriteria]
    @CriteriaId INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        DELETE FROM [dbo].[CSR_ReviewCriteria] WHERE [Id] = @CriteriaId;
    END TRY
    BEGIN CATCH
        UPDATE [dbo].[CSR_ReviewCriteria] 
        SET [StatusId] = 2, [FormId] = NULL 
        WHERE [Id] = @CriteriaId;
    END CATCH
END`,

  usp_Fleet_Booking_Export: `CREATE OR ALTER PROCEDURE [dbo].[usp_Fleet_Booking_Export]
    @Status        NVARCHAR(50)   = NULL,
    @RequesterMNV  NVARCHAR(50)   = NULL,
    @DateFrom      DATE           = NULL,
    @DateTo        DATE           = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        b.[BookingCode] AS N'Mã đặt xe',
        FORMAT(b.[CreatedAt], 'dd/MM/yyyy') AS N'Ngày tạo',
        b.[RequesterName] AS N'Người đặt',
        b.[RequesterDept] AS N'Phòng ban',
        bd.[PickupLocation] AS N'Điểm đón',
        bd.[Destination] AS N'Điểm đến',
        FORMAT(b.[DepartureTime], 'dd/MM/yyyy HH:mm') AS N'Giờ khởi hành',
        FORMAT(b.[ReturnTime], 'dd/MM/yyyy HH:mm') AS N'Giờ về',
        CAST(bd.[PassengerCount] AS NVARCHAR) AS N'Số người',
        bd.[Attendees] AS N'Người tham gia đi cùng',
        bd.[AttendeesEmail] AS N'Email người tham gia',
        bd.[VehicleType] AS N'Loại xe',
        b.[Purpose] AS N'Mục đích',
        b.[Status] AS N'Trạng thái',
        ISNULL(v.[PlateNumber] + ' - ' + v.[Brand], '') AS N'Xe phân công',
        ISNULL(d.[FullName], '') AS N'Tài xế',
        ISNULL(d.[Phone], '') AS N'SĐT tài xế',
        b.[ApprovedBy] AS N'Người duyệt',
        FORMAT(b.[ApprovedAt], 'dd/MM/yyyy HH:mm') AS N'Thời gian duyệt',
        ISNULL(b.[RejectedReason], '') AS N'Lý do từ chối',
        ISNULL(b.[Notes], '') AS N'Ghi chú'
    FROM [dbo].[Fleet_Bookings] b
    LEFT JOIN [dbo].[Fleet_BookingsDetailed] bd ON bd.[BookingCode] = b.[BookingCode] AND bd.[BookingCodeNo] = b.[BookingCode] + '-1'
    LEFT JOIN [dbo].[Fleet_Vehicles] v ON v.[Id] = bd.[VehicleId]
    LEFT JOIN [dbo].[Fleet_Drivers]  d ON d.[Id] = bd.[DriverId]
    WHERE
        (@Status IS NULL OR b.[Status] = @Status)
        AND (@RequesterMNV IS NULL OR b.[RequesterMNV] = @RequesterMNV)
        AND (@DateFrom IS NULL OR CAST(b.[DepartureTime] AS DATE) >= @DateFrom)
        AND (@DateTo   IS NULL OR CAST(b.[DepartureTime] AS DATE) <= @DateTo)
    ORDER BY b.[CreatedAt] DESC;
END`,

  usp_GetPRDUsersEmails: `CREATE OR ALTER PROCEDURE [dbo].[usp_GetPRDUsersEmails]
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [Email] 
    FROM [dbo].[CSR_Users] 
    WHERE [Role] = 'PRD' AND [StatusId] = 1;
END`,

  usp_GetLocations: `CREATE OR ALTER PROCEDURE [dbo].[usp_GetLocations]
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [Id], [Name], [NotificationEmails], [StatusId],
           CAST(CASE WHEN [StatusId] = 1 THEN 1 ELSE 0 END AS BIT) AS [IsActive]
    FROM [dbo].[CSR_Locations]
    ORDER BY [Name] ASC;
END`,

  usp_GetAllUsers: `CREATE OR ALTER PROCEDURE [dbo].[usp_GetAllUsers]
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [UserId] AS [Id], [MNV], [FullName], [Email], [Role], [Department], [StatusId],
           CAST(CASE WHEN [StatusId] = 1 THEN 1 ELSE 0 END AS BIT) AS [IsActive]
    FROM [dbo].[CSR_Users]
    ORDER BY [FullName] ASC;
END`,

  usp_GetUserByMNV: `CREATE OR ALTER PROCEDURE [dbo].[usp_GetUserByMNV]
    @MNV NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [UserId] AS [Id], [MNV], [FullName], [Email], [Role], [Department], [StatusId],
           CAST(CASE WHEN [StatusId] = 1 THEN 1 ELSE 0 END AS BIT) AS [IsActive]
    FROM [dbo].[CSR_Users]
    WHERE [MNV] = @MNV;
END`,

  usp_ToggleEvaluationForm: `CREATE OR ALTER PROCEDURE [dbo].[usp_ToggleEvaluationForm]
    @Id       INT,
    @IsActive BIT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @StatusId INT = CASE WHEN @IsActive = 1 THEN 1 ELSE 2 END;
    UPDATE [dbo].[CSR_EvaluationForms] 
    SET [StatusId] = @StatusId, [UpdatedAt] = GETDATE() 
    WHERE [Id] = @Id;
END`
};

// 2. Generate 02_functions_and_views.sql & 03_stored_procedures_master.sql
function generateObjectsSql() {
  let funcsAndViewsSql = `-- =============================================\n`;
  funcsAndViewsSql += `-- 02_functions_and_views.sql — Consolidated Master Functions & Views\n`;
  funcsAndViewsSql += `-- =============================================\n\n`;

  let spsSql = `-- =============================================\n`;
  spsSql += `-- 03_stored_procedures_master.sql — Consolidated Master Stored Procedures\n`;
  spsSql += `-- =============================================\n\n`;

  dump.objects.forEach(o => {
    if (o.ObjectName.startsWith('sp_ms') || o.ObjectName.startsWith('sp_alterdiagram') ||
        o.ObjectName.startsWith('sp_creatediagram') || o.ObjectName.startsWith('sp_dropdiagram') ||
        o.ObjectName.startsWith('sp_helpdiagram') || o.ObjectName.startsWith('sp_renamediagram') ||
        o.ObjectName.startsWith('sp_upgraddiagrams')) {
      return;
    }

    let def = o.ObjectDef.trim();

    if (spOverrides[o.ObjectName]) {
      def = spOverrides[o.ObjectName];
    } else {
      def = def.replace(/\bCREATE\s+PROCEDURE\b/i, 'CREATE OR ALTER PROCEDURE')
               .replace(/\bCREATE\s+PROC\b/i, 'CREATE OR ALTER PROCEDURE')
               .replace(/\bCREATE\s+FUNCTION\b/i, 'CREATE OR ALTER FUNCTION')
               .replace(/\bCREATE\s+VIEW\b/i, 'CREATE OR ALTER VIEW');
    }

    if (o.ObjectType === 'SQL_STORED_PROCEDURE') {
      spsSql += def + '\nGO\n\n';
    } else {
      funcsAndViewsSql += def + '\nGO\n\n';
    }
  });

  return { funcsAndViewsSql, spsSql };
}

function run() {
  const tablesSql = generateTablesSql();
  const { funcsAndViewsSql, spsSql } = generateObjectsSql();

  fs.writeFileSync(path.join(migrationsDir, '01_schema_tables_and_indexes.sql'), tablesSql, 'utf8');
  fs.writeFileSync(path.join(migrationsDir, '02_functions_and_views.sql'), funcsAndViewsSql, 'utf8');
  fs.writeFileSync(path.join(migrationsDir, '03_stored_procedures_master.sql'), spsSql, 'utf8');

  console.log('✅ Re-generated master migration SQL files.');
}

run();
