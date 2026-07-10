const express = require('express');
const router = express.Router();
const { getCsrPool } = require('../config/database');

// SSE Clients
const clients = new Set();

function sendSseEvent(data) {
  for (let client of clients) {
    client.res.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

// GET /api/notifications/stream
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const client = { res };
  clients.add(client);

  req.on('close', () => {
    clients.delete(client);
  });
});

// GET /api/notifications
router.get('/', async (req, res) => {
  try {
    const pool = await getCsrPool();
    const result = await pool.request()
      .execute('usp_GetNotifications');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/notifications/mark-read
router.put('/mark-read', async (req, res) => {
  try {
    const pool = await getCsrPool();
    await pool.request()
      .execute('usp_MarkNotificationsRead');
    res.json({ message: 'All marked as read' });
  } catch (error) {
    console.error('Error marking notifications read:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = { router, sendSseEvent };
