// src/routes/submissions.js
// Thin proxy: chỉ nhận request → gọi Stored Procedure → trả JSON
// KHÔNG có business logic tại đây
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const { getCsrPool, sql } = require('../config/database');
const { logAuditAction } = require('../utils/auditLogger');
const { sendNotification } = require('../utils/notification');
const { sendBODApprovalToSharePointQueue } = require('../utils/bodApprovalSync');
const {
  handleBODApprovalActions,
  handleProjectEditNotification,
  handleProjectCancelNotification,
  cancelPendingScheduledEmails
} = require('../utils/approvalNotification');

/**
 * GET /api/submissions
 * Lấy danh sách đơn (từ vw_SubmissionSummary qua usp_Submission_List)
 */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { search = '', status = '', page = 1, pageSize = 20, role = '', mnv = '', tab = 'tracking' } = req.query;
    const pool = await getCsrPool();

    const result = await pool.request()
      .input('SearchText', sql.NVarChar(200), search)
      .input('Status', sql.NVarChar(50), status)
      .input('ActorRole', sql.NVarChar(50), role)
      .input('ActorMNV', sql.NVarChar(50), mnv)
      .input('PageNumber', sql.Int, parseInt(page))
      .input('PageSize', sql.Int, parseInt(pageSize))
      .input('Tab', sql.NVarChar(50), tab)
      .execute('usp_Submission_List');

    const submissions = result.recordsets[0] || [];
    const totalCount = result.recordsets[1]?.[0]?.TotalCount ?? 0;

    res.json({
      success: true,
      data: submissions,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: totalCount,
        totalPages: Math.ceil(totalCount / parseInt(pageSize)),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/submissions/teams-action
 * Xử lý click từ nút bấm duyệt/từ chối trên MS Teams
 * PHẢI đặt trước /:projectId để Express không nhầm 'teams-action' thành projectId
 */
router.get('/teams-action', authenticateToken, async (req, res, next) => {
  try {
    const { projectId, action, actorRole, actorName } = req.query;
    if (!projectId || !action) {
      return res.status(400).send('<h1>Thiếu tham số bắt buộc</h1>');
    }

    const pool = await getCsrPool();
    let resultMessage = '';

    if (action === 'approve') {
      const result = await pool.request()
        .input('ProjectId', sql.NVarChar(100), projectId)
        .input('ActorRole', sql.NVarChar(50), actorRole || 'BOD')
        .input('ActorMNV', sql.NVarChar(50), 'TEAMS_SYSTEM')
        .input('ActorName', sql.NVarChar(200), actorName || 'BOD Member via Teams')
        .input('ActorEmail', sql.NVarChar(200), null)
        .input('Note', sql.NVarChar(sql.MAX), 'Được duyệt nhanh qua Microsoft Teams')
        .execute('usp_ApproveSubmission');

      const row = result.recordset?.[0];
      await logAuditAction('Phê duyệt đơn', 'TEAMS_SYSTEM', `Duyệt đơn qua MS Teams`, projectId);
      await sendNotification(`Đơn ${projectId} đã được phê duyệt bởi BOD (qua Teams)`, 'TEAMS_SYSTEM', projectId);

      if (row?.NewStatus === 'BOD đã duyệt') {
        await syncNewCustomerReps(projectId, pool);
        handleBODApprovalActions(projectId, pool).catch(err => {
          console.error('[Teams Approval Workflow] ❌ Background BOD workflows failed:', err);
        });
      }

      resultMessage = `Đơn ${projectId} đã được PHÊ DUYỆT thành công. Trạng thái mới: ${row?.NewStatus}`;
    } else if (action === 'reject') {
      const result = await pool.request()
        .input('ProjectId', sql.NVarChar(100), projectId)
        .input('ActorRole', sql.NVarChar(50), actorRole || 'BOD')
        .input('ActorMNV', sql.NVarChar(50), 'TEAMS_SYSTEM')
        .input('ActorName', sql.NVarChar(200), actorName || 'BOD Member via Teams')
        .input('ActorEmail', sql.NVarChar(200), null)
        .input('Reason', sql.NVarChar(sql.MAX), 'Từ chối qua Microsoft Teams')
        .execute('usp_RejectSubmission');

      await logAuditAction('Từ chối đơn', 'TEAMS_SYSTEM', `Từ chối đơn qua MS Teams`, projectId);
      await sendNotification(`Đơn ${projectId} đã bị TỪ CHỐI bởi BOD (qua Teams)`, 'TEAMS_SYSTEM', projectId);

      resultMessage = `Đơn ${projectId} đã TỪ CHỐI thành công.`;
    } else {
      return res.status(400).send('<h1>Hành động không hợp lệ</h1>');
    }

    // Trả về HTML tự động đóng tab hoặc hiển thị thông báo
    res.send(`
      <html>
        <head>
          <title>CSR Action</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; padding: 50px; background-color: #f3f2f1; }
            .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 500px; margin: 0 auto; }
            h2 { color: #0078d4; }
            .close-btn { margin-top: 20px; padding: 10px 20px; background: #0078d4; color: white; border: none; border-radius: 4px; cursor: pointer; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Hoàn tất thao tác</h2>
            <p>${resultMessage}</p>
            <p style="color: #605e5c; font-size: 0.9em; margin-top: 20px;">Hệ thống đã ghi nhận, bạn có thể đóng tab này.</p>
            <button class="close-btn" onclick="window.close()">Đóng Tab</button>
          </div>
          <script>
            setTimeout(() => window.close(), 3000);
          </script>
        </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send(`<h1>Đã có lỗi xảy ra</h1><p>${err.message}</p>`);
  }
});

/**
 * GET /api/submissions/:projectId
 * Chi tiết 1 đơn + tasks (qua usp_Submission_GetDetail)
 */
// GET /:projectId - CỐ Ý để public (không authenticateToken): được dùng bởi trang
// đánh giá khách hàng công khai /public/evaluation/:projectId (CustomerEvaluation.jsx),
// nơi khách hàng bên ngoài xem thông tin đơn mà không cần đăng nhập vào hệ thống CRM.
router.get('/:projectId', async (req, res, next) => {
  try {
    const pool = await getCsrPool();
    const result = await pool.request()
      .input('ProjectId', sql.NVarChar(100), req.params.projectId)
      .execute('usp_Submission_GetDetail');

    const project = result.recordsets[0]?.[0];
    const tasks = result.recordsets[1] || [];

    if (!project) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy đơn' });
    }

    // Nếu đơn có trạng thái đã hủy (Đã hủy / Đã huỷ), lấy lý do hủy mới nhất từ log duyệt
    const isCancelled = project.Status === 'Đã hủy' || project.Status === 'Đã huỷ';
    if (isCancelled) {
      const cancelLog = await pool.request()
        .input('ProjectId', sql.NVarChar(100), req.params.projectId)
        .query("SELECT TOP 1 Reason FROM CSR_ApprovalLogs WHERE ProjectId = @ProjectId AND Action = 'Cancel' ORDER BY CreatedAt DESC");
      if (cancelLog.recordset.length > 0) {
        project.CancelReason = cancelLog.recordset[0].Reason;
      }
    }

    res.json({ success: true, data: { project, tasks } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/submissions
 * Tạo đơn mới — gọi usp_CreateSubmission
 * SQL sẽ tự: sinh Project_id, tính Deadline, tính ReminderDate
 */
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const {
      customerType, customerName, submitterEmail, submitterName, submitterMNV,
      guestRepName, guestReps, guestCount, meetingTopic, attendees, attendeesEmail,
      agendaInfo, agendaJsonData, agendaAttachUrl, tasks, submitTimestamp
    } = req.body;

    const isSpecialType = ['Partner', 'Supplier', 'Khách vãng lai', 'Ứng viên phỏng vấn'].includes(customerType);
    const hasRequiredFields = isSpecialType
      ? (customerName && submitterEmail)
      : (customerName && submitterEmail && tasks?.length > 0);

    if (!hasRequiredFields) {
      return res.status(400).json({
        success: false,
        error: isSpecialType
          ? 'Thiếu dữ liệu bắt buộc: customerName, submitterEmail'
          : 'Thiếu dữ liệu bắt buộc: customerName, submitterEmail, tasks',
      });
    }

    // Task "Chuẩn bị xe": bắt buộc phải khai báo loại phương tiện (vehicle) và số người đi (passengerCount)
    if (Array.isArray(tasks)) {
      for (const t of tasks) {
        const taskNameLower = (t.taskName || '').toLowerCase();
        if (taskNameLower.includes('xe') && !taskNameLower.includes('từ sân bay')) {
          if (!t.vehicle || !String(t.vehicle).trim() || !t.passengerCount || !String(t.passengerCount).trim()) {
            return res.status(400).json({
              success: false,
              error: `Vui lòng khai báo Loại phương tiện và Số người đi cho công việc "${t.taskName}" tại ${t.destination || ''}`,
            });
          }
        }
      }
    }

    const pool = await getCsrPool();
    const result = await pool.request()
      .input('SubmitTimestamp', sql.BigInt, submitTimestamp || Date.now())
      .input('CustomerType', sql.NVarChar(20), customerType)
      .input('CustomerName', sql.NVarChar(200), customerName)
      .input('SubmitterEmail', sql.NVarChar(200), submitterEmail)
      .input('SubmitterName', sql.NVarChar(200), submitterName)
      .input('SubmitterMNV', sql.NVarChar(50), submitterMNV || null)
      .input('GuestRepName', sql.NVarChar(500), guestRepName || null)
      .input('GuestReps', sql.NVarChar(sql.MAX), guestReps || null)
      .input('GuestCount', sql.NVarChar(50), guestCount || null)
      .input('MeetingTopic', sql.NVarChar(500), meetingTopic || null)
      .input('Attendees', sql.NVarChar(sql.MAX), attendees || null)
      .input('AttendeesEmail', sql.NVarChar(sql.MAX), attendeesEmail || null)
      .input('AgendaInfo', sql.NVarChar(sql.MAX), agendaInfo || null)
      .input('AgendaJsonData', sql.NVarChar(sql.MAX), agendaJsonData || null)
      .input('AgendaAttachUrl', sql.NVarChar(1000), agendaAttachUrl || null)
      // Truyền tasks dưới dạng JSON string — SQL tự parse bằng OPENJSON
      .input('TasksJson', sql.NVarChar(sql.MAX), JSON.stringify(tasks))
      .execute('usp_CreateSubmission');

    const row = result.recordset?.[0];

    if (row?.Project_id === 'DUPLICATE') {
      return res.status(400).json({
        success: false,
        error: row.Message || 'Đơn tiếp đón đã tồn tại'
      });
    }

    if (row?.Project_id === 'ERROR') {
      return res.status(400).json({
        success: false,
        error: row.Message || 'Lỗi cơ sở dữ liệu khi tạo đơn'
      });
    }

    // Log Submit
    await logAuditAction('Tạo mới đơn', submitterMNV, `Tạo mới đơn cho ${customerName}`, row?.Project_id);
    await sendNotification(`Có đơn trình duyệt mới từ mã NV: ${submitterMNV || 'N/A'}`, submitterMNV, row?.Project_id);

    res.status(201).json({
      success: true,
      data: { projectId: row?.Project_id, message: row?.Message },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/submissions/:projectId/history
 */
router.get('/:projectId/history', authenticateToken, async (req, res, next) => {
  try {
    const pool = await getCsrPool();
    // Lấy ParentId
    const pRes = await pool.request()
      .input('ProjectId', sql.NVarChar(50), req.params.projectId)
      .execute('usp_GetProjectParentId');
    const parentId = pRes.recordset[0]?.ParentId || req.params.projectId;

    // Lấy toàn bộ lịch sử theo ParentId
    const result = await pool.request()
      .input('ParentId', sql.NVarChar(50), parentId)
      .execute('usp_GetProjectHistory');
    res.json({ success: true, data: result.recordset || [] });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/submissions/:projectId
 * Chỉnh sửa đơn - tạo version mới
 */
router.put('/:projectId', authenticateToken, async (req, res, next) => {
  try {
    const pool = await getCsrPool();
    // Get old submission
    const oldReq = await pool.request()
      .input('ProjectId', sql.NVarChar(50), req.params.projectId)
      .execute('usp_GetProjectForEdit');
    const oldSub = oldReq.recordset[0];
    if (!oldSub) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy đơn gốc' });
    }

    const isApprovedOrCompleted = ['BOD đã duyệt', 'Hoàn thành'].includes(oldSub.Status);

    const {
      customerType, customerName, submitterEmail, submitterName, submitterMNV,
      guestRepName, guestReps, guestCount, meetingTopic, attendees, attendeesEmail,
      agendaInfo, agendaJsonData, agendaAttachUrl, tasks
    } = req.body;

    // Task "Chuẩn bị xe": bắt buộc phải khai báo loại phương tiện và số người đi
    if (Array.isArray(tasks)) {
      for (const t of tasks) {
        const taskNameLower = (t.taskName || '').toLowerCase();
        if (taskNameLower.includes('xe') && !taskNameLower.includes('từ sân bay')) {
          if (!t.vehicle || !String(t.vehicle).trim() || !t.passengerCount || !String(t.passengerCount).trim()) {
            return res.status(400).json({
              success: false,
              error: `Vui lòng khai báo Loại phương tiện và Số người đi cho công việc "${t.taskName}" tại ${t.destination || ''}`,
            });
          }
        }
      }
    }

    const result = await pool.request()
      .input('SubmitTimestamp', sql.BigInt, Date.now())
      .input('CustomerType', sql.NVarChar(20), customerType || oldSub.CustomerType)
      .input('CustomerName', sql.NVarChar(200), customerName || oldSub.CustomerName)
      .input('SubmitterEmail', sql.NVarChar(200), submitterEmail || oldSub.SubmitterEmail)
      .input('SubmitterName', sql.NVarChar(200), submitterName || oldSub.SubmitterName)
      .input('SubmitterMNV', sql.NVarChar(50), submitterMNV || oldSub.SubmitterMNV)
      .input('GuestRepName', sql.NVarChar(500), guestRepName || null)
      .input('GuestReps', sql.NVarChar(sql.MAX), guestReps || null)
      .input('GuestCount', sql.NVarChar(50), guestCount || null)
      .input('MeetingTopic', sql.NVarChar(500), meetingTopic || null)
      .input('Attendees', sql.NVarChar(sql.MAX), attendees || null)
      .input('AttendeesEmail', sql.NVarChar(sql.MAX), attendeesEmail || null)
      .input('AgendaInfo', sql.NVarChar(sql.MAX), agendaInfo || null)
      .input('AgendaJsonData', sql.NVarChar(sql.MAX), agendaJsonData || null)
      .input('AgendaAttachUrl', sql.NVarChar(1000), agendaAttachUrl || null)
      .input('TasksJson', sql.NVarChar(sql.MAX), JSON.stringify(tasks))
      .input('ParentId', sql.NVarChar(50), oldSub.ParentId || req.params.projectId)
      .input('RecordType', sql.Int, 2)
      .input('Version', sql.Int, (oldSub.Version || 1) + 1)
      .execute('usp_CreateSubmission');

    const row = result.recordset?.[0];

    if (row?.Project_id === 'DUPLICATE') {
      return res.status(400).json({ success: false, error: row.Message });
    }

    if (row?.Project_id === 'ERROR') {
      return res.status(400).json({ success: false, error: row.Message || 'Lỗi cơ sở dữ liệu khi chỉnh sửa đơn' });
    }

    const mnv = submitterMNV || req.body.actorMNV || oldSub.SubmitterMNV;
    await logAuditAction('Chỉnh sửa đơn', mnv, `Chỉnh sửa đơn ${req.params.projectId}`, row?.Project_id);
    await sendNotification(`Có cập nhật cho đơn ${req.params.projectId} từ mã NV: ${mnv || 'N/A'}`, mnv, row?.Project_id);

    // Hủy các email lập lịch của phiên bản cũ đang chờ gửi
    const parentId = oldSub.ParentId || req.params.projectId;
    await cancelPendingScheduledEmails(parentId, pool).catch(err => {
      console.error('[Submission Edit] ❌ Failed to cancel pending scheduled emails:', err.message);
    });

    res.json({
      success: true,
      data: { projectId: row?.Project_id, message: row?.Message },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/submissions/recommend-restaurants
 * Lấy lịch sử đặt nhà hàng ăn tối của khách hàng này để thống kê số lần đặt (phục vụ đề xuất)
 */
router.get('/recommend-restaurants', authenticateToken, async (req, res, next) => {
  try {
    const { customerName } = req.query;
    if (!customerName) {
      return res.json({ success: true, data: [] });
    }
    const pool = await getCsrPool();
    const result = await pool.request()
      .input('CustomerName', sql.NVarChar(200), customerName)
      .query(`
        SELECT t.MealOption, COUNT(t.Task_id) as BookCount
        FROM CSR_Tasks t
        INNER JOIN CSR_Projects p ON t.Project_id = p.Project_id
        WHERE p.CustomerName = @CustomerName 
          AND t.TaskName = N'Book nhà hàng ăn tối'
          AND t.MealOption IS NOT NULL 
          AND t.MealOption != ''
        GROUP BY t.MealOption
        ORDER BY BookCount DESC
      `);
    res.json({ success: true, data: result.recordset || [] });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/submissions/:projectId/cancel
 * Hủy đơn: Tạo bản ghi mới với RecordType = 3
 */
router.post('/:projectId/cancel', authenticateToken, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { actorMNV, reason } = req.body;
    const pool = await getCsrPool();

    // Query status trước khi hủy
    const statusReq = await pool.request()
      .input('ProjectId', sql.NVarChar(50), projectId)
      .execute('usp_GetProjectStatus');
    const oldStatus = statusReq.recordset[0]?.Status;
    const isApprovedOrCompleted = ['BOD đã duyệt', 'Hoàn thành'].includes(oldStatus);

    const result = await pool.request()
      .input('ProjectId', sql.NVarChar(100), projectId)
      .input('SubmitterMNV', sql.NVarChar(50), actorMNV || null)
      .execute('usp_CancelSubmission');

    const row = result.recordset?.[0];
    if (row?.Project_id === 'ERROR') {
      return res.status(404).json({ success: false, error: row.Message });
    }

    await logAuditAction('Huỷ đơn', actorMNV, `Huỷ đơn ${projectId}. Lý do: ${reason}`, row?.Project_id);

    // Lưu lý do hủy vào CSR_ApprovalLogs để hiển thị trong lịch sử phê duyệt và trạng thái
    let actorName = 'Người dùng';
    let actorEmail = '';
    let actorRole = req.body.actorRole || 'User';
    if (actorMNV) {
      const actorRes = await pool.request()
        .input('MNV', sql.NVarChar(50), actorMNV)
        .query('SELECT FullName, Email, Role FROM CSR_Users WHERE MNV = @MNV');
      if (actorRes.recordset.length > 0) {
        actorName = actorRes.recordset[0].FullName || actorName;
        actorEmail = actorRes.recordset[0].Email || '';
        actorRole = actorRes.recordset[0].Role || actorRole;
      }
    }

    // Insert log cho đơn gốc
    await pool.request()
      .input('ProjectId', sql.NVarChar(100), projectId)
      .input('Action', sql.NVarChar(50), 'Cancel')
      .input('Role', sql.NVarChar(50), actorRole)
      .input('ActorMNV', sql.NVarChar(50), actorMNV || '')
      .input('ActorName', sql.NVarChar(200), actorName)
      .input('Reason', sql.NVarChar(sql.MAX), reason || null)
      .input('OldStatus', sql.NVarChar(50), oldStatus || null)
      .input('NewStatus', sql.NVarChar(50), 'Đã hủy')
      .execute('usp_InsertApprovalLog');

    // Insert log cho đơn mới (nếu có suffix _C)
    if (row?.Project_id && row.Project_id !== projectId) {
      await pool.request()
        .input('ProjectId', sql.NVarChar(100), row.Project_id)
        .input('Action', sql.NVarChar(50), 'Cancel')
        .input('Role', sql.NVarChar(50), actorRole)
        .input('ActorMNV', sql.NVarChar(50), actorMNV || '')
        .input('ActorName', sql.NVarChar(200), actorName)
        .input('Reason', sql.NVarChar(sql.MAX), reason || null)
        .input('OldStatus', sql.NVarChar(50), oldStatus || null)
        .input('NewStatus', sql.NVarChar(50), 'Đã hủy')
        .execute('usp_InsertApprovalLog');
    }

    // Lấy ParentId của đơn
    const verRes = await pool.request()
      .input('ProjectId', sql.NVarChar(100), projectId)
      .query('SELECT ParentId FROM CSR_Projects WHERE Project_id = @ProjectId');
    const parentId = verRes.recordset[0]?.ParentId || projectId;

    // Hủy các email lập lịch còn chờ gửi
    await cancelPendingScheduledEmails(parentId, pool).catch(err => {
      console.error('[Submission Cancel] ❌ Failed to cancel pending scheduled emails:', err.message);
    });

    if (isApprovedOrCompleted) {
      await handleProjectCancelNotification(projectId, reason, pool);
    }

    res.json({
      success: true,
      data: { projectId: row?.Project_id, message: 'Đã hủy đơn thành công' },
    });
  } catch (err) {

    next(err);
  }
});




/**
 * POST /api/submissions/:projectId/approve
 * Phê duyệt đơn — gọi usp_ApproveSubmission
 */
router.post('/:projectId/approve', authenticateToken, async (req, res, next) => {
  try {
    const { actorRole, actorMNV, actorName, actorEmail, note } = req.body;
    const pool = await getCsrPool();
    const result = await pool.request()
      .input('ProjectId', sql.NVarChar(100), req.params.projectId)
      .input('ActorRole', sql.NVarChar(50), actorRole || null)
      .input('ActorMNV', sql.NVarChar(50), actorMNV || null)
      .input('ActorName', sql.NVarChar(200), actorName || null)
      .input('ActorEmail', sql.NVarChar(200), actorEmail || null)
      .input('Note', sql.NVarChar(sql.MAX), note || null)
      .execute('usp_ApproveSubmission');

    const row = result.recordset?.[0];

    await logAuditAction('Phê duyệt đơn', actorMNV, `Phê duyệt đơn với ghi chú: ${note || ''}`, req.params.projectId);
    await sendNotification(`Đơn ${req.params.projectId} đã được phê duyệt bởi ${actorRole} (${actorMNV || 'N/A'})`, actorMNV, req.params.projectId);

    // Query CustomerType to check if it is a special type
    const projRes = await pool.request()
      .input('ProjectId', sql.NVarChar(100), req.params.projectId)
      .query('SELECT CustomerType FROM CSR_Projects WHERE Project_id = @ProjectId');
    const customerType = projRes.recordset?.[0]?.CustomerType;
    const isSpecialType = ['Partner', 'Supplier', 'Khách vãng lai', 'Ứng viên phỏng vấn'].includes(customerType);

    if (row?.NewStatus === 'BOD đã duyệt' || (row?.NewStatus === 'PRD đã duyệt' && isSpecialType)) {
      await syncNewCustomerReps(req.params.projectId, pool);
      handleBODApprovalActions(req.params.projectId, pool).catch(err => {
        console.error('[Approval Workflow] ❌ Background BOD/PRD workflows failed:', err);
      });
    }

    // Gửi thông báo Teams nếu PRD vừa duyệt xong (chờ BOD) - Chỉ dành cho loại Brand
    if (row?.NewStatus === 'PRD đã duyệt' && !isSpecialType) {
      const pRes = await pool.request()
        .input('ProjectId', sql.NVarChar(100), req.params.projectId)
        .execute('usp_GetProjectForTeams');
      if (pRes.recordset.length > 0) {
        await sendBODApprovalToSharePointQueue(pRes.recordset[0], pool).catch(err => {
          console.error('[Approval Workflow] ❌ Failed to queue BOD approval to SharePoint:', err.message);
        });
      }
    }

    res.json({ success: true, data: { projectId: row?.Project_id, newStatus: row?.NewStatus, message: row?.Message } });
  } catch (err) {
    next(err);
  }
});



/**
 * POST /api/submissions/:projectId/reject
 * Từ chối đơn — gọi usp_RejectSubmission
 */
router.post('/:projectId/reject', authenticateToken, async (req, res, next) => {
  try {
    const { actorRole, actorMNV, actorName, actorEmail, reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập lý do từ chối' });
    }
    const pool = await getCsrPool();
    const result = await pool.request()
      .input('ProjectId', sql.NVarChar(100), req.params.projectId)
      .input('ActorRole', sql.NVarChar(50), actorRole || null)
      .input('ActorMNV', sql.NVarChar(50), actorMNV || null)
      .input('ActorName', sql.NVarChar(200), actorName || null)
      .input('ActorEmail', sql.NVarChar(200), actorEmail || null)
      .input('Reason', sql.NVarChar(sql.MAX), reason)
      .execute('usp_RejectSubmission');

    const row = result.recordset?.[0];

    // Log Reject
    await logAuditAction('Từ chối đơn', actorMNV, `Từ chối đơn với lý do: ${reason}`, req.params.projectId);
    await sendNotification(`Đơn ${req.params.projectId} đã bị hủy/từ chối từ mã NV: ${actorMNV || 'N/A'}`, actorMNV, req.params.projectId);

    res.json({ success: true, data: { projectId: row?.Project_id, newStatus: row?.NewStatus, message: row?.Message } });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/submissions/:projectId/logs
 * Lịch sử phê duyệt — gọi usp_GetApprovalLogs
 */
router.get('/:projectId/logs', authenticateToken, async (req, res, next) => {
  try {
    const pool = await getCsrPool();
    const result = await pool.request()
      .input('ProjectId', sql.NVarChar(100), req.params.projectId)
      .execute('usp_GetApprovalLogs');

    res.json({ success: true, data: result.recordset || [] });
  } catch (err) {
    next(err);
  }
});

async function syncNewCustomerReps(projectId, pool) {
  try {
    // Lấy thông tin project để sync
    const pRes = await pool.request()
      .input('ProjectId', sql.NVarChar(100), projectId)
      .execute('usp_GetProjectForSync');
    if (pRes.recordset.length === 0) return;

    const { CustomerType, CustomerName, GuestReps } = pRes.recordset[0];
    if (!CustomerName || !GuestReps || !CustomerType) return;

    let projectReps = [];
    try {
      projectReps = JSON.parse(GuestReps);
    } catch (e) {
      console.error('Failed to parse project guest reps JSON:', e);
      return;
    }
    if (!Array.isArray(projectReps) || projectReps.length === 0) return;

    // Lấy danh sách đại diện khách hàng hiện có trong config
    const cRes = await pool.request()
      .input('Category', sql.NVarChar(50), CustomerType)
      .input('Name', sql.NVarChar(200), CustomerName)
      .execute('usp_GetCustomerConfigReps');

    if (cRes.recordset.length === 0) {
      const cleanedReps = projectReps.map(r => ({
        salutation: r.salutation || 'Mr',
        name: (r.name || '').trim(),
        email: r.email || '',
        title: r.title || '',
        mealNote: r.mealNote || '',
        extraNote: r.extraNote || ''
      })).filter(r => r.name !== '');

      if (cleanedReps.length > 0) {
        await pool.request()
          .input('Category', sql.NVarChar(50), CustomerType)
          .input('Name', sql.NVarChar(200), CustomerName)
          .input('JsonData', sql.NVarChar(sql.MAX), JSON.stringify(cleanedReps))
          .execute('usp_InsertCustomerConfigReps');
      }
    } else {
      const customerConfig = cRes.recordset[0];
      let dbReps = [];
      try {
        dbReps = customerConfig.JsonData ? JSON.parse(customerConfig.JsonData) : [];
      } catch (e) {
        dbReps = [];
      }
      if (!Array.isArray(dbReps)) dbReps = [];

      const newReps = projectReps.filter(pr =>
        pr.name && pr.name.trim() !== '' &&
        !dbReps.some(dbr => (dbr.name || '').toLowerCase().trim() === pr.name.toLowerCase().trim())
      );

      if (newReps.length > 0) {
        const cleanedNewReps = newReps.map(r => ({
          salutation: r.salutation || 'Mr',
          name: r.name.trim(),
          email: r.email || '',
          title: r.title || '',
          mealNote: r.mealNote || '',
          extraNote: r.extraNote || ''
        }));
        const updatedDbReps = [...dbReps, ...cleanedNewReps];

        await pool.request()
          .input('Id', sql.Int, customerConfig.Id)
          .input('JsonData', sql.NVarChar(sql.MAX), JSON.stringify(updatedDbReps))
          .execute('usp_UpdateCustomerConfigReps');
      }
    }
  } catch (err) {
    console.error('Error syncing new customer reps:', err);
  }
}

module.exports = router;