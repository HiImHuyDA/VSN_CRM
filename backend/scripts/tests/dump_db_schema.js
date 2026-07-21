const { getCsrPool } = require('../../src/config/database');
const fs = require('fs');
const path = require('path');

async function dump() {
  const pool = await getCsrPool();
  console.log('Connected to SQL Server...');

  // 1. Get all tables & columns
  const tablesRes = await pool.request().query(`
    SELECT 
      t.name AS TableName,
      c.name AS ColumnName,
      ty.name AS DataType,
      c.max_length AS MaxLength,
      c.is_nullable AS IsNullable,
      c.is_identity AS IsIdentity,
      object_definition(c.default_object_id) AS DefaultValue
    FROM sys.tables t
    JOIN sys.columns c ON t.object_id = c.object_id
    JOIN sys.types ty ON c.user_type_id = ty.user_type_id
    WHERE t.is_ms_shipped = 0
    ORDER BY t.name, c.column_id
  `);

  // 2. Get all stored procedures and modules
  const spRes = await pool.request().query(`
    SELECT 
      o.name AS ObjectName,
      o.type_desc AS ObjectType,
      m.definition AS ObjectDef
    FROM sys.objects o
    JOIN sys.sql_modules m ON o.object_id = m.object_id
    WHERE o.is_ms_shipped = 0
    ORDER BY o.type, o.name
  `);

  const dumpData = {
    columns: tablesRes.recordset,
    objects: spRes.recordset
  };

  fs.writeFileSync(path.join(__dirname, 'db_schema_dump.json'), JSON.stringify(dumpData, null, 2), 'utf8');
  console.log('Dump completed! Objects count:', spRes.recordset.length, 'Columns count:', tablesRes.recordset.length);
  process.exit(0);
}

dump().catch(err => {
  console.error('Dump error:', err);
  process.exit(1);
});
