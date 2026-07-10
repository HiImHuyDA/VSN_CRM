// src/routes/reviewCriteria.js
// CRUD Tiêu chí đánh giá & Gửi/Lấy đánh giá khách hàng
const express = require('express');
const router = express.Router();
const { getCsrPool, sql } = require('../config/database');

/**
 * GET /api/review-criteria
 * Lấy danh sách tiêu chí đánh giá
 */
router.get('/', async (req, res, next) => {
  try {
    const { onlyActive = 'true' } = req.query;
    const pool = await getCsrPool();

    const result = await pool.request()
      .input('OnlyActive', sql.Bit, onlyActive === 'true' ? 1 : 0)
      .execute('usp_GetReviewCriteria');

    res.json({
      success: true,
      data: result.recordset || []
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/review-criteria
 * Thêm mới hoặc cập nhật tiêu chí đánh giá
 */
router.post('/', async (req, res, next) => {
  try {
    const { id, criteriaName, description, criteriaGroup, sortOrder, isRequired, isActive } = req.body;
    
    if (!criteriaName || !criteriaGroup) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp đầy đủ tên và nhóm tiêu chí.'
      });
    }

    const pool = await getCsrPool();
    const result = await pool.request()
      .input('Id', sql.Int, id ? parseInt(id) : null)
      .input('CriteriaName', sql.NVarChar(200), criteriaName)
      .input('Description', sql.NVarChar(500), description || null)
      .input('CriteriaGroup', sql.NVarChar(100), criteriaGroup)
      .input('SortOrder', sql.Int, sortOrder ? parseInt(sortOrder) : 0)
      .input('IsRequired', sql.Bit, isRequired ? 1 : 0)
      .input('IsActive', sql.Bit, isActive !== false ? 1 : 0)
      .execute('usp_UpsertReviewCriteria');

    res.json({
      success: true,
      data: result.recordset?.[0] || {}
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/review-criteria/submit
 * Khách hàng gửi đánh giá cho dự án
 */
router.post('/submit', async (req, res, next) => {
  try {
    const { projectId, reviewerName, reviews } = req.body;

    if (!projectId || !reviews || !Array.isArray(reviews)) {
      return res.status(400).json({
        success: false,
        error: 'Dữ liệu đánh giá không hợp lệ. Yêu cầu projectId và mảng reviews.'
      });
    }

    const pool = await getCsrPool();
    const result = await pool.request()
      .input('ProjectId', sql.NVarChar(100), projectId)
      .input('ReviewerName', sql.NVarChar(200), reviewerName || null)
      .input('ReviewsJson', sql.NVarChar(sql.MAX), JSON.stringify(reviews))
      .execute('usp_SubmitReviews');

    res.json({
      success: true,
      data: result.recordset?.[0] || {}
    });
  } catch (err) {
    next(err);
  }
});

const axios = require('axios');
const { getAccessToken } = require('../config/sharepoint');

function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') return unsafe || '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * GET /api/review-criteria/project/:projectId
 * Lấy đánh giá đã gửi của 1 dự án
 */
router.get('/project/:projectId', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const pool = await getCsrPool();

    const result = await pool.request()
      .input('ProjectId', sql.NVarChar(100), projectId)
      .execute('usp_GetProjectReviews');

    res.json({
      success: true,
      data: result.recordset || []
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/review-criteria/send-ms-form
 * Tạo & gửi form khảo sát Microsoft Forms cho dự án
 */
router.post('/send-ms-form', async (req, res, next) => {
  try {
    const { projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp mã đơn tiếp đón (projectId).'
      });
    }

    const pool = await getCsrPool();
    
    // 1. Lấy chi tiết đơn
    const projectRes = await pool.request()
      .input('ProjectId', sql.NVarChar(100), projectId)
      .execute('usp_Submission_GetDetail');
    
    const project = projectRes.recordsets[0]?.[0];
    if (!project) {
      return res.status(404).json({
        success: false,
        error: `Không tìm thấy thông tin đơn tiếp đón với mã ${projectId}.`
      });
    }

    // 2. Phân giải danh sách người nhận (To - representatives)
    const toEmails = new Set();
    if (project.GuestReps) {
      try {
        const reps = JSON.parse(project.GuestReps);
        if (Array.isArray(reps)) {
          reps.forEach(r => {
            const email = r.email ? r.email.trim().toLowerCase() : '';
            if (email.includes('@')) {
              toEmails.add(email);
            }
          });
        }
      } catch (e) {
        console.error('[Send MS Form] Error parsing GuestReps:', e.message);
      }
    }

    if (toEmails.size === 0) {
      return res.status(400).json({
        success: false,
        error: 'Đơn tiếp khách này không có thông tin email đại diện khách hàng để gửi khảo sát.'
      });
    }

    // 3. Phân giải danh sách nhận CC (Submitter + PRD Users)
    const ccEmails = new Set();
    if (project.SubmitterEmail) {
      ccEmails.add(project.SubmitterEmail.trim().toLowerCase());
    }

    // Lấy danh sách PRD active
    const prdRes = await pool.request()
      .execute('usp_GetPRDUsersEmails');
    if (prdRes.recordset) {
      prdRes.recordset.forEach(user => {
        const email = user.Email ? user.Email.trim().toLowerCase() : '';
        if (email.includes('@')) {
          ccEmails.add(email);
        }
      });
    }

    // Loại bỏ người nhận chính khỏi danh sách CC
    toEmails.forEach(e => ccEmails.delete(e));

    const toRecipients = Array.from(toEmails).map(email => ({
      emailAddress: { address: email }
    }));
    const ccRecipients = Array.from(ccEmails).map(email => ({
      emailAddress: { address: email }
    }));

    // 4. Sinh link khảo sát trực tiếp trên hệ thống
    const rawFrontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const baseFrontendUrl = rawFrontendUrl.split(',')[0].trim();
    const surveyLink = `${baseFrontendUrl}/public/evaluation/${projectId}`;

    // 5. Gửi thư qua Graph API
    const senderEmail = process.env.SENDER_EMAIL;
    if (!senderEmail) {
      return res.status(500).json({
        success: false,
        error: 'Hệ thống chưa cấu hình SENDER_EMAIL trong môi trường.'
      });
    }

    const accessToken = await getAccessToken();
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333333; margin: 0; padding: 0; background-color: #f4f6f9; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05); border: 1px solid #e1e4e8; }
    .header { background: linear-gradient(135deg, #0078d4, #005a9e); padding: 30px 20px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 600; letter-spacing: 0.5px; }
    .content { padding: 30px 25px; }
    .content p { margin: 0 0 15px 0; font-size: 15px; color: #444444; }
    .project-info { background-color: #f8f9fa; border-left: 4px solid #0078d4; padding: 15px; margin: 20px 0; border-radius: 0 4px 4px 0; }
    .project-info-item { margin-bottom: 8px; font-size: 14px; }
    .project-info-item:last-child { margin-bottom: 0; }
    .project-info-label { font-weight: bold; color: #555555; display: inline-block; width: 140px; }
    .btn-container { text-align: center; margin: 30px 0 15px 0; }
    .btn { display: inline-block; padding: 12px 30px; font-size: 16px; font-weight: bold; color: #ffffff !important; background-color: #0078d4; text-decoration: none; border-radius: 4px; transition: background-color 0.2s; box-shadow: 0 2px 4px rgba(0,120,212,0.2); }
    .btn:hover { background-color: #005a9e; }
    .footer { background-color: #fafbfc; padding: 20px; text-align: center; font-size: 12px; color: #888888; border-top: 1px solid #eeeeee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Khảo sát Đánh giá Dịch vụ Tiếp đón</h1>
    </div>
    <div class="content">
      <p>Kính chào Quý khách,</p>
      <p>Lời đầu tiên, chúng tôi xin chân thành cảm ơn Quý khách đã dành thời gian ghé thăm và làm việc tại văn phòng của chúng tôi.</p>
      <p>Để không ngừng nâng cao chất lượng dịch vụ đón tiếp và mang lại những trải nghiệm tốt nhất cho Quý khách trong những lần hợp tác tiếp theo, chúng tôi rất mong nhận được những ý kiến đóng góp quý báu của Quý khách thông qua biểu mẫu đánh giá dưới đây.</p>
      
      <div class="project-info">
        <div class="project-info-item"><span class="project-info-label">Khách hàng:</span> <span>\${escapeHtml(project.CustomerName || '—')}</span></div>
        <div class="project-info-item"><span class="project-info-label">Nội dung tiếp đón:</span> <span>\${escapeHtml(project.MeetingTopic || '—')}</span></div>
        <div class="project-info-item"><span class="project-info-label">Mã đơn tiếp đón:</span> <span>\${escapeHtml(project.Project_id)}</span></div>
      </div>
      
      <div class="btn-container">
        <a href="\${surveyLink}" class="btn" style="color: #ffffff; text-decoration: none;" target="_blank">Bắt đầu Đánh giá</a>
      </div>
      
      <p style="font-size: 13px; color: #666666; margin-top: 20px;">Biểu mẫu khảo sát chỉ mất khoảng 2-3 phút để hoàn thành. Mọi phản hồi của Quý khách sẽ được bảo mật hoàn toàn.</p>
    </div>
    <div class="footer">
      <p>Email này được gửi tự động từ Hệ thống Quản lý Đón tiếp Khách hàng (CSR CRM).</p>
      <p>&copy; \${new Date().getFullYear()} CSR. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

    const sendMailUrl = `https://graph.microsoft.com/v1.0/users/\${senderEmail}/sendMail`;
    const mailPayload = {
      message: {
        subject: `CRM-Survey: Đánh giá dịch vụ tiếp đón đoàn khách \${project.CustomerName}`,
        body: {
          contentType: 'HTML',
          content: htmlBody
        },
        toRecipients,
        ccRecipients
      },
      saveToSentItems: 'true'
    };

    await axios.post(sendMailUrl, mailPayload, {
      headers: {
        Authorization: `Bearer \${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    res.json({
      success: true,
      message: `Khảo sát dịch vụ tiếp đón đã được gửi thành công tới ${Array.from(toEmails).join(', ')}`,
      data: {
        surveyLink,
        to: Array.from(toEmails),
        cc: Array.from(ccEmails)
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/review-criteria/forms
 * Lấy danh sách biểu mẫu cấu hình đánh giá kèm số tiêu chí
 */
router.get('/forms', async (req, res, next) => {
  try {
    const { search = '', isActive } = req.query;
    const pool = await getCsrPool();

    let activeBit = null;
    if (isActive !== undefined && isActive !== '') {
      activeBit = (isActive === 'true' || isActive === '1') ? 1 : 0;
    }

    const result = await pool.request()
      .input('SearchText', sql.NVarChar(200), search || null)
      .input('IsActive',   sql.Bit,           activeBit)
      .execute('usp_GetEvaluationForms');

    res.json({
      success: true,
      data: result.recordset || []
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/review-criteria/forms/:id
 * Chi tiết biểu mẫu và danh sách tiêu chí
 */
router.get('/forms/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const pool = await getCsrPool();

    // Lấy thông tin form và tiêu chí qua SP
    const result = await pool.request()
      .input('FormId', sql.Int, parseInt(id))
      .execute('usp_GetEvaluationFormDetail');

    const form = result.recordsets[0]?.[0];
    if (!form) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy biểu mẫu' });
    }

    const criteria = result.recordsets[1] || [];

    res.json({
      success: true,
      data: {
        ...form,
        criteria
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/review-criteria/forms
 * Thêm mới hoặc chỉnh sửa biểu mẫu đánh giá kèm danh sách tiêu chí
 */
router.post('/forms', async (req, res, next) => {
  let transaction;
  try {
    const {
      id, formName, sendToCustomer, sendToPrd, sendToSubmitter, sendToBod,
      isActive, criteria = []
    } = req.body;

    if (!formName || !formName.trim()) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập tên biểu mẫu' });
    }

    const pool = await getCsrPool();
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    // 1. Lưu thông tin chung của biểu mẫu
    const formReq = transaction.request()
      .input('Id',               sql.Int,          id || 0)
      .input('FormName',         sql.NVarChar(200),formName)
      .input('SendToCustomer',   sql.Bit,          sendToCustomer ? 1 : 0)
      .input('SendToPrd',        sql.Bit,          sendToPrd ? 1 : 0)
      .input('SendToSubmitter',   sql.Bit,          sendToSubmitter ? 1 : 0)
      .input('SendToBod',        sql.Bit,          sendToBod ? 1 : 0)
      .input('IsActive',         sql.Bit,          isActive !== false ? 1 : 0);

    const formResult = await formReq.execute('usp_UpsertEvaluationForm');
    const formId = formResult.recordset?.[0]?.FormId;

    if (!formId) {
      throw new Error('Lỗi khi lưu biểu mẫu đánh giá');
    }

    // 2. Đồng bộ các tiêu chí (criteria)
    const incomingIds = criteria.map(c => c.id).filter(cid => cid > 0);
    
    // Nếu là chế độ cập nhật, ta cần dọn dẹp các tiêu chí bị xoá
    if (id > 0) {
      const currentRes = await transaction.request()
        .input('FormId', sql.Int, formId)
        .execute('usp_GetEvaluationCriteriaIds');
      
      const dbIds = currentRes.recordset.map(r => r.Id);
      const toDelete = dbIds.filter(dbId => !incomingIds.includes(dbId));
      
      for (const delId of toDelete) {
        await transaction.request()
          .input('CriteriaId', sql.Int, delId)
          .execute('usp_DeleteEvaluationCriteria');
      }
    }

    // Insert hoặc Update từng tiêu chí qua SP
    for (const c of criteria) {
      await transaction.request()
        .input('Id',            sql.Int,          c.id || 0)
        .input('FormId',        sql.Int,          formId)
        .input('CriteriaName',  sql.NVarChar(200),c.criteriaName)
        .input('Description',   sql.NVarChar(500),c.description || null)
        .input('CriteriaGroup', sql.NVarChar(100),c.criteriaGroup || 'Tổng hợp')
        .input('SortOrder',     sql.Int,          c.sortOrder || 0)
        .input('IsRequired',    sql.Bit,          c.isRequired ? 1 : 0)
        .input('IsActive',      sql.Bit,          1)
        .execute('usp_UpsertReviewCriteria');
    }

    await transaction.commit();

    // Đồng bộ đẩy cấu hình tiêu chí lên Cloud Database nếu kích hoạt
    const { pushCriteriaToCloud } = require('../utils/cloudSyncScheduler');
    pushCriteriaToCloud(formId).catch(err => {
      console.error('[Cloud Sync] Fail to trigger dynamic push on save:', err.message);
    });

    res.json({ success: true, message: 'Lưu cấu hình biểu mẫu và tiêu chí thành công', data: { id: formId } });
  } catch (err) {
    if (transaction) await transaction.rollback();
    next(err);
  }
});

/**
 * POST /api/review-criteria/forms/:id/toggle
 * Ngưng hoạt động / Kích hoạt nhanh biểu mẫu
 */
router.post('/forms/:id/toggle', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const pool = await getCsrPool();
    await pool.request()
      .input('Id', sql.Int, parseInt(id))
      .input('IsActive', sql.Bit, isActive ? 1 : 0)
      .execute('usp_ToggleEvaluationForm');

    // Đồng bộ trạng thái mới lên Cloud Database nếu kích hoạt
    const { pushCriteriaToCloud } = require('../utils/cloudSyncScheduler');
    pushCriteriaToCloud(id).catch(err => {
      console.error('[Cloud Sync] Fail to trigger dynamic push on toggle:', err.message);
    });

    res.json({ success: true, message: 'Đã cập nhật trạng thái biểu mẫu' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/review-criteria/sync-status
 * Lấy log đồng bộ Cloud gần nhất
 */
router.get('/sync-status', async (req, res, next) => {
  try {
    const { getSyncLog } = require('../utils/cloudSyncScheduler');
    res.json({ success: true, log: getSyncLog() });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/review-criteria/sync-now
 * Kích hoạt đồng bộ feedback từ Cloud ngay lập tức
 */
router.post('/sync-now', async (req, res, next) => {
  try {
    const { triggerCloudSync } = require('../utils/cloudSyncScheduler');
    const result = await triggerCloudSync();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
