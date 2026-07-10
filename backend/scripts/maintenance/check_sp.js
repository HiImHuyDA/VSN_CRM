const { getCsrPool } = require('./src/config/database');
async function run() {
  const pool = await getCsrPool();
  const res = await pool.request().query("SELECT OBJECT_DEFINITION(OBJECT_ID('usp_GetAllUsers')) AS definition");
  console.log(res.recordset[0].definition);
  process.exit(0);
}
run();
