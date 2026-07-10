// src/routes/dashboard.js
// Dashboard trang chủ: chuyến tiếp khách sắp tới, công việc deadline
// Tất cả logic SQL nằm trong [dbo].[usp_Dashboard_GetStats]
const express = require('express');
const router = express.Router();
const { getCsrPool, sql } = require('../config/database');

/**
 * GET /api/dashboard
 * Query params: role, mnv
 * Trả về:
 *  - upcomingTrips: các đơn có ngày tiếp đón trong 14 ngày tới
 *  - pendingTasks: công việc chưa hoàn thành, deadline sắp tới (7 ngày)
 *  - overdueTasks: công việc quá deadline
 *  - recentCompleted: đơn hoàn thành gần đây (30 ngày)
 *  - stats: tổng hợp nhanh
 */
router.get('/', async (req, res, next) => {
  try {
    const { role = '', mnv = '' } = req.query;
    const pool = await getCsrPool();

    const result = await pool.request()
      .input('ActorRole', sql.NVarChar(50), role)
      .input('ActorMNV',  sql.NVarChar(50), mnv)
      .execute('usp_Dashboard_GetStats');

    res.json({
      success: true,
      data: {
        stats:           result.recordsets[0]?.[0] || {},
        byMonth:         result.recordsets[1] || [],
        calendarDates:   result.recordsets[2] || [],
        notifications:   result.recordsets[3] || [],
        monthlyGuests:   result.recordsets[4] || [],
        monthlyTasks:    result.recordsets[5] || []
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
