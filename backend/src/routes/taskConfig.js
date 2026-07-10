// src/routes/taskConfig.js — Thin proxy: gọi usp_TaskConfig_GetDefaultsByDestinations
const express = require('express');
const router = express.Router();
const { getCsrPool, sql } = require('../config/database');
const STATIC = require('../data/staticConfig');

// GET /api/task-config?destinations=VSN OFFICE,VDC
router.get('/', async (req, res, next) => {
  try {
    const { destinations = '' } = req.query;
    if (!destinations.trim()) {
      return res.status(400).json({ success: false, error: 'Thiếu destinations' });
    }
    const pool = await getCsrPool();
    const result = await pool.request()
      .input('Destinations', sql.NVarChar(sql.MAX), destinations)
      .execute('usp_TaskConfig_GetDefaultsByDestinations');

    // Group theo RequestedDestination để FE dễ dùng
    const grouped = {};
    for (const row of result.recordset) {
      const dest = row.RequestedDestination;
      if (!grouped[dest]) grouped[dest] = [];
      grouped[dest].push(row);
    }
    res.json({ success: true, data: grouped });
  } catch (err) {
    next(err);
  }
});

// GET /api/task-config/lists — Tất cả dropdown lists (static)
router.get('/lists', (req, res) => {
  res.json({
    success: true,
    data: {
      destinationList:   STATIC.destinationList,
      customerNames:     STATIC.customerNames,
      partnerNames:      STATIC.partnerNames,
      lunchList:         STATIC.lunchList,
      dinnerList:        STATIC.dinnerList,
      meetingRooms:      STATIC.meetingRoom,
      meetingRoomEmails: STATIC.meetingRoomEmails,
    },
  });
});

module.exports = router;
