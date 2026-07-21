// run_migration.js — Migration runner for CSR Web SQL Server Database
const sql = require('mssql');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const config = {
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT || '1433'),
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
  },
};

async function runFile(pool, migrationFile) {
  const filePath = path.join(__dirname, 'database', 'migrations', migrationFile);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${migrationFile}`);
    return;
  }

  console.log(`\n🚀 [Migration] Running file: ${migrationFile}`);
  const sqlText = fs.readFileSync(filePath, 'utf8');

  // Split by GO statements
  const batches = sqlText.split(/^\s*GO\s*$/gim).filter(b => b.trim());

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i].trim();
    if (batch) {
      const preview = batch.replace(/\s+/g, ' ').substring(0, 80);
      console.log(`   └─ Batch ${i + 1}/${batches.length}: ${preview}...`);
      await pool.request().query(batch);
    }
  }

  console.log(`✅ [Migration] Completed file: ${migrationFile}`);
}

async function run() {
  const pool = await new sql.ConnectionPool(config).connect();
  console.log('✅ Connected to SQL Server database:', config.database);

  const argFile = process.argv[2];

  if (argFile) {
    await runFile(pool, argFile);
  } else {
    // Run all files in database/migrations in alphabetical order
    const migrationsDir = path.join(__dirname, 'database', 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    console.log(`\n📦 Found ${files.length} migration file(s) in sequence:`);
    files.forEach(f => console.log(`   - ${f}`));

    for (const file of files) {
      await runFile(pool, file);
    }

    console.log('\n🎉 ALL MIGRATIONS COMPLETED SUCCESSFULLY!');
  }

  await pool.close();
}

run().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
