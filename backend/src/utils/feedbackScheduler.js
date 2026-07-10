const crypto = require('crypto');
const axios = require('axios');
const { getCsrPool, sql } = require('../config/database');
const { getAccessToken } = require('../config/sharepoint');

/**
 * Helper lấy Site ID của SharePoint site từ SHARE_URL cấu hình sẵn
 */
async function getSharePointSiteId(accessToken) {
  const shareUrl = process.env.SHARE_URL;
  if (!shareUrl) {
    throw new Error('Chưa cấu hình SHARE_URL trong file .env');
  }
  const base64 = Buffer.from(shareUrl).toString('base64');
  const shareId = 'u!' + base64.replace(/=/g, '').replace(/\//g, '_').replace(/\+/g, '-');
  const url = `https://graph.microsoft.com/v1.0/shares/${shareId}/driveItem`;
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 8000
  });
  return res.data.parentReference.siteId;
}

/**
 * Khởi chạy job lập lịch kiểm tra và gửi thư mời, đồng thời quét kết quả đánh giá ngược lại SQL Server
 */
function startFeedbackScheduler() {
  console.log('[Feedback Scheduler] ⏰ Feedback scheduler registered. Checking every minute...');

  let lastRunDate = ''; // Tránh chạy quét gửi mail nhiều lần trong ngày lúc 08:30

  setInterval(async () => {
    try {
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();

      // 1. Quét gửi thư mời lúc 08:30 sáng hàng ngày
      if (currentHours === 8 && currentMinutes === 30) {
        const todayStr = now.toISOString().split('T')[0];
        if (lastRunDate !== todayStr) {
          console.log(`[Feedback Scheduler] 🚀 Triggering daily feedback invitations scan at 08:30 on ${todayStr}`);
          lastRunDate = todayStr;
          await processFeedbackInvitations();
        }
      }

      // 2. Quét đồng bộ kết quả đánh giá từ SharePoint List về SQL Server mỗi 5 phút một lần
      // Chạy khi phút chia hết cho 5
      if (currentMinutes % 5 === 0) {
        await syncFeedbackResultsFromSharePoint();
      }

    } catch (err) {
      console.error('[Feedback Scheduler] ❌ Interval job check error:', err.message);
    }
  }, 60000); // Kiểm tra mỗi phút
}

/**
 * Quét các đơn Brand hoàn thành ngày hôm qua để chuẩn bị gửi thư mời
 */
async function processFeedbackInvitations() {
  try {
    const pool = await getCsrPool();
    console.log('[Feedback Scheduler] Scanning for customer receptions that ended yesterday...');

    const query = `
      SELECT p.Project_id, p.CustomerName, p.GuestReps, p.SubmitterName, p.SubmitterEmail, p.MeetingTopic, p.SubmitDate
      FROM CSR_Projects p
      INNER JOIN CSR_Statuses s ON p.StatusId = s.Id
      INNER JOIN (
          SELECT Project_id, MAX(OnboardDate) as LastOnboardDate
          FROM CSR_Tasks
          GROUP BY Project_id
      ) t ON p.Project_id = t.Project_id
      WHERE p.CustomerType = 'Brand'
        AND s.TenTrangThai = N'Hoàn thành'
        AND CAST(t.LastOnboardDate AS DATE) <= CAST(DATEADD(day, -1, GETDATE()) AS DATE)
        AND NOT EXISTS (
            SELECT 1 FROM CSR_FeedbackInvitations i WHERE i.ProjectId = p.Project_id
        )
    `;

    const result = await pool.request().query(query);
    const projects = result.recordset || [];

    if (projects.length === 0) {
      console.log('[Feedback Scheduler] No eligible customer receptions ended yesterday.');
      return;
    }

    console.log(`[Feedback Scheduler] Found ${projects.length} eligible project(s) to send feedback invitations.`);

    for (const project of projects) {
      await sendFeedbackForProject(project, pool);
    }

  } catch (err) {
    console.error('[Feedback Scheduler] ❌ Error processing feedback invitations:', err.message);
  }
}

/**
 * Thêm thư mời đánh giá vào SharePoint List hàng đợi
 */
async function sendFeedbackForProject(project, pool) {
  try {
    let reps = [];
    if (project.GuestReps) {
      try { reps = JSON.parse(project.GuestReps); } catch (e) { return; }
    }

    const validReps = reps.map((r, index) => ({ ...r, index })).filter(r => r && r.email && typeof r.email === 'string' && r.email.trim());

    if (validReps.length === 0) {
      return;
    }

    // Lấy site ID của SharePoint
    const accessToken = await getAccessToken();
    const siteId = await getSharePointSiteId(accessToken);
    const powerPagesUrl = process.env.POWER_PAGES_FEEDBACK_URL || 'https://feedback.company.com/feedback';

    for (const rep of validReps) {
      const token = crypto.randomBytes(32).toString('hex');
      const expireDate = new Date();
      expireDate.setDate(expireDate.getDate() + 7);

      // 1. Lưu thư mời vào SQL Server
      await pool.request()
        .input('Token', sql.NVarChar(128), token)
        .input('ProjectId', sql.NVarChar(100), project.Project_id)
        .input('VisitorId', sql.Int, rep.index)
        .input('ExpireDate', sql.DateTime, expireDate)
        .input('Status', sql.NVarChar(50), 'Pending')
        .input('CreatedBy', sql.NVarChar(100), 'SYSTEM')
        .execute('usp_InsertFeedbackInvitation');

      // 2. Thêm item mới vào SharePoint List hàng đợi CSR_Feedback_Queue
      const meetingDateStr = project.SubmitDate
        ? new Date(project.SubmitDate).toLocaleDateString('vi-VN')
        : new Date().toLocaleDateString('vi-VN');

      const itemPayload = {
        fields: {
          Title: `Feedback invitation for ${rep.name}`,
          ProjectId: project.Project_id,
          Token: token,
          VisitorEmail: rep.email.trim(),
          VisitorName: rep.name.trim(),
          HostName: project.SubmitterName,
          MeetingDate: meetingDateStr,
          FeedbackUrl: `${powerPagesUrl}?token=${token}`
        }
      };

      const queueListName = process.env.SHAREPOINT_FEEDBACK_QUEUE_LIST || 'CSR_Feedback_Queue';
      const addUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${queueListName}/items`;
      try {
        await axios.post(addUrl, itemPayload, {
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          timeout: 8000
        });
        console.log(`[Feedback Scheduler] ✅ Added invitation item to SharePoint List for ${rep.email} (Project: ${project.Project_id})`);
      } catch (apiErr) {
        if (apiErr.response && apiErr.response.status === 404) {
          console.error(`[Feedback Scheduler] ❌ Lỗi: Không tìm thấy danh sách '${queueListName}' trên SharePoint site. Vui lòng kiểm tra lại cấu hình.`);
        } else {
          console.error(`[Feedback Scheduler] ❌ Lỗi Graph API khi ghi queue cho project ${project.Project_id}:`, apiErr.message);
        }
      }
    }
  } catch (err) {
    console.error(`[Feedback Scheduler] ❌ Error in sendFeedbackForProject for ${project.Project_id}:`, err.message);
  }
}

/**
 * Định kỳ đồng bộ kết quả đánh giá từ SharePoint List CSR_Feedback_Results về SQL Server local
 */
async function syncFeedbackResultsFromSharePoint() {
  try {
    const accessToken = await getAccessToken();
    const siteId = await getSharePointSiteId(accessToken);
    const pool = await getCsrPool();

    const resultsListName = process.env.SHAREPOINT_FEEDBACK_RESULTS_LIST || 'CSR_Feedback_Results';
    console.log(`[Feedback Sync] 🔄 Scanning SharePoint List ${resultsListName} for new responses...`);

    // 1. Đọc danh sách item từ list CSR_Feedback_Results
    const getUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${resultsListName}/items?$expand=fields`;
    let response;
    try {
      response = await axios.get(getUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 8000
      });
    } catch (apiErr) {
      if (apiErr.response && apiErr.response.status === 404) {
        console.warn(`[Feedback Sync] ⚠️ Cảnh báo: Không tìm thấy danh sách '${resultsListName}' trên SharePoint site. Bỏ qua đồng bộ.`);
        return;
      }
      throw apiErr;
    }

    const items = response.data.value || [];
    if (items.length === 0) {
      console.log('[Feedback Sync] No new feedback responses found on SharePoint.');
      return;
    }

    console.log(`[Feedback Sync] Found ${items.length} feedback response(s) on SharePoint to sync.`);

    for (const item of items) {
      const fields = item.fields;
      const itemId = item.id;
      const token = fields.Token;
      const overallRating = parseInt(fields.OverallRating);
      const answersJson = fields.AnswersJson || '{}';
      const comments = fields.Comments || '';
      const visitorName = fields.VisitorName || '';
      const responseId = fields.ResponseId || '';

      if (!token) {
        console.warn('[Feedback Sync] ⚠️ Skipping item due to missing Token:', itemId);
        continue;
      }

      // 2. Chạy stored procedure cập nhật vào SQL Server
      try {
        await pool.request()
          .input('Token', sql.NVarChar(128), token)
          .input('OverallRating', sql.Int, overallRating)
          .input('AnswersJson', sql.NVarChar(sql.MAX), answersJson)
          .input('Comments', sql.NVarChar(1000), comments || null)
          .input('VisitorName', sql.NVarChar(200), visitorName || null)
          .input('ResponseId', sql.NVarChar(100), responseId || null)
          .execute('usp_SubmitFeedback');

        console.log(`[Feedback Sync] ✅ Synchronized feedback response successfully for token ${token.substring(0, 10)}...`);

        // 3. Xóa dòng đã xử lý thành công trên SharePoint List để làm sạch danh sách
        const deleteUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${resultsListName}/items/${itemId}`;
        await axios.delete(deleteUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 8000
        });
        console.log(`[Feedback Sync] 🗑️ Removed synced item ${itemId} from SharePoint List.`);

      } catch (dbErr) {
        // Nếu lỗi xảy ra do token không hợp lệ/đã dùng, vẫn xóa dòng đó trên SharePoint List để tránh treo lỗi hàng đợi
        console.error(`[Feedback Sync] ❌ DB update failed for token ${token.substring(0, 10)}...:`, dbErr.message);

        if (dbErr.message.includes('không hợp lệ') || dbErr.message.includes('đã được nộp') || dbErr.message.includes('hết hạn')) {
          const deleteUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${resultsListName}/items/${itemId}`;
          await axios.delete(deleteUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: 8000
          });
          console.log(`[Feedback Sync] 🗑️ Cleaned up invalid/expired response item ${itemId} from SharePoint List.`);
        }
      }
    }
  } catch (err) {
    console.error('[Feedback Sync] ❌ Error synchronizing feedback results from SharePoint:', err.message);
  }
}

module.exports = {
  startFeedbackScheduler,
  processFeedbackInvitations,
  syncFeedbackResultsFromSharePoint
};