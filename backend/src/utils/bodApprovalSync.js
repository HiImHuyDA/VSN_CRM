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
 * để kích hoạt Power Automate → Teams Approvals.
 */
async function sendBODApprovalToSharePointQueue(submission, pool) {
  try {
    const projectId = submission.Project_id || submission.projectId || 'Unknown';

    // 1. Truy vấn thông tin chi tiết đơn từ SQL Server để đảm bảo có đầy đủ dữ liệu
    const projectRes = await pool.request()
      .input('ProjectId', sql.NVarChar(100), projectId)
      .execute('usp_Submission_GetDetail');

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
        .input('Role', sql.NVarChar(50), 'BOD')
        .execute('usp_User_GetEmailsByRole');
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
        .execute('usp_User_GetRoleAndDept');
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

/**
 * Đẩy yêu cầu duyệt của PRD vào SharePoint List hàng đợi CSR_PRD_Approval_Queue
 * để kích hoạt Power Automate → Teams Approvals.
 */
async function sendPRDApprovalToSharePointQueue(submission, pool) {
  try {
    const projectId = submission.Project_id || submission.projectId || 'Unknown';

    // 1. Truy vấn thông tin chi tiết đơn từ SQL Server để đảm bảo có đầy đủ dữ liệu
    const projectRes = await pool.request()
      .input('ProjectId', sql.NVarChar(100), projectId)
      .execute('usp_Submission_GetDetail');

    const project = projectRes.recordset?.[0];
    if (!project) {
      throw new Error(`Không tìm thấy đơn tiếp đón với ID: ${projectId} trong database`);
    }

    const customer = project.CustomerName || 'Unknown';
    const topic = project.MeetingTopic || 'Không có chủ đề';

    // 2. Tự động xác định email của PRD trong hệ thống
    let prdEmail = '';
    const prdRes = await pool.request()
      .input('Role', sql.NVarChar(50), 'PRD')
      .execute('usp_User_GetEmailsByRole');
    const emails = prdRes.recordset.map(r => r.Email.trim()).filter(Boolean);
    if (emails.length > 0) {
      prdEmail = emails.join(';');
    } else {
      prdEmail = 'minht@vietsuncorp.com.vn'; // Fallback
    }

    // 3. Xác định Team
    let teamName = 'PRD';
    if (project.SubmitterMNV) {
      const userRes = await pool.request()
        .input('MNV', sql.NVarChar(50), project.SubmitterMNV)
        .execute('usp_User_GetRoleAndDept');
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
        console.error('[PRD Approval Queue] Failed to parse AgendaJsonData:', e.message);
      }
    }

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

    let destinationStr = '—';
    if (agendaJson && agendaJson.length > 0) {
      const dests = agendaJson.flatMap(day => Object.keys(day.agenda || {}));
      const uniqueDests = [...new Set(dests)].filter(Boolean);
      if (uniqueDests.length > 0) destinationStr = uniqueDests.join(', ');
    }

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
        console.error('[PRD Approval Queue] Failed to parse GuestReps:', e.message);
      }
    }

    // 5. Kết nối SharePoint và ghi vào list CSR_PRD_Approval_Queue
    const accessToken = await getAccessToken();
    const siteId = await getSharePointSiteId(accessToken);
    const queueListName = process.env.SHAREPOINT_PRD_APPROVAL_QUEUE_LIST_ID || 'CSR_PRD_Approval_Queue';

    const itemPayload = {
      fields: {
        Title: `PRD Approval Request - ${customer}`,
        ProjectId: projectId,
        BOD_Email: prdEmail.trim(),
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

    console.log(`[PRD Approval Queue] ✅ Successfully added project ${projectId} to SharePoint Approval Queue for PRD: ${prdEmail}`);
  } catch (error) {
    console.error(`[PRD Approval Queue] ❌ Failed to add project ${submission.Project_id || 'Unknown'} to SharePoint Queue:`, error.message);
    throw error;
  }
}

let isPrdSyncing = false;
/**
 * Đồng bộ kết quả phê duyệt của PRD từ SharePoint List kết quả CSR_PRD_Approval_Results về SQL Server local
 */
async function syncPRDApprovalResults() {
  if (isPrdSyncing) {
    return;
  }
  isPrdSyncing = true;
  try {
    const accessToken = await getAccessToken();
    const siteId = await getSharePointSiteId(accessToken);
    const pool = await getCsrPool();

    const resultsListName = process.env.SHAREPOINT_PRD_APPROVAL_RESULTS_LIST_ID || 'CSR_PRD_Approval_Results';

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

    console.log(`[PRD Approval Sync] Found ${items.length} PRD approval response(s) to process.`);

    const { syncNewCustomerReps } = require('./customerRepsSync');

    for (const item of items) {
      const fields = item.fields;
      const itemId = item.id;
      const projectId = fields.ProjectId;
      const outcome = fields.ApprovalOutcome;
      const comments = fields.PRD_Comments || fields.BOD_Comments || fields.Comments || '';

      if (!projectId || !outcome) {
        continue;
      }

      let dbSuccess = false;

      try {
        if (outcome === 'Approve' || outcome === 'Approved' || outcome === 'Accept') {
          // Gọi stored procedure duyệt đơn dưới vai trò PRD
          const result = await pool.request()
            .input('ProjectId', sql.NVarChar(100), projectId)
            .input('ActorRole', sql.NVarChar(50), 'PRD')
            .input('ActorMNV', sql.NVarChar(50), 'TEAMS_PRD')
            .input('ActorName', sql.NVarChar(200), 'PRD Teams Approval')
            .input('Note', sql.NVarChar(sql.MAX), comments || 'Được duyệt qua Teams Approval App')
            .execute('usp_ApproveSubmission');

          const row = result.recordset?.[0];
          await logAuditAction('Phê duyệt đơn', 'TEAMS_PRD', `Duyệt đơn qua MS Teams`, projectId);
          await sendNotification(`Đơn ${projectId} đã được phê duyệt bởi PRD (qua Teams)`, 'TEAMS_PRD', projectId);

          if (row?.NewStatus === 'PRD đã duyệt') {
            const projRes = await pool.request()
              .input('ProjectId', sql.NVarChar(100), projectId)
              .execute('usp_Project_GetParentAndVersion');
            const customerType = projRes.recordset?.[0]?.CustomerType;
            const isSpecialType = ['Partner', 'Supplier', 'Khách vãng lai', 'Ứng viên phỏng vấn'].includes(customerType);

            if (isSpecialType) {
              await syncNewCustomerReps(projectId, pool);
              handleBODApprovalActions(projectId, pool).catch(err => {
                console.error('[PRD Approval Workflows] Background workflows failed:', err);
              });
            } else {
              // Gửi tiếp lên BOD queue cho Brand
              const pRes = await pool.request()
                .input('ProjectId', sql.NVarChar(100), projectId)
                .execute('usp_GetProjectForTeams');
              if (pRes.recordset.length > 0) {
                await sendBODApprovalToSharePointQueue(pRes.recordset[0], pool).catch(err => {
                  console.error('[PRD Sync] BOD queue error:', err.message);
                });
              }
            }
          }
          dbSuccess = true;

        } else if (outcome === 'Reject' || outcome === 'Rejected' || outcome === 'Deny') {
          await pool.request()
            .input('ProjectId', sql.NVarChar(100), projectId)
            .input('ActorRole', sql.NVarChar(50), 'PRD')
            .input('ActorMNV', sql.NVarChar(50), 'TEAMS_PRD')
            .input('ActorName', sql.NVarChar(200), 'PRD Teams Approval')
            .input('Reason', sql.NVarChar(sql.MAX), comments || 'Từ chối qua Teams Approval App')
            .execute('usp_RejectSubmission');

          await logAuditAction('Từ chối đơn', 'TEAMS_PRD', `Từ chối đơn qua MS Teams`, projectId);
          await sendNotification(`Đơn ${projectId} đã bị TỪ CHỐI bởi PRD (qua Teams)`, 'TEAMS_PRD', projectId);
          dbSuccess = true;
        }
      } catch (dbErr) {
        console.error(`[PRD Approval Sync] DB update failed for ${projectId}:`, dbErr.message);
        if (dbErr.message.includes('không tìm thấy') || dbErr.message.includes('đã được') || dbErr.message.includes('Chỉ duyệt được đơn')) {
          dbSuccess = true;
        }
      }

      if (dbSuccess) {
        try {
          const deleteUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${resultsListName}/items/${itemId}`;
          await axios.delete(deleteUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: 8000
          });
        } catch (delErr) {
          console.error(`[PRD Approval Sync] Delete error:`, delErr.message);
        }
      }
    }
  } catch (err) {
    console.error('[PRD Approval Sync] Error:', err.message);
  } finally {
    isPrdSyncing = false;
  }
}

function startPRDApprovalSyncScheduler() {
  console.log('[PRD Approval Sync Scheduler] ⏰ Registered. Checking every 30 seconds...');
  setTimeout(() => {
    syncPRDApprovalResults().catch(err => {
      console.error('[PRD Approval Sync Scheduler] Initial scan failed:', err.message);
    });
  }, 20000);

  setInterval(async () => {
    await syncPRDApprovalResults();
  }, 30000);
}

/**
 * Huỷ (xoá) các item Approval Queue đang chờ xử lý (chưa được Power Automate/Teams xử lý xong)
 * ứng với 1 ProjectId, trên cả 2 list Queue (PRD, BOD).
 * Dùng khi người dùng huỷ/sửa đơn ở trạng thái "Chờ phản hồi" - để ngăn thẻ Teams được gửi
 * (nếu Power Automate CHƯA kịp trigger) hoặc dọn dẹp hàng đợi (nếu đã trigger nhưng chưa xử lý).
 *
 * LƯU Ý QUAN TRỌNG: nếu thẻ Approval đã được gửi lên Teams của người duyệt rồi (Power Automate
 * đã trigger), việc xoá item Queue này KHÔNG thể "thu hồi" thẻ đã hiển thị trong Teams - thẻ đó
 * vẫn còn và có thể bị bấm. Tuy nhiên, nhờ guard OldStatus ở usp_ApproveSubmission/usp_RejectSubmission,
 * nếu ai đó bấm vào thẻ cũ sau khi đơn đã bị huỷ/sửa, hệ thống sẽ từ chối an toàn (không ghi đè sai).
 */
async function cancelPendingApprovalQueueItem(projectId) {
  const results = { prd: 0, bod: 0 };
  try {
    const accessToken = await getAccessToken();
    const siteId = await getSharePointSiteId(accessToken);

    const lists = [
      { key: 'prd', name: process.env.SHAREPOINT_PRD_APPROVAL_QUEUE_LIST_ID || 'CSR_PRD_Approval_Queue' },
      { key: 'bod', name: process.env.SHAREPOINT_BOD_APPROVAL_QUEUE_LIST_ID || 'CSR_BOD_Approval_Queue' },
    ];

    for (const list of lists) {
      try {
        const getUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${list.name}/items?$expand=fields&$filter=fields/ProjectId eq '${projectId}'`;
        const res = await axios.get(getUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 8000
        });
        const items = res.data.value || [];
        for (const item of items) {
          try {
            await axios.delete(
              `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${list.name}/items/${item.id}`,
              { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 8000 }
            );
            results[list.key]++;
          } catch (delErr) {
            console.error(`[Cancel Approval Queue] ❌ Failed to delete item ${item.id} from ${list.name}:`, delErr.message);
          }
        }
      } catch (listErr) {
        // Không chặn luồng chính (huỷ/sửa đơn) nếu SharePoint lỗi - chỉ log để theo dõi
        console.error(`[Cancel Approval Queue] ⚠️ Failed to query ${list.name} for project ${projectId}:`, listErr.message);
      }
    }

    if (results.prd > 0 || results.bod > 0) {
      console.log(`[Cancel Approval Queue] 🗑️ Removed pending queue items for project ${projectId}: PRD=${results.prd}, BOD=${results.bod}`);
    }
  } catch (err) {
    console.error(`[Cancel Approval Queue] ❌ Error cancelling pending approval for project ${projectId}:`, err.message);
  }
  return results;
}

module.exports = {
  sendBODApprovalToSharePointQueue,
  syncBODApprovalResults,
  startBODApprovalSyncScheduler,
  sendPRDApprovalToSharePointQueue,
  syncPRDApprovalResults,
  startPRDApprovalSyncScheduler,
  cancelPendingApprovalQueueItem
};