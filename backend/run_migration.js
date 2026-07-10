// run_migration.js — Chạy 1 lần để fix OnboardDates format
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

async function run() {
  const pool = await new sql.ConnectionPool(config).connect();
  console.log('Connected to SQL Server');

  const migrationFile = process.argv[2];
  if (!migrationFile) {
    console.error('Usage: node run_migration.js <migration_file_name.sql>');
    process.exit(1);
  }

  console.log('Running migration file:', migrationFile);
  const sqlText = fs.readFileSync(
    path.join(__dirname, 'database', 'migrations', migrationFile),
    'utf8'
  );


  // Split by GO statements
  const batches = sqlText.split(/^\s*GO\s*$/gim).filter(b => b.trim());

  for (const batch of batches) {
    if (batch.trim()) {
      console.log('Running batch:', batch.trim().substring(0, 80) + '...');
      await pool.request().query(batch);
    }
  }

  console.log('Migration completed!');
  await pool.close();
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
