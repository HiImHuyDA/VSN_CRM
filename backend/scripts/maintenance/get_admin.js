const { getCsrPool } = require('../../src/config/database');
async function run() {
  const pool = await getCsrPool();
  const res = await pool.request().query("SELECT * FROM CSR_Users WHERE Role = 'admin' OR Role = 'Admin'");
  console.table(res.recordset);
  
  const bodRes = await pool.request().query("SELECT * FROM CSR_Users WHERE Department = 'BOD'");
  console.table(bodRes.recordset);
  process.exit(0);
}
run();
