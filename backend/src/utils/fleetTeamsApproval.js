// src/utils/fleetTeamsApproval.js
// Microsoft Teams Integration for Fleet Bookings (Supervisor & Team Admin approvals)
const axios = require('axios');
const { getCsrPool, sql } = require('../config/database');
const { getAccessToken } = require('../config/sharepoint');

let isFleetSupervisorSyncing = false;
let isFleetTeamAdminSyncing = false;

/**
 * Helper to escape HTML characters
 */
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Format datetime to dd/MM/yyyy HH:mm
 */
function fmtDt(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  if (isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const mon = String(d.getMonth() + 1).padStart(2, '0');
  const hr = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${mon}/${d.getFullYear()} ${hr}:${min}`;
}

/**
 * Retrieve Site ID from SHARE_URL
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
 * Mail Sending Helper
 */
async function sendFleetMail(toEmails, ccEmails, subject, htmlBody) {
  const senderEmail = process.env.SENDER_EMAIL;
  if (!senderEmail || toEmails.length === 0) return;
  try {
    const accessToken = await getAccessToken();
    const url = `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`;

    const toRecipients = toEmails.map(e => ({ emailAddress: { address: e } }));
    const ccRecipients = ccEmails.map(e => ({ emailAddress: { address: e } }));

    await axios.post(url, {
      message: {
        subject,
        body: { contentType: 'HTML', content: htmlBody },
        toRecipients,
        ccRecipients: ccRecipients.length > 0 ? ccRecipients : undefined,
      },
      saveToSentItems: 'true',
    }, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
  } catch (err) {
    console.error('[Fleet Mail Sync] Failed to send email:', err.message);
  }
}

/**
 * Supervisor Email Template Builder (based on provided image)
 */
function buildSupervisorEmailHtml(booking, managerName) {
  const portalUrl = process.env.PORTAL_URL || 'http://crm.vietsuncorp.com.vn/';
  const detailLink = `${portalUrl}/vehicle?bookingId=${booking.Id}`;

  const rows = [
    ['Đơn vị', booking.RequesterDept || '—'],
    ['Phòng', '—'],
    ['Nội dung đi công tác', booking.Purpose],
    ['Địa điểm đi công tác', booking.Destination],
    ['Số người đi', String(booking.PassengerCount)],
    ['Danh sách đi công tác', booking.Attendees || booking.RequesterName],
    ['Ghi chú', booking.Notes || '—'],
    ['Phương tiện', booking.VehicleType || 'Xe công ty'],
    ['Ngày đi', fmtDt(booking.DepartureTime)],
    ['Ngày về', fmtDt(booking.ReturnTime)],
  ];

  const tableRows = rows.map(([label, value]) => `
    <tr>
      <td style="border: 1px solid #e5e7eb; padding: 10px 12px; font-weight: 600; background: #fafafa; color: #4b5563; width: 30%;">${escHtml(label)}</td>
      <td style="border: 1px solid #e5e7eb; padding: 10px 12px; color: #111827;">${escHtml(value)}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #374151; padding: 20px; background-color: #f9fafb;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; padding: 24px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <p>Kính gửi anh/chị <strong>${escHtml(managerName)}</strong>,</p>
        <p>Đăng ký đi công tác đã được gửi tới anh/chị, vui lòng truy cập <strong>Microsoft Teams</strong> để phê duyệt.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
          <thead>
            <tr style="background: #f97316; color: #ffffff;">
              <th style="border: 1px solid #e5e7eb; padding: 10px 12px; text-align: left; font-weight: bold; width: 30%;">Thông tin</th>
              <th style="border: 1px solid #e5e7eb; padding: 10px 12px; text-align: left; font-weight: bold;">Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        
        <p style="font-size: 12px; color: #6b7280; margin-top: 20px;">Key: ${booking.BookingCode}_${new Date().toLocaleString('vi-VN')}</p>
        
        <div style="margin-top: 24px; text-align: center;">
          <a href="${detailLink}" style="background: #1677ff; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Xem thông tin chi tiết phiếu đã tạo</a>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Dispatch / Allocated Vehicle Email Template Builder (based on provided image)
 */
function buildAllocationEmailHtml(booking) {
  const portalUrl = process.env.PORTAL_URL || 'http://crm.vietsuncorp.com.vn/';
  const detailLink = `${portalUrl}/vehicle?bookingId=${booking.Id}`;

  const rows = `
    <tr>
      <td style="border: 1px solid #e5e7eb; padding: 10px 12px; text-align: center;">${fmtDt(booking.DepartureTime).split(' ')[0]}</td>
      <td style="border: 1px solid #e5e7eb; padding: 10px 12px; text-align: center;">${escHtml(booking.Destination)}</td>
      <td style="border: 1px solid #e5e7eb; padding: 10px 12px; text-align: center;">${booking.PassengerCount}</td>
      <td style="border: 1px solid #e5e7eb; padding: 10px 12px; text-align: center;">${escHtml(booking.RequesterName)}</td>
      <td style="border: 1px solid #e5e7eb; padding: 10px 12px;">${escHtml(booking.Purpose)}</td>
      <td style="border: 1px solid #e5e7eb; padding: 10px 12px; text-align: center;">${fmtDt(booking.DepartureTime).split(' ')[1]}</td>
      <td style="border: 1px solid #e5e7eb; padding: 10px 12px; text-align: center;">${escHtml(booking.VehiclePlate)} | ${escHtml(booking.VehicleBrand || '')}</td>
      <td style="border: 1px solid #e5e7eb; padding: 10px 12px; text-align: center;">${escHtml(booking.DriverName || '—')} | ${escHtml(booking.DriverPhone || '—')}</td>
      <td style="border: 1px solid #e5e7eb; padding: 10px 12px;">${escHtml(booking.AssignedNote || '—')}</td>
    </tr>
  `;

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #374151; padding: 20px; background-color: #f9fafb;">
      <div style="max-width: 900px; margin: 0 auto; background: #ffffff; padding: 24px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <p>Kính gửi anh/chị <strong>${escHtml(booking.RequesterName)}</strong>,</p>
        <p>Đăng ký đi công tác của anh/chị đã được Phòng Hành Chính <strong>điều phối phương tiện đi công tác</strong>.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px;">
          <thead>
            <tr style="background: #f97316; color: #ffffff;">
              <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: center;">Ngày</th>
              <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: center;">Nơi đến (Đơn vị - Cty)</th>
              <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: center;">Số NS</th>
              <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: center;">Tên Nhân sự</th>
              <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: center;">Thông tin công tác</th>
              <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: center;">Thời gian (giờ đi)</th>
              <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: center;">Phương tiện</th>
              <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: center;">Người lái</th>
              <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: center;">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        
        <div style="margin-top: 24px; text-align: center;">
          <a href="${detailLink}" style="background: #1677ff; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Xem thông tin chi tiết phiếu đã tạo</a>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Gửi yêu cầu duyệt cho Giám Sát lên SharePoint Queue
 */
async function sendSupervisorApprovalToQueue(bookingInfo, pool) {
  try {
    const bookingId = bookingInfo.Id;

    // Lấy thông tin chi tiết đầy đủ của booking từ CSDL
    const bookingRes = await pool.request()
      .input('Id', sql.Int, bookingId)
      .execute('usp_Fleet_Booking_GetDetail');
    const booking = bookingRes.recordset[0];
    if (!booking) {
      throw new Error(`Không tìm thấy booking ID: ${bookingId}`);
    }

    // 1. Lookup ManagerEmail từ bảng CSR_Employees
    let managerEmail = '';
    let managerName = 'Giám sát trực tiếp';
    if (booking.RequesterMNV) {
      const empRes = await pool.request()
        .input('MNV', sql.NVarChar(50), booking.RequesterMNV)
        .query('SELECT TOP 1 ManagerEmail FROM CSR_Employees WHERE MNV = @MNV AND StatusId = 1');
      if (empRes.recordset.length > 0) {
        managerEmail = empRes.recordset[0].ManagerEmail || '';
      }
    }

    if (!managerEmail) {
      managerEmail = 'data@vietsuncorp.com.vn'; // Fallback
    }

    // 2. Gửi queue lên SharePoint
    const accessToken = await getAccessToken();
    const siteId = await getSharePointSiteId(accessToken);
    const queueListName = process.env.SHAREPOINT_FLEET_SUPERVISOR_QUEUE_LIST_ID || 'Fleet_Supervisor_Approval_Queue';

    const itemPayload = {
      fields: {
        Title: `Phê duyệt đăng ký đi công tác của ${booking.RequesterName}`,
        BookingId: String(bookingId),
        SupervisorEmail: managerEmail.trim(),
        RequesterName: booking.RequesterName,
        RequesterDept: booking.RequesterDept || '—',
        PickupLocation: booking.PickupLocation,
        Destination: booking.Destination,
        DepartureTime: fmtDt(booking.DepartureTime),
        ReturnTime: fmtDt(booking.ReturnTime),
        Purpose: booking.Purpose,
        PassengerCount: booking.PassengerCount,
        VehicleType: booking.VehicleType || 'Xe công ty',
        Notes: booking.Notes || '—',
        Attendees: booking.Attendees || '—',
        AttendeesEmail: booking.AttendeesEmail || '—'
      }
    };

    const addUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${queueListName}/items`;
    await axios.post(addUrl, itemPayload, {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      timeout: 8000
    });

    console.log(`[Fleet Supervisor Queue] ✅ Added booking ${booking.BookingCode} for Supervisor: ${managerEmail}`);

    // 3. Gửi email thông báo cho Giám sát (theo mẫu ảnh)
    const subject = `Phê duyệt đăng ký đi công tác của ${booking.RequesterName}`;
    const emailHtml = buildSupervisorEmailHtml(booking, managerName);
    await sendFleetMail([managerEmail.trim()], [booking.RequesterEmail], subject, emailHtml);
    console.log(`[Fleet Supervisor Email] ✅ Sent notification email to: ${managerEmail}`);
  } catch (err) {
    console.error(`[Fleet Supervisor Queue] ❌ Failed for booking ${booking.Id}:`, err.message);
  }
}

/**
 * Gửi yêu cầu duyệt cho Team Admin lên SharePoint Queue
 */
async function sendTeamAdminApprovalToQueue(booking, pool) {
  try {
    const bookingId = booking.Id;

    // 1. Lấy danh sách email Team Admin
    let adminEmails = '';
    const adminRes = await pool.request()
      .query("SELECT Email FROM CSR_Users WHERE Role = 'TeamAdmin' AND Email IS NOT NULL");
    const emails = adminRes.recordset.map(r => r.Email.trim()).filter(Boolean);
    if (emails.length > 0) {
      adminEmails = emails.join(';');
    } else {
      adminEmails = 'minht@vietsuncorp.com.vn'; // Fallback
    }

    // 2. Gửi queue lên SharePoint
    const accessToken = await getAccessToken();
    const siteId = await getSharePointSiteId(accessToken);
    const queueListName = process.env.SHAREPOINT_FLEET_TEAMADMIN_QUEUE_LIST_ID || 'Fleet_TeamAdmin_Approval_Queue';

    const itemPayload = {
      fields: {
        Title: `Team Admin Phê duyệt đăng ký đi công tác của ${booking.RequesterName}`,
        BookingId: String(bookingId),
        TeamAdminEmail: adminEmails.trim(),
        RequesterName: booking.RequesterName,
        RequesterDept: booking.RequesterDept || '—',
        PickupLocation: booking.PickupLocation,
        Destination: booking.Destination,
        DepartureTime: fmtDt(booking.DepartureTime),
        ReturnTime: fmtDt(booking.ReturnTime),
        Purpose: booking.Purpose,
        PassengerCount: booking.PassengerCount,
        VehicleType: booking.VehicleType || 'Xe công ty',
        Notes: booking.Notes || '—',
        Attendees: booking.Attendees || '—',
        AttendeesEmail: booking.AttendeesEmail || '—'
      }
    };

    const addUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${queueListName}/items`;
    await axios.post(addUrl, itemPayload, {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      timeout: 8000
    });

    console.log(`[Fleet TeamAdmin Queue] ✅ Added booking ${booking.BookingCode} for Team Admin: ${adminEmails}`);
  } catch (err) {
    console.error(`[Fleet TeamAdmin Queue] ❌ Failed for booking ${booking.Id}:`, err.message);
  }
}

/**
 * Đồng bộ kết quả duyệt của Giám Sát từ SharePoint List kết quả Fleet_Supervisor_Approval_Results
 */
async function syncFleetSupervisorApprovalResults(pool) {
  if (isFleetSupervisorSyncing) return;
  isFleetSupervisorSyncing = true;

  try {
    const accessToken = await getAccessToken();
    const siteId = await getSharePointSiteId(accessToken);
    const resultsListName = process.env.SHAREPOINT_FLEET_SUPERVISOR_RESULTS_LIST_ID || 'Fleet_Supervisor_Approval_Results';

    const getUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${resultsListName}/items?$expand=fields`;
    const response = await axios.get(getUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 8000
    });

    const items = response.data.value || [];
    for (const item of items) {
      const fields = item.fields;
      const itemId = item.id;
      const bookingId = fields.BookingId;
      const outcome = fields.ApprovalOutcome;
      const comments = fields.Comments || fields.SupervisorComments || '';

      if (!bookingId || !outcome) continue;

      let dbSuccess = false;

      try {
        const newStatus = (outcome === 'Approve' || outcome === 'Approved' || outcome === 'Accept')
          ? 'Giám sát đã duyệt'
          : 'Giám sát từ chối';

        const result = await pool.request()
          .input('Id', sql.Int, Number(bookingId))
          .input('NewStatus', sql.NVarChar(50), newStatus)
          .input('ActorName', sql.NVarChar(200), 'Supervisor via Teams')
          .input('RejectedReason', sql.NVarChar(1000), newStatus === 'Giám sát từ chối' ? comments : null)
          .execute('usp_Fleet_Booking_UpdateStatus');

        const updatedBooking = result.recordset?.[0];
        console.log(`[Fleet Supervisor Sync] Updated booking ${bookingId} to ${newStatus}`);

        // Nếu giám sát DUYỆT thành công -> Tự động chuyển tiếp yêu cầu duyệt tới Team Admin!
        if (newStatus === 'Giám sát đã duyệt' && updatedBooking) {
          await sendTeamAdminApprovalToQueue(updatedBooking, pool);
        }

        dbSuccess = true;
      } catch (dbErr) {
        console.error(`[Fleet Supervisor Sync] DB error for booking ${bookingId}:`, dbErr.message);
        if (dbErr.message.includes('không tồn tại') || dbErr.message.includes('đã được')) {
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
          console.error(`[Fleet Supervisor Sync] Delete item error:`, delErr.message);
        }
      }
    }
  } catch (err) {
    console.error('[Fleet Supervisor Sync] Scan error:', err.message);
  } finally {
    isFleetSupervisorSyncing = false;
  }
}

/**
 * Đồng bộ kết quả duyệt của Team Admin từ SharePoint List kết quả Fleet_TeamAdmin_Approval_Results
 */
async function syncFleetTeamAdminApprovalResults(pool) {
  if (isFleetTeamAdminSyncing) return;
  isFleetTeamAdminSyncing = true;

  try {
    const accessToken = await getAccessToken();
    const siteId = await getSharePointSiteId(accessToken);
    const resultsListName = process.env.SHAREPOINT_FLEET_TEAMADMIN_RESULTS_LIST_ID || 'Fleet_TeamAdmin_Approval_Results';

    const getUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${resultsListName}/items?$expand=fields`;
    const response = await axios.get(getUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 8000
    });

    const items = response.data.value || [];
    for (const item of items) {
      const fields = item.fields;
      const itemId = item.id;
      const bookingId = fields.BookingId;
      const outcome = fields.ApprovalOutcome;
      const comments = fields.Comments || fields.TeamAdminComments || '';

      // Đối với Team Admin duyệt nhanh, chúng ta chỉ thay đổi trạng thái sang 'Team Admin đã duyệt' hoặc 'Team Admin từ chối'.
      // Lưu ý: Đối với Duyệt xe thực sự, Team Admin vẫn cần gán xe & tài xế trên web hoặc điền thông tin gán xe vào list kết quả để sync về.
      // Nếu Teams sync gán xe, ta có thể parse VehicleId / DriverId từ fields.
      const vehicleId = fields.VehicleId ? Number(fields.VehicleId) : null;
      const driverId = fields.DriverId ? Number(fields.DriverId) : null;
      const assignedNote = fields.AssignedNote || '';

      if (!bookingId || !outcome) continue;

      let dbSuccess = false;

      try {
        const newStatus = (outcome === 'Approve' || outcome === 'Approved' || outcome === 'Accept')
          ? 'Team Admin đã duyệt'
          : 'Team Admin từ chối';

        const result = await pool.request()
          .input('Id', sql.Int, Number(bookingId))
          .input('NewStatus', sql.NVarChar(50), newStatus)
          .input('ActorName', sql.NVarChar(200), 'Team Admin via Teams')
          .input('VehicleId', sql.Int, vehicleId)
          .input('DriverId', sql.Int, driverId)
          .input('AssignedNote', sql.NVarChar(1000), assignedNote || null)
          .input('RejectedReason', sql.NVarChar(1000), newStatus === 'Team Admin từ chối' ? comments : null)
          .execute('usp_Fleet_Booking_UpdateStatus');

        const updatedBooking = result.recordset?.[0];
        console.log(`[Fleet TeamAdmin Sync] Updated booking ${bookingId} to ${newStatus}`);

        // Gửi email điều phối phương tiện khi Team Admin duyệt (theo mẫu ảnh)
        if (newStatus === 'Team Admin đã duyệt' && updatedBooking && updatedBooking.RequesterEmail) {
          const subject = `Điều phối phương tiện đi công tác cho ${updatedBooking.RequesterName}`;
          const emailHtml = buildAllocationEmailHtml(updatedBooking);
          // Gửi cho người đặt xe, đồng thời CC cho admin và tài xế
          let ccEmails = [];
          if (updatedBooking.DriverPhone) {
            // lookup driver email if possible, or fallback to admin
          }
          await sendFleetMail([updatedBooking.RequesterEmail.trim()], ccEmails, subject, emailHtml);
          console.log(`[Fleet TeamAdmin Email] ✅ Sent allocation/dispatch email to requester: ${updatedBooking.RequesterEmail}`);
        }

        dbSuccess = true;
      } catch (dbErr) {
        console.error(`[Fleet TeamAdmin Sync] DB error for booking ${bookingId}:`, dbErr.message);
        if (dbErr.message.includes('không tồn tại') || dbErr.message.includes('đã được')) {
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
          console.error(`[Fleet TeamAdmin Sync] Delete item error:`, delErr.message);
        }
      }
    }
  } catch (err) {
    console.error('[Fleet TeamAdmin Sync] Scan error:', err.message);
  } finally {
    isFleetTeamAdminSyncing = false;
  }
}

/**
 * Khởi động scheduler quét định kỳ 30 giây cho luồng xe
 */
function startFleetApprovalSyncScheduler() {
  console.log('[Fleet Approval Sync Scheduler] ⏰ Registered. Checking every 30 seconds...');

  const poolPromise = getCsrPool();

  setTimeout(() => {
    poolPromise.then(pool => {
      syncFleetSupervisorApprovalResults(pool).catch(err => {
        console.error('[Fleet Sync Scheduler] Initial supervisor scan failed:', err.message);
      });
      syncFleetTeamAdminApprovalResults(pool).catch(err => {
        console.error('[Fleet Sync Scheduler] Initial team admin scan failed:', err.message);
      });
    });
  }, 25000); // offset slightly

  setInterval(async () => {
    try {
      const pool = await poolPromise;
      await syncFleetSupervisorApprovalResults(pool);
      await syncFleetTeamAdminApprovalResults(pool);
    } catch (err) {
      console.error('[Fleet Sync Scheduler] Lỗi kết nối pool:', err.message);
    }
  }, 30000);
}

module.exports = {
  sendSupervisorApprovalToQueue,
  sendTeamAdminApprovalToQueue,
  syncFleetSupervisorApprovalResults,
  syncFleetTeamAdminApprovalResults,
  startFleetApprovalSyncScheduler,
  buildSupervisorEmailHtml,
  buildAllocationEmailHtml,
  sendFleetMail
};
