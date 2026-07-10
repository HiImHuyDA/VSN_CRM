const { getCsrPool } = require('../../src/config/database');
async function run() {
  const pool = await getCsrPool();
  await pool.request().query("UPDATE CSR_Users SET Role = 'BOD' WHERE MNV = 'BOD001'");
  console.log("Updated BOD001 role to BOD");
  process.exit(0);
}
run();
