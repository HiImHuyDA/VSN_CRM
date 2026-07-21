const { getCsrPool, sql } = require('../config/database');
const { sendApprovalEmail, handleProjectEditNotification } = require('./approvalNotification');

/**
 * Khởi tạo bộ lập lịch kiểm tra và gửi email tự động mỗi phút
 */
function startScheduledEmailScheduler() {
  console.log('[Scheduled Email Scheduler] ⏰ Registered. Checking every minute...');

  // Chạy lần đầu tiên sau khi khởi động server 30 giây
  setTimeout(() => {
    processScheduledEmails().catch(err => {
      console.error('[Scheduled Email Scheduler] ❌ Initial scan failed:', err.message);
    });
  }, 30000);

  // Định kỳ chạy mỗi phút (60000 ms)
  setInterval(async () => {
    try {
      await processScheduledEmails();
    } catch (err) {
      console.error('[Scheduled Email Scheduler] ❌ Interval scan failed:', err.message);
    }
  }, 60000);
}

/**
 * Quét cơ sở dữ liệu và xử lý gửi các email đến hạn
 */
async function processScheduledEmails() {
  const pool = await getCsrPool();

  // 1. Quét các email Pending có SendAt nhỏ hơn hoặc bằng thời điểm hiện tại
  const res = await pool.request()
    .input('Now', sql.DateTime, new Date())
    .execute('usp_ScheduledEmail_GetPending');

  const emailsToSend = res.recordset || [];
  if (emailsToSend.length === 0) {
    return;
  }

  console.log(`[Scheduled Email Scheduler] Found ${emailsToSend.length} scheduled email(s) to process.`);

  for (const email of emailsToSend) {
    try {
      console.log(`[Scheduled Email Scheduler] Processing email ID ${email.Id} (Project: ${email.ProjectId}, Type: ${email.EmailType})`);

      // 2. Lấy thông tin chi tiết đơn + tasks qua usp_Submission_GetDetail
      const detailRes = await pool.request()
        .input('ProjectId', sql.NVarChar(100), email.ProjectId)
        .execute('usp_Submission_GetDetail');

      const project = detailRes.recordsets[0]?.[0];
      const tasks = detailRes.recordsets[1] || [];

      if (!project) {
        throw new Error(`Project detail not found for ${email.ProjectId}`);
      }

      // Lấy thêm ParentId và Version từ database
      const verRes = await pool.request()
        .input('ProjectId', sql.NVarChar(100), email.ProjectId)
        .execute('usp_Project_GetParentAndVersion');
      if (verRes.recordset.length > 0) {
        project.ParentId = verRes.recordset[0].ParentId;
        project.Version = verRes.recordset[0].Version;
      }

      const activeTasks = tasks.filter(t => t.IsActive !== false);

      // 3. Thực hiện gửi email dựa trên loại
      if (email.EmailType === 'Edit') {
        await handleProjectEditNotification(email.ProjectId, project.ParentId, pool);
      } else {
        await sendApprovalEmail(project, activeTasks, pool);
      }

      // 4. Cập nhật trạng thái thành công
      await pool.request()
        .input('Id', sql.Int, email.Id)
        .input('Status', sql.NVarChar(50), 'Sent')
        .execute('usp_UpdateScheduledEmailStatus');
      console.log(`[Scheduled Email Scheduler] ✅ Successfully sent email ID ${email.Id}`);

    } catch (err) {
      console.error(`[Scheduled Email Scheduler] ❌ Failed to send email ID ${email.Id}:`, err.message);

      // Cập nhật trạng thái thất bại và lưu lỗi
      await pool.request()
        .input('Id', sql.Int, email.Id)
        .input('Status', sql.NVarChar(50), 'Failed')
        .input('ErrorMessage', sql.NVarChar(sql.MAX), err.message)
        .execute('usp_UpdateScheduledEmailStatus');
    }
  }
}

module.exports = {
  startScheduledEmailScheduler,
  processScheduledEmails
};