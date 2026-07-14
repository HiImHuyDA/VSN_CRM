require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { getCsrPool } = require('../src/config/database');

async function run() {
    const pool = await getCsrPool();
    const r = await pool.query('SELECT TOP 1 * FROM CSR_Tasks');
    console.log('Columns:', Object.keys(r.recordset[0] || {}));
    process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
