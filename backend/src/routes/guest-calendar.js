// src/routes/guest-calendar.js
// API endpoint cho màn hình "Theo dõi lịch tiếp khách"
// Tất cả logic SQL nằm trong [dbo].[usp_GetGuestCalendar]
const express = require('express');
const router = express.Router();
const { getCsrPool, sql } = require('../config/database');

/**
 * GET /api/guest-calendar?month=2026-06
 * Trả danh sách tất cả đơn có ngày tiếp đón trong tháng được chọn.
 * Chỉ lấy các đơn có status đã duyệt / đang xử lý (không lấy đã huỷ, từ chối).
 */
router.get('/', async (req, res, next) => {
  try {
    const { month } = req.query; // format: YYYY-MM
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ success: false, error: 'Tham số month không hợp lệ (YYYY-MM)' });
    }

    const [year, mon] = month.split('-').map(Number);

    // Tính ngày đầu và cuối tháng dưới dạng string yyyy-MM-dd
    // Không dùng JS Date object để tránh timezone shift khi truyền vào sql.Date
    const lastDay = new Date(year, mon, 0).getDate(); // day 0 of next month = last day of current month
    const startDateStr = `${year}-${String(mon).padStart(2, '0')}-01`;
    const endDateStr   = `${year}-${String(mon).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const pool = await getCsrPool();
    const result = await pool.request()
      .input('StartDate', sql.NVarChar(10), startDateStr)
      .input('EndDate',   sql.NVarChar(10), endDateStr)
      .execute('usp_GetGuestCalendar');

    // Group by date for calendar view
    const events = {};
    // Use a Map for projects to accumulate multiple onboard dates (multi-day submissions)
    const projectMap = new Map();

    for (const row of result.recordset) {
      // OnboardDate is already a string "yyyy-MM-dd" from SQL CONVERT(…, 23)
      // No timezone parsing needed
      const dateKey = row.OnboardDate || null;

      // Calendar events: one entry per date per project
      if (dateKey) {
        if (!events[dateKey]) events[dateKey] = [];
        events[dateKey].push({
          projectId: row.Project_id,
          customerName: row.CustomerName,
          destination: row.Destination,
          status: row.Status,
          meetingTopic: row.MeetingTopic,
        });
      }

      // Submission table: one row per project, collect all dates and destinations
      if (!projectMap.has(row.Project_id)) {
        projectMap.set(row.Project_id, {
          projectId: row.Project_id,
          customerName: row.CustomerName,
          customerType: row.CustomerType,
          meetingTopic: row.MeetingTopic,
          submitterName: row.SubmitterName,
          status: row.Status,
          createdAt: row.CreatedAt,
          onboardDates: dateKey ? [dateKey] : [],
          destinations: row.Destination ? [row.Destination] : [],
        });
      } else {
        const existing = projectMap.get(row.Project_id);
        if (dateKey && !existing.onboardDates.includes(dateKey)) {
          existing.onboardDates.push(dateKey);
        }
        if (row.Destination && !existing.destinations.includes(row.Destination)) {
          existing.destinations.push(row.Destination);
        }
      }
    }

    // Convert project map to array
    const submissions = Array.from(projectMap.values()).map(p => ({
      ...p,
      onboardDate: p.onboardDates.sort()[0] || null,
      onboardDates: p.onboardDates.sort().join(', '),
      destination: p.destinations.sort().join(', '),
    }));

    res.json({
      success: true,
      data: { events, submissions }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
