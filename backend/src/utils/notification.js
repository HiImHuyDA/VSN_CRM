// src/utils/notification.js
const { getCsrPool, sql } = require('../config/database');

// Import sendSseEvent from notifications route
let sendSseEvent = null;
function setSseEmitter(emitter) {
  sendSseEvent = emitter;
}

async function sendNotification(message, actorMNV, projectId) {
  try {
    const pool = await getCsrPool();
    
    // Insert notification directly into the table
    await pool.request()
      .input('Message', sql.NVarChar(sql.MAX), message)
      .input('ActorMNV', sql.NVarChar(50), actorMNV || null)
      .input('ProjectId', sql.NVarChar(100), projectId ? String(projectId) : null)
      .query(`
        INSERT INTO CSR_Notifications (Message, ActorMNV, ProjectId, IsRead, CreatedAt)
        VALUES (@Message, @ActorMNV, @ProjectId, 0, GETDATE())
      `);

    // Push SSE event to all connected clients
    if (sendSseEvent) {
      sendSseEvent({
        type: 'NEW_NOTIFICATION',
        message: message,
        projectId: projectId,
        actorMNV: actorMNV,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`[Notification] ✅ Sent: ${message}`);
  } catch (error) {
    console.error('[Notification] ❌ Failed to send notification:', error.message);
  }
}

module.exports = {
  sendNotification,
  setSseEmitter
};
