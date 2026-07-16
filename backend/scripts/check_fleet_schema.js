require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { getCsrPool } = require('../src/config/database');

getCsrPool().then(async pool => {
  // Check Fleet_Bookings columns
  const r = await pool.request().query(
    "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Fleet_Bookings' ORDER BY ORDINAL_POSITION"
  );
  console.log('Fleet_Bookings columns:');
  r.recordset.forEach(c => console.log(' -', c.COLUMN_NAME, ':', c.DATA_TYPE));

  // Check current SP definition excerpt
  const spR = await pool.request().query(
    "SELECT TEXT FROM SYSCOMMENTS WHERE ID = OBJECT_ID('usp_Fleet_Booking_GetDetail') ORDER BY COLID"
  );
  if (spR.recordset.length > 0) {
    const fullText = spR.recordset.map(r => r.TEXT).join('');
    // Show key parts
    const attendeeIdx = fullText.toLowerCase().indexOf('attendee');
    if (attendeeIdx !== -1) {
      console.log('\nSP mentions Attendee at idx:', attendeeIdx);
      console.log(fullText.substring(Math.max(0, attendeeIdx - 100), attendeeIdx + 300));
    } else {
      console.log('\nSP does NOT mention Attendees!');
    }
  }

  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
