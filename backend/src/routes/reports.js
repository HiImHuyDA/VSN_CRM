// src/routes/reports.js
// Báo cáo & thống kê — chỉ dành cho BOD, PRD, Admin
const express = require('express');
const router = express.Router();
const { getCsrPool, sql } = require('../config/database');

/**
 * GET /api/reports/filters
 * Lấy các tuỳ chọn bộ lọc (slicers)
 */
router.get('/filters', async (req, res, next) => {
  try {
    const pool = await getCsrPool();
    const result = await pool.request().execute('usp_GetFilterOptions');

    res.json({
      success: true,
      data: {
        years: result.recordsets[0] || [],
        months: result.recordsets[1] || [],
        weeks: result.recordsets[2] || [],
        customerTypes: result.recordsets[3] || [],
        customerNames: result.recordsets[4] || [],
        destinations: result.recordsets[5] || [],
        departments: result.recordsets[6] || [],
        projectStatuses: result.recordsets[7] || []
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/reports/summary
 * Tab Thống kê tiếp đón: KPI cards & Charts
 */
router.get('/summary', async (req, res, next) => {
  try {
    const {
      year = null,
      month = null,
      week = null,
      customerType = null,
      customerName = null,
      destination = null,
      department = null,
      projectStatus = null,
      taskStatus = null
    } = req.query;

    const pool = await getCsrPool();
    const result = await pool.request()
      .input('Year', sql.NVarChar(500), year || null)
      .input('Month', sql.NVarChar(500), month || null)
      .input('Week', sql.NVarChar(500), week || null)
      .input('CustomerType', sql.NVarChar(sql.MAX), customerType || null)
      .input('CustomerName', sql.NVarChar(sql.MAX), customerName || null)
      .input('Destination', sql.NVarChar(sql.MAX), destination || null)
      .input('Department', sql.NVarChar(sql.MAX), department || null)
      .input('ProjectStatus', sql.NVarChar(500), projectStatus || null)
      .input('TaskStatus', sql.NVarChar(500), taskStatus || null)
      .execute('usp_GetReportsSummary');

    res.json({
      success: true,
      data: {
        kpi: result.recordsets[0]?.[0] || {},
        trendByOnboardDate: result.recordsets[1] || [],
        byDepartment: result.recordsets[2] || [],
        byLocation: result.recordsets[3] || [],
        byStatus: result.recordsets[4] || [],
        topCustomers: result.recordsets[5] || [],
        detailsTable: result.recordsets[6] || []
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/reports/review
 * Tab Đánh giá khách hàng
 */
router.get('/review', async (req, res, next) => {
  try {
    const {
      year = null,
      month = null,
      week = null,
      customerType = null,
      customerName = null,
      destination = null,
      department = null,
      projectStatus = null,
      taskStatus = null
    } = req.query;

    const pool = await getCsrPool();
    const result = await pool.request()
      .input('Year', sql.NVarChar(500), year || null)
      .input('Month', sql.NVarChar(500), month || null)
      .input('Week', sql.NVarChar(500), week || null)
      .input('CustomerType', sql.NVarChar(sql.MAX), customerType || null)
      .input('CustomerName', sql.NVarChar(sql.MAX), customerName || null)
      .input('Destination', sql.NVarChar(sql.MAX), destination || null)
      .input('Department', sql.NVarChar(sql.MAX), department || null)
      .input('ProjectStatus', sql.NVarChar(500), projectStatus || null)
      .input('TaskStatus', sql.NVarChar(500), taskStatus || null)
      .execute('usp_GetReportsReview');

    res.json({
      success: true,
      data: {
        kpi: result.recordsets[0]?.[0] || {},
        byCriteria: result.recordsets[1] || [],
        byDestination: result.recordsets[2] || [],
        commentsTable: result.recordsets[3] || []
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/reports/progress
 * Tab Tiến độ công việc
 */
router.get('/progress', async (req, res, next) => {
  try {
    const {
      year = null,
      month = null,
      week = null,
      customerType = null,
      customerName = null,
      destination = null,
      department = null,
      projectStatus = null,
      taskStatus = null
    } = req.query;

    const pool = await getCsrPool();
    const result = await pool.request()
      .input('Year', sql.NVarChar(500), year || null)
      .input('Month', sql.NVarChar(500), month || null)
      .input('Week', sql.NVarChar(500), week || null)
      .input('CustomerType', sql.NVarChar(sql.MAX), customerType || null)
      .input('CustomerName', sql.NVarChar(sql.MAX), customerName || null)
      .input('Destination', sql.NVarChar(sql.MAX), destination || null)
      .input('Department', sql.NVarChar(sql.MAX), department || null)
      .input('ProjectStatus', sql.NVarChar(500), projectStatus || null)
      .input('TaskStatus', sql.NVarChar(500), taskStatus || null)
      .execute('usp_GetReportsProgress');

    res.json({
      success: true,
      data: {
        submissionProgress: result.recordsets[0]?.[0] || {},
        taskProgress: result.recordsets[1]?.[0] || {},
        departmentProgress: result.recordsets[2] || []
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
