const { getCsrPool } = require('../../src/config/database');
const fs = require('fs');
const path = require('path');

async function generateSeedSql() {
  const pool = await getCsrPool();
  console.log('Generating 04_seed_initial_data.sql...');

  let sqlText = `-- =============================================\n`;
  sqlText += `-- 04_seed_initial_data.sql — Consolidated Master Initial Seed Data\n`;
  sqlText += `-- =============================================\n\n`;

  // 1. Seed Statuses
  const statusRes = await pool.request().query('SELECT Id, TenTrangThai FROM CSR_Statuses ORDER BY Id');
  sqlText += `-- 1. Seed Master Statuses\n`;
  sqlText += `IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CSR_Statuses')\nBEGIN\n`;
  sqlText += `    MERGE [dbo].[CSR_Statuses] AS target\n`;
  sqlText += `    USING (SELECT * FROM (VALUES\n`;
  const statusVals = statusRes.recordset.map(s => `        (${s.Id}, N'${s.TenTrangThai.replace(/'/g, "''")}')`);
  sqlText += statusVals.join(',\n') + `\n    ) AS tmp (Id, TenTrangThai)) AS source\n`;
  sqlText += `    ON target.Id = source.Id\n`;
  sqlText += `    WHEN MATCHED THEN UPDATE SET target.TenTrangThai = source.TenTrangThai\n`;
  sqlText += `    WHEN NOT MATCHED THEN INSERT (Id, TenTrangThai) VALUES (source.Id, source.TenTrangThai);\n`;
  sqlText += `END;\nGO\n\n`;

  // 2. Seed Menus
  const menuRes = await pool.request().query('SELECT Id, ParentId, MenuKey, MenuName, Path, SortOrder, IsActive FROM CSR_Menus ORDER BY SortOrder, Id');
  sqlText += `-- 2. Seed Menus\n`;
  sqlText += `IF NOT EXISTS (SELECT 1 FROM CSR_Menus)\nBEGIN\n`;
  menuRes.recordset.forEach(m => {
    const parentVal = m.ParentId ? m.ParentId : 'NULL';
    const pathVal = m.Path ? `'${m.Path}'` : 'NULL';
    sqlText += `    INSERT INTO [dbo].[CSR_Menus] ([ParentId], [MenuKey], [MenuName], [Path], [SortOrder], [IsActive])\n`;
    sqlText += `    VALUES (${parentVal}, '${m.MenuKey}', N'${m.MenuName.replace(/'/g, "''")}', ${pathVal}, ${m.SortOrder}, ${m.IsActive ? 1 : 0});\n`;
  });
  sqlText += `END;\nGO\n\n`;

  // 3. Seed RolePermissions
  const permRes = await pool.request().query(`
    SELECT rp.MenuId, m.MenuKey, rp.Role 
    FROM CSR_RolePermissions rp 
    JOIN CSR_Menus m ON rp.MenuId = m.Id
  `);
  sqlText += `-- 3. Seed Role Permissions\n`;
  sqlText += `IF NOT EXISTS (SELECT 1 FROM CSR_RolePermissions)\nBEGIN\n`;
  permRes.recordset.forEach(p => {
    sqlText += `    INSERT INTO [dbo].[CSR_RolePermissions] ([MenuId], [Role])\n`;
    sqlText += `    SELECT Id, '${p.Role}' FROM CSR_Menus WHERE MenuKey = '${p.MenuKey}';\n`;
  });
  sqlText += `END;\nGO\n\n`;

  const seedFilePath = path.join(__dirname, '../../database/migrations/04_seed_initial_data.sql');
  fs.writeFileSync(seedFilePath, sqlText, 'utf8');
  console.log('✅ Generated 04_seed_initial_data.sql');
  process.exit(0);
}

generateSeedSql().catch(err => {
  console.error('Seed generation error:', err);
  process.exit(1);
});
