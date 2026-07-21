const express = require('express');
const router = express.Router();
const { getCsrPool, sql } = require('../config/database');

// GET /api/email-campaigns
router.get('/', async (req, res, next) => {
  try {
    const { purpose, location, customer, isActive, search } = req.query;
    const pool = await getCsrPool();

    let activeBit = null;
    if (isActive !== undefined && isActive !== '') {
      activeBit = (isActive === 'true' || isActive === '1') ? 1 : 0;
    }

    const result = await pool.request()
      .input('Purpose', sql.NVarChar(100), purpose || null)
      .input('Location', sql.NVarChar(100), location || null)
      .input('Customer', sql.NVarChar(200), customer || null)
      .input('IsActive', sql.Bit, activeBit)
      .input('SearchText', sql.NVarChar(200), search || null)
      .execute('usp_EmailTemplate_List');

    res.json({ success: true, data: result.recordset || [] });
  } catch (err) {
    next(err);
  }
});

// GET /api/email-campaigns/brand-projects — Lấy danh sách đơn Brand đã duyệt để test campaign (past & future)
router.get('/brand-projects', async (req, res, next) => {
  try {
    const pool = await getCsrPool();
    const result = await pool.request().execute('usp_EmailCampaign_GetBrandProjects');
    res.json({ success: true, data: result.recordset || [] });
  } catch (err) {
    next(err);
  }
});

// GET /api/email-campaigns/logs — Lấy lịch sử gửi email campaign
router.get('/logs', async (req, res, next) => {
  try {
    const pool = await getCsrPool();
    const result = await pool.request().execute('usp_EmailCampaign_GetLogs');
    res.json({ success: true, data: result.recordset || [] });
  } catch (err) {
    next(err);
  }
});

// GET /api/email-campaigns/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const pool = await getCsrPool();
    const result = await pool.request()
      .input('Id', sql.Int, parseInt(id))
      .execute('usp_EmailTemplate_GetById');

    const template = result.recordset?.[0];
    if (!template) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy mẫu email' });
    }

    res.json({ success: true, data: template });
  } catch (err) {
    next(err);
  }
});

// POST /api/email-campaigns
router.post('/', async (req, res, next) => {
  try {
    const {
      id, purpose, templateName, startDate, endDate, location,
      isAllCustomer, customers, senderName, senderEmail,
      recipientName, recipientEmail, emailSubject, emailBody, isActive
    } = req.body;

    if (!purpose || !templateName || !emailSubject) {
      return res.status(400).json({
        success: false,
        error: 'Thiếu thông tin bắt buộc: purpose, templateName, emailSubject'
      });
    }

    const pool = await getCsrPool();
    const result = await pool.request()
      .input('Id', sql.Int, id || 0)
      .input('Purpose', sql.NVarChar(100), purpose)
      .input('TemplateName', sql.NVarChar(200), templateName)
      .input('StartDate', sql.Date, startDate || null)
      .input('EndDate', sql.Date, endDate || null)
      .input('Location', sql.NVarChar(100), location || null)
      .input('IsAllCustomer', sql.Bit, isAllCustomer ? 1 : 0)
      .input('Customers', sql.NVarChar(sql.MAX), customers ? JSON.stringify(customers) : null)
      .input('SenderName', sql.NVarChar(200), senderName || null)
      .input('SenderEmail', sql.NVarChar(200), senderEmail || null)
      .input('RecipientName', sql.NVarChar(200), recipientName || null)
      .input('RecipientEmail', sql.NVarChar(200), recipientEmail || null)
      .input('EmailSubject', sql.NVarChar(500), emailSubject)
      .input('EmailBody', sql.NVarChar(sql.MAX), emailBody || null)
      .input('IsActive', sql.Bit, isActive !== undefined ? (isActive ? 1 : 0) : 1)
      .execute('usp_UpsertEmailTemplate');

    const newId = result.recordset?.[0]?.NewId;

    res.json({
      success: true,
      message: 'Lưu mẫu email thành công',
      data: { id: newId }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/email-campaigns/:id/copy
router.post('/:id/copy', async (req, res, next) => {
  try {
    const { id } = req.params;
    const pool = await getCsrPool();
    const result = await pool.request()
      .input('SourceId', sql.Int, parseInt(id))
      .execute('usp_CopyEmailTemplate');

    const newId = result.recordset?.[0]?.NewId;

    res.json({
      success: true,
      message: 'Sao chép mẫu email thành công',
      data: { id: newId }
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/email-campaigns/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const pool = await getCsrPool();
    await pool.request()
      .input('Id', sql.Int, parseInt(id))
      .execute('usp_DeleteEmailTemplate');

    res.json({ success: true, message: 'Xóa mẫu email thành công' });
  } catch (err) {
    next(err);
  }
});


// POST /api/email-campaigns/trigger-test — Gửi thử email campaign ngay lập tức
router.post('/trigger-test', async (req, res, next) => {
  try {
    const { projectId, templateId } = req.body;
    if (!projectId) {
      return res.status(400).json({ success: false, error: 'Thiếu mã đơn tiếp đón (projectId)' });
    }
    const { sendSingleCampaignEmail } = require('../utils/campaignScheduler');
    const result = await sendSingleCampaignEmail(projectId, templateId || null);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

