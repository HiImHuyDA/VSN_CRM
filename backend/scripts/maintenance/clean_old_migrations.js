const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, '../../database/migrations');
const archiveDir = path.join(__dirname, '../../database/migrations_archive');

if (!fs.existsSync(archiveDir)) {
  fs.mkdirSync(archiveDir, { recursive: true });
}

const masterFiles = [
  '01_schema_tables_and_indexes.sql',
  '02_functions_and_views.sql',
  '03_stored_procedures_master.sql',
  '04_seed_initial_data.sql'
];

const files = fs.readdirSync(migrationsDir);
let movedCount = 0;

files.forEach(file => {
  if (file.endsWith('.sql') && !masterFiles.includes(file)) {
    const srcPath = path.join(migrationsDir, file);
    const destPath = path.join(archiveDir, file);
    fs.renameSync(srcPath, destPath);
    movedCount++;
  }
});

console.log(`✅ Moved ${movedCount} old migration files to database/migrations_archive.`);
console.log('Remaining files in database/migrations:');
console.log(fs.readdirSync(migrationsDir));
