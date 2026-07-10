const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');
const { getCsrPool, sql } = require('../config/database');
const { processFeedbackInvitations, syncFeedbackResultsFromSharePoint } = require('../utils/feedbackScheduler');

/**
 * GET /api/feedback/invitations
 * Lấy danh sách thư mời khảo sát đánh giá qua Stored Procedure
 */
router.get('/invitations', async (req, res, next) => {
  try {
    const { status, projectId, customerName, host, dateStart, dateEnd } = req.query;
    const pool = await getCsrPool();
    const request = pool.request();

    if (status) {
      request.input('Status', sql.NVarChar(50), status);
    }
    if (projectId) {
      request.input('ProjectId', sql.NVarChar(100), projectId);
    }
    if (customerName) {
      request.input('CustomerName', sql.NVarChar(200), customerName);
    }
    if (host) {
      request.input('Host', sql.NVarChar(200), host);
    }
    if (dateStart && dateStart.trim()) {
      request.input('DateStart', sql.DateTime, new Date(dateStart));
    }
    if (dateEnd && dateEnd.trim()) {
      const end = new Date(dateEnd);
      end.setHours(23, 59, 59, 999);
      request.input('DateEnd', sql.DateTime, end);
    }

    const result = await request.execute('usp_Feedback_Invitation_List');
    res.json({ success: true, data: result.recordset || [] });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/feedback/invitations/resend
 * Gửi lại thư mời: Gia hạn, đổi token mới qua Stored Procedure và đẩy vào SharePoint List
 */
router.post('/invitations/resend', async (req, res, next) => {
  try {
    const { invitationId } = req.body;
    if (!invitationId) {
      return res.status(400).json({ success: false, error: 'Thiếu ID thư mời' });
    }

    const pool = await getCsrPool();
    const newToken = crypto.randomBytes(32).toString('hex');
    const newExpireDate = new Date();
    newExpireDate.setDate(newExpireDate.getDate() + 7); // Gia hạn thêm 7 ngày

    // Gọi Stored Procedure cập nhật và lấy thông tin
    const result = await pool.request()
      .input('InvitationId', sql.Int, invitationId)
      .input('NewToken', sql.NVarChar(128), newToken)
      .input('NewExpireDate', sql.DateTime, newExpireDate)
      .execute('usp_Feedback_Invitation_Resend');

    const inv = result.recordset?.[0];
    if (!inv) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy thư mời' });
    }

    // Parse lấy thông tin khách hàng
    let reps = [];
    try { if (inv.GuestReps) reps = JSON.parse(inv.GuestReps); } catch(e){}
    const rep = reps[inv.VisitorId];
    if (!rep) {
      return res.status(400).json({ success: false, error: 'Không tìm thấy thông tin đại diện tương ứng' });
    }
    if (!rep.email || !rep.email.trim()) {
      return res.status(400).json({ success: false, error: 'Không tìm thấy email của đại diện khách hàng' });
    }

    console.log(`[Feedback API] Resent invitation ${invitationId}. New token generated via SP.`);

    // Đẩy thư mời gửi lại vào SharePoint List hàng đợi CSR_Feedback_Queue
    const { getAccessToken } = require('../config/sharepoint');
    const accessToken = await getAccessToken();
    
    const shareUrl = process.env.SHARE_URL;
    const base64 = Buffer.from(shareUrl).toString('base64');
    const shareId = 'u!' + base64.replace(/=/g, '').replace(/\//g, '_').replace(/\+/g, '-');
    const shareItemUrl = `https://graph.microsoft.com/v1.0/shares/${shareId}/driveItem`;
    const resSite = await axios.get(shareItemUrl, { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 8000 });
    const siteId = resSite.data.parentReference.siteId;

    const powerPagesUrl = process.env.POWER_PAGES_FEEDBACK_URL || 'https://feedback.company.com/feedback';
    const meetingDateStr = inv.SubmitDate 
      ? new Date(inv.SubmitDate).toLocaleDateString('vi-VN')
      : new Date().toLocaleDateString('vi-VN');

    const itemPayload = {
      fields: {
        Title: `Resend feedback invitation for ${rep.name}`,
        ProjectId: inv.ProjectId,
        Token: newToken,
        VisitorEmail: rep.email.trim(),
        VisitorName: rep.name.trim(),
        HostName: inv.SubmitterName,
        MeetingDate: meetingDateStr,
        FeedbackUrl: `${powerPagesUrl}?token=${newToken}`
      }
    };

    const queueListName = process.env.SHAREPOINT_FEEDBACK_QUEUE_LIST || 'CSR_Feedback_Queue';
    const addUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${queueListName}/items`;
    try {
      await axios.post(addUrl, itemPayload, {
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        timeout: 8000
      });
    } catch (apiErr) {
      if (apiErr.response && apiErr.response.status === 404) {
        return res.status(404).json({ 
          success: false, 
          error: `Không tìm thấy danh sách '${queueListName}' trên SharePoint. Vui lòng liên hệ Admin để kiểm tra cấu hình.` 
        });
      }
      throw apiErr;
    }

    res.json({ success: true, message: 'Đã gửi lại thư mời thành công' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/feedback/invitations/cancel
 * Hủy chủ động thư mời đánh giá qua Stored Procedure
 */
router.post('/invitations/cancel', async (req, res, next) => {
  try {
    const { invitationId } = req.body;
    if (!invitationId) {
      return res.status(400).json({ success: false, error: 'Thiếu ID thư mời' });
    }

    const pool = await getCsrPool();
    const result = await pool.request()
      .input('InvitationId', sql.Int, invitationId)
      .execute('usp_Feedback_Invitation_Cancel');

    const rowsAffected = result.recordset?.[0]?.RowsAffected || 0;
    if (rowsAffected === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy thư mời để hủy' });
    }

    res.json({ success: true, message: 'Đã hủy thư mời thành công' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/feedback/responses
 * Lấy danh sách kết quả đánh giá (Feedback) từ khách hàng qua Stored Procedure
 */
router.get('/responses', async (req, res, next) => {
  try {
    const { rating, customerName, host, dateStart, dateEnd } = req.query;
    const pool = await getCsrPool();
    const request = pool.request();

    if (rating) {
      request.input('Rating', sql.Int, parseInt(rating));
    }
    if (customerName) {
      request.input('CustomerName', sql.NVarChar(200), customerName);
    }
    if (host) {
      request.input('Host', sql.NVarChar(200), host);
    }
    if (dateStart && dateStart.trim()) {
      request.input('DateStart', sql.DateTime, new Date(dateStart));
    }
    if (dateEnd && dateEnd.trim()) {
      const end = new Date(dateEnd);
      end.setHours(23, 59, 59, 999);
      request.input('DateEnd', sql.DateTime, end);
    }

    const result = await request.execute('usp_Feedback_Response_List');
    res.json({ success: true, data: result.recordset || [] });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/feedback/trigger-cron-manually
 * API kích hoạt thủ công quét và gửi thư mời đánh giá
 */
router.post('/trigger-cron-manually', async (req, res, next) => {
  try {
    await processFeedbackInvitations();
    res.json({ success: true, message: 'Đã kích hoạt quét thủ công thành công' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/feedback/trigger-sync-manually
 * API quét và đồng bộ kết quả đánh giá từ SharePoint về SQL Server thủ công
 */
router.post('/trigger-sync-manually', async (req, res, next) => {
  try {
    await syncFeedbackResultsFromSharePoint();
    res.json({ success: true, message: 'Đã quét và đồng bộ kết quả đánh giá thành công' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
