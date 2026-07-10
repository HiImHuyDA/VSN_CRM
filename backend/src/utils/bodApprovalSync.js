const axios = require('axios');
const { getCsrPool, sql } = require('../config/database');
const { getAccessToken } = require('../config/sharepoint');
const { handleBODApprovalActions } = require('./approvalNotification');

// Cờ khoá chống chạy chồng lấp (overlapping) giữa các lần quét định kỳ.
// Nếu 1 lần chạy syncBODApprovalResults() mất > 30s (do gọi nhiều API ngoài:
// Graph API, SharePoint sync, gửi email...), setInterval vẫn kích hoạt lần
// tiếp theo trước khi lần trước xoá xong item đã xử lý => cùng 1 đơn bị xử lý
// 2 lần chồng nhau => gửi email trùng lặp. Cờ này đảm bảo chỉ 1 lần chạy tại 1 thời điểm.
let isSyncing = false;

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
 * Đẩy yêu cầu duyệt của BOD vào SharePoint List hàng đợi CSR_BOD_Approval_Queue
 * Thay thế cho việc gửi Teams Webhook Adaptive Card cũ.
 */
async function sendBODApprovalToSharePointQueue(submission, pool) {
  try {
    const projectId = submission.Project_id || submission.projectId || 'Unknown';

    // 1. Truy vấn thông tin chi tiết đơn từ SQL Server để đảm bảo có đầy đủ dữ liệu
    const projectRes = await pool.request()
      .input('ProjectId', sql.NVarChar(100), projectId)
      .query(`
        SELECT Project_id, SubmitterMNV, SubmitterName, GuestReps, AgendaJsonData, CustomerType, SubmitDate, CustomerName, MeetingTopic 
        FROM CSR_Projects 
        WHERE Project_id = @ProjectId
      `);

    const project = projectRes.recordset?.[0];
    if (!project) {
      throw new Error(`Không tìm thấy đơn tiếp đón với ID: ${projectId} trong database`);
    }

    const customer = project.CustomerName || 'Unknown';
    const topic = project.MeetingTopic || 'Không có chủ đề';

    // 2. Tự động xác định email của các BOD trong hệ thống
    let bodEmail = process.env.BOD_EMAIL || '';
    if (!bodEmail) {
      const bodRes = await pool.request()
        .query("SELECT Email FROM CSR_Users WHERE Role = 'BOD' AND Email IS NOT NULL");
      const emails = bodRes.recordset.map(r => r.Email.trim()).filter(Boolean);
      if (emails.length > 0) {
        bodEmail = emails.join(';');
      } else {
        bodEmail = 'minht@vietsuncorp.com.vn'; // Fallback cuối cùng
      }
    }

    // 3. Xác định Team (Department/Role của người tạo)
    let teamName = 'PRD';
    if (project.SubmitterMNV) {
      const userRes = await pool.request()
        .input('MNV', sql.NVarChar(50), project.SubmitterMNV)
        .query('SELECT Role, Department FROM CSR_Users WHERE MNV = @MNV');
      if (userRes.recordset.length > 0) {
        const u = userRes.recordset[0];
        teamName = u.Department || u.Role || 'PRD';
      }
    }

    // 4. Parse lịch trình chung (AgendaJsonData) để lấy ngày, địa điểm & lịch trình dạng text
    let agendaJson = [];
    if (project.AgendaJsonData) {
      try {
        agendaJson = JSON.parse(project.AgendaJsonData);
      } catch (e) {
        console.error('[BOD Approval Queue] Failed to parse AgendaJsonData:', e.message);
      }
    }

    // Lấy ngày tiếp đón (format DD/MM/YYYY) của ngày đầu tiên
    let meetingDateStr = '—';
    if (agendaJson && agendaJson.length > 0) {
      const dates = agendaJson
        .map(day => day.date ? new Date(day.date) : null)
        .filter(d => d && !isNaN(d.getTime()));
      if (dates.length > 0) {
        const minDate = new Date(Math.min(...dates));
        const dayStr = String(minDate.getDate()).padStart(2, '0');
        const monthStr = String(minDate.getMonth() + 1).padStart(2, '0');
        meetingDateStr = `${dayStr}/${monthStr}/${minDate.getFullYear()}`;
      }
    } else if (project.SubmitDate) {
      const d = new Date(project.SubmitDate);
      meetingDateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    }

    // Lấy địa điểm đón tiếp
    let destinationStr = '—';
    if (agendaJson && agendaJson.length > 0) {
      const dests = agendaJson.flatMap(day => Object.keys(day.agenda || {}));
      const uniqueDests = [...new Set(dests)].filter(Boolean);
      if (uniqueDests.length > 0) destinationStr = uniqueDests.join(', ');
    }

    // Nối chuỗi lịch trình chi tiết (AgendaText) dạng: LoaiTask - ThoiGian - NoiDung | ...
    let agendaText = '—';
    if (agendaJson && agendaJson.length > 0) {
      const lines = [];
      agendaJson.forEach(day => {
        if (day.agenda) {
          Object.entries(day.agenda).forEach(([dest, items]) => {
            if (Array.isArray(items)) {
              items.forEach(item => {
                const time = item.timeStart || item.time || '—';
                const type = item.contentType || item.type || '—';
                const content = item.detail || item.content || '—';
                lines.push(`${type} - ${time} - ${content}`);
              });
            }
          });
        }
      });
      if (lines.length > 0) {
        agendaText = lines.join(' | ');
      }
    }

    // Định dạng danh sách đại diện khách hàng (GuestReps)
    let guestRepsStr = '—';
    if (project.GuestReps) {
      try {
        const reps = JSON.parse(project.GuestReps);
        if (Array.isArray(reps) && reps.length > 0) {
          guestRepsStr = reps.map(r => {
            const salutation = r.salutation || '';
            const name = r.name || '';
            const title = r.title || '';
            return `${salutation ? salutation + ' ' : ''}${name}${title ? ' - ' + title : ''}`;
          }).join(' | ');
        }
      } catch (e) {
        console.error('[BOD Approval Queue] Failed to parse GuestReps:', e.message);
      }
    }

    // 5. Kết nối SharePoint và ghi vào list CSR_BOD_Approval_Queue
    const accessToken = await getAccessToken();
    const siteId = await getSharePointSiteId(accessToken);
    const queueListName = process.env.SHAREPOINT_BOD_APPROVAL_QUEUE_LIST_ID || 'CSR_BOD_Approval_Queue';

    const itemPayload = {
      fields: {
        Title: `BOD Approval Request - ${customer}`,
        ProjectId: projectId,
        BOD_Email: bodEmail.trim(),
        Team: teamName,
        MeetingTopic: topic,
        Destination: destinationStr,
        CustomerName: customer,
        GuestReps: guestRepsStr,
        MeetingDate: meetingDateStr,
        AgendaText: agendaText
      }
    };

    const addUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${queueListName}/items`;
    await axios.post(addUrl, itemPayload, {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      timeout: 8000
    });

    console.log(`[BOD Approval Queue] ✅ Successfully added project ${projectId} to SharePoint Approval Queue for BOD: ${bodEmail}`);
  } catch (error) {
    console.error(`[BOD Approval Queue] ❌ Failed to add project ${submission.Project_id || 'Unknown'} to SharePoint Approval Queue:`, error.message);
    throw error;
  }
}

/**
 * Đồng bộ kết quả phê duyệt của BOD từ SharePoint List kết quả CSR_BOD_Approval_Results về SQL Server local
 */
async function syncBODApprovalResults() {
  if (isSyncing) {
    console.log('[BOD Approval Sync] ⏭️ Lần quét trước vẫn đang chạy, bỏ qua lần này để tránh xử lý trùng.');
    return;
  }
  isSyncing = true;
  try {
    const accessToken = await getAccessToken();
    const siteId = await getSharePointSiteId(accessToken);
    const pool = await getCsrPool();

    const resultsListName = process.env.SHAREPOINT_BOD_APPROVAL_RESULTS_LIST_ID || 'CSR_BOD_Approval_Results';

    // 1. Quét danh sách kết quả phê duyệt trên SharePoint
    const getUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${resultsListName}/items?$expand=fields`;
    const response = await axios.get(getUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 8000
    });

    const items = response.data.value || [];
    if (items.length === 0) {
      return;
    }

    console.log(`[BOD Approval Sync] Found ${items.length} approval response(s) to process.`);

    for (const item of items) {
      const fields = item.fields;
      const itemId = item.id;
      const projectId = fields.ProjectId;
      const outcome = fields.ApprovalOutcome; // 'Approve' hoặc 'Reject'
      const comments = fields.BOD_Comments || '';

      if (!projectId || !outcome) {
        console.warn(`[BOD Approval Sync] ⚠️ Skipping item ${itemId} due to missing ProjectId or Outcome`);
        continue;
      }

      console.log(`[BOD Approval Sync] Processing project ${projectId}. Outcome: ${outcome}`);

      let dbSuccess = false;

      try {
        if (outcome === 'Approve' || outcome === 'Approved' || outcome === 'Approved' || outcome === 'Accept') {
          // A. Gọi stored procedure duyệt đơn
          await pool.request()
            .input('ProjectId', sql.NVarChar(100), projectId)
            .input('ActorRole', sql.NVarChar(50), 'BOD')
            .input('ActorMNV', sql.NVarChar(50), 'TEAMS_BOD')
            .input('ActorName', sql.NVarChar(200), 'BOD Teams Approval')
            .input('Note', sql.NVarChar(sql.MAX), comments || 'Được duyệt qua Teams Approval App')
            .execute('usp_ApproveSubmission');

          console.log(`[BOD Approval Sync] ✅ DB approved project ${projectId}. Triggering post-approval tasks...`);

          // B. Chạy các tác vụ tự động hóa sau khi duyệt (gửi mail, đặt phòng họp, sync xe ra vào...)
          await handleBODApprovalActions(projectId, pool);
          dbSuccess = true;

        } else if (outcome === 'Reject' || outcome === 'Rejected' || outcome === 'Deny') {
          // A. Gọi stored procedure từ chối đơn
          await pool.request()
            .input('ProjectId', sql.NVarChar(100), projectId)
            .input('ActorRole', sql.NVarChar(50), 'BOD')
            .input('ActorMNV', sql.NVarChar(50), 'TEAMS_BOD')
            .input('ActorName', sql.NVarChar(200), 'BOD Teams Approval')
            .input('Reason', sql.NVarChar(sql.MAX), comments || 'Từ chối qua Teams Approval App')
            .execute('usp_RejectSubmission');

          console.log(`[BOD Approval Sync] ❌ DB rejected project ${projectId}.`);
          dbSuccess = true;
        } else {
          console.warn(`[BOD Approval Sync] ⚠️ Unknown approval outcome: ${outcome} for project ${projectId}`);
        }
      } catch (dbErr) {
        console.error(`[BOD Approval Sync] ❌ DB update failed for project ${projectId}:`, dbErr.message);

        // Nếu lỗi xảy ra do đơn đã được xử lý trước đó (Status đã hoàn thành, hoặc đã bị huỷ,...),
        // vẫn đánh dấu xử lý thành công để xoá hàng đợi SharePoint tránh lặp đi lặp lại
        if (dbErr.message.includes('không tìm thấy') || dbErr.message.includes('đã được') || dbErr.message.includes('Chỉ duyệt được đơn')) {
          dbSuccess = true;
        }
      }

      // 2. Xóa item đã xử lý trên SharePoint List kết quả để làm sạch danh sách
      if (dbSuccess) {
        try {
          const deleteUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${resultsListName}/items/${itemId}`;
          await axios.delete(deleteUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: 8000
          });
          console.log(`[BOD Approval Sync] 🗑️ Cleaned up processed item ${itemId} from SharePoint results list.`);
        } catch (delErr) {
          console.error(`[BOD Approval Sync] ❌ Failed to delete item ${itemId} from SharePoint results list:`, delErr.message);
        }
      }
    }
  } catch (err) {
    console.error('[BOD Approval Sync] ❌ Error in syncBODApprovalResults:', err.message);
  } finally {
    isSyncing = false;
  }
}

/**
 * Khởi chạy job lập lịch quét và đồng bộ kết quả duyệt của BOD 30 giây một lần
 */
function startBODApprovalSyncScheduler() {
  console.log('[BOD Approval Sync Scheduler] ⏰ Registered. Checking every 30 seconds...');

  // Chạy lần đầu tiên sau khi khởi động server 15 giây
  setTimeout(() => {
    syncBODApprovalResults().catch(err => {
      console.error('[BOD Approval Sync Scheduler] ❌ Initial scan failed:', err.message);
    });
  }, 15000);

  // Lặp lại mỗi 30 giây (30000 ms)
  setInterval(async () => {
    await syncBODApprovalResults();
  }, 30000);
}

module.exports = {
  sendBODApprovalToSharePointQueue,
  syncBODApprovalResults,
  startBODApprovalSyncScheduler
};