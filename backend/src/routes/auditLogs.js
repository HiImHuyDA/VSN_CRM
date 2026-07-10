const express = require('express');
const router = express.Router();
const { getCsrPool, sql } = require('../config/database');
const authenticateToken = require('../middleware/auth');
const authorizeRoles = require('../middleware/authorize');


/**
 * GET /api/audit-logs
 * Params: mnv, department, role, action, startDate, endDate
 */
router.get('/', authenticateToken, authorizeRoles('Admin'), async (req, res, next) => {
  try {
    const { mnv, department, action, startDate, endDate } = req.query;

    const pool = await getCsrPool();

    const request = pool.request();
    if (mnv) request.input('MNV', sql.NVarChar(50), mnv);
    if (department) request.input('Department', sql.NVarChar(100), department);
    if (action) request.input('Action', sql.NVarChar(100), action);
    if (startDate) request.input('StartDate', sql.DateTime, new Date(startDate));
    if (endDate) request.input('EndDate', sql.DateTime, new Date(endDate));

    const result = await request.execute('usp_GetAuditLogs');

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
