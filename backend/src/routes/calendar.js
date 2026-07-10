// src/routes/calendar.js — Real-time calendar check (Graph API)
const express = require('express');
const router = express.Router();
const { getAccessToken, getCalendarEvents } = require('../config/sharepoint');

/**
 * POST /api/calendar/check
 * Kiểm tra lịch của phòng họp trong ngày
 * Body: { roomEmail, date }
 */
router.post('/check', async (req, res, next) => {
  try {
    const { roomEmail, date } = req.body;
    if (!roomEmail || !date) {
      return res.status(400).json({ success: false, error: 'Thiếu roomEmail hoặc date' });
    }
    const accessToken = await getAccessToken();
    const events = await getCalendarEvents(roomEmail, new Date(date), accessToken);
    res.json({ success: true, data: events });
  } catch (err) {
    // Lỗi Graph API không nên crash server
    console.warn('⚠️  Calendar API error:', err.message);
    res.json({ success: true, data: [], warning: 'Không thể kiểm tra lịch phòng họp' });
  }
});

module.exports = router;
