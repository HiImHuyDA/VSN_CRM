// src/utils/fleetNotification.js
// Xu ly gui email thong bao cho module Quan Ly Xe (Fleet Management)
const axios = require('axios');
const { getAccessToken } = require('../config/sharepoint');
const { getCsrPool, sql } = require('../config/database');

/**
 * Tien ich HTML escape
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
 * Format datetime VN
 */
function fmtDt(dt) {
    if (!dt) return '—';
    const d = new Date(dt);
    if (isNaN(d.getTime())) return '—';
    const day  = String(d.getDate()).padStart(2, '0');
    const mon  = String(d.getMonth() + 1).padStart(2, '0');
    const hr   = String(d.getHours()).padStart(2, '0');
    const min  = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${mon}/${d.getFullYear()} ${hr}:${min}`;
}

/**
 * Tao HTML body cho email dat xe
 */
function buildBookingEmailHtml(booking, prefixHtml = '') {
    const rows = [
        ['Mã đặt xe',       booking.BookingCode],
        ['Người đặt',       booking.RequesterName],
        ['Phòng ban',       booking.RequesterDept || '—'],
        ['Điểm đón',        booking.PickupLocation],
        ['Điểm đến',        booking.Destination],
        ['Giờ khởi hành',   fmtDt(booking.DepartureTime)],
        ['Giờ về (dự kiến)', fmtDt(booking.ReturnTime)],
        ['Số hành khách',   String(booking.PassengerCount || 1)],
        ['Độ ưu tiên',      booking.Priority || 'Bình thường'],
        ['Mục đích',        booking.Purpose],
        ['Trạng thái',      booking.Status],
    ];

    if (booking.Attendees) {
        rows.push(['Người tham gia đi cùng', booking.Attendees]);
    }

    if (booking.VehiclePlate) {
        rows.push(['Xe phân công', `${booking.VehiclePlate} - ${booking.VehicleBrand || ''} ${booking.VehicleModel || ''}`.trim()]);
    }
    if (booking.DriverName) {
        rows.push(['Tài xế',  booking.DriverName]);
        rows.push(['SĐT tài xế', booking.DriverPhone || '—']);
    }
    if (booking.AssignedNote) {
        rows.push(['Ghi chú phân công', booking.AssignedNote]);
    }

    const tableRows = rows.map(([label, value]) => `
        <tr>
            <td style="border:1px solid #ddd;padding:9px 12px;font-weight:600;width:35%;background:#fafafa;color:#333;">${escHtml(label)}</td>
            <td style="border:1px solid #ddd;padding:9px 12px;color:#1d1d1d;">${escHtml(value)}</td>
        </tr>`).join('');

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:20px;">
    <p>Kính gửi,</p>
    ${prefixHtml}
    <h3 style="color:#1677ff;margin-bottom:12px;">📋 Thông Tin Yêu Cầu Xe</h3>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;">
        <tbody>${tableRows}</tbody>
    </table>
    <div style="margin-top:24px;font-size:13px;color:#555;">
        <p>Vui lòng đăng nhập hệ thống CRM để xem chi tiết và thực hiện phê duyệt.</p>
        <p>Xin cảm ơn.</p>
        <p>Thân ái,<br/><strong>Hệ thống CRM Vietsun</strong></p>
    </div>
</body>
</html>`;
}

/**
 * Gui email thong bao qua Microsoft Graph API
 */
async function sendFleetEmail(toEmails, ccEmails, subject, htmlBody) {
    const senderEmail = process.env.SENDER_EMAIL;
    if (!senderEmail || toEmails.length === 0) return;

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
}

/**
 * Email 1: Gui cho nhom Admin khi co booking moi duoc tao
 * (Thong bao can phe duyet)
 */
async function notifyAdminNewBooking(booking, pool) {
    try {
        if (!pool) pool = await getCsrPool();

        // Lay danh sach email Admin tu SP
        const adminRes = await pool.request().execute('usp_Fleet_GetTeamAdminEmails');
        const adminEmails = (adminRes.recordset || [])
            .map(r => r.Email?.trim())
            .filter(e => e && e.includes('@'));

        if (adminEmails.length === 0) {
            console.warn('[Fleet Email] ⚠️ No Admin emails found. Skipping new booking notification.');
            return;
        }

        const prefixHtml = `
            <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:10px 14px;margin-bottom:18px;border-radius:4px;">
                <strong>📌 Có yêu cầu đặt xe mới cần phê duyệt</strong><br/>
                <span style="font-size:13px;color:#555;">Người đặt: <b>${escHtml(booking.RequesterName)}</b> — Mã: <b>${escHtml(booking.BookingCode)}</b></span>
            </div>`;

        const htmlBody = buildBookingEmailHtml(booking, prefixHtml);
        const subject = `[CRM - Đặt Xe] Yêu cầu mới cần duyệt: ${booking.BookingCode}`;

        // Cc: email cua nguoi dat xe
        const ccEmails = booking.RequesterEmail ? [booking.RequesterEmail.trim()] : [];

        await sendFleetEmail(adminEmails, ccEmails, subject, htmlBody);
        console.log(`[Fleet Email] ✅ New booking notification sent to ${adminEmails.length} admin(s) for ${booking.BookingCode}`);
    } catch (err) {
        console.error('[Fleet Email] ❌ Failed to send new booking notification:', err.message);
    }
}

/**
 * Email 2: Gui cho nguoi dat xe khi booking duoc duyet
 * (Thong bao da duyet + thong tin xe & tai xe)
 */
async function notifyRequesterApproved(booking, pool) {
    try {
        if (!booking.RequesterEmail) {
            console.warn(`[Fleet Email] ⚠️ No RequesterEmail for booking ${booking.BookingCode}. Skipping approval notification.`);
            return;
        }

        if (!pool) pool = await getCsrPool();

        // Lay Admin emails de CC
        const adminRes = await pool.request().execute('usp_Fleet_GetTeamAdminEmails');
        const adminEmails = (adminRes.recordset || [])
            .map(r => r.Email?.trim())
            .filter(e => e && e.includes('@'));

        const prefixHtml = `
            <div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:10px 14px;margin-bottom:18px;border-radius:4px;">
                <strong>✅ Yêu cầu đặt xe của bạn đã được phê duyệt</strong><br/>
                <span style="font-size:13px;color:#555;">Mã đặt xe: <b>${escHtml(booking.BookingCode)}</b> — Duyệt bởi: <b>${escHtml(booking.ApprovedBy || 'Admin')}</b></span>
            </div>`;

        const htmlBody = buildBookingEmailHtml(booking, prefixHtml);
        const subject = `[CRM - Đặt Xe] Yêu cầu đã được duyệt: ${booking.BookingCode}`;

        await sendFleetEmail([booking.RequesterEmail.trim()], adminEmails, subject, htmlBody);
        console.log(`[Fleet Email] ✅ Approval notification sent to ${booking.RequesterEmail} for ${booking.BookingCode}`);
    } catch (err) {
        console.error('[Fleet Email] ❌ Failed to send approval notification:', err.message);
    }
}

/**
 * Email: Thong bao tu choi booking
 */
async function notifyRequesterRejected(booking) {
    try {
        if (!booking.RequesterEmail) return;

        const prefixHtml = `
            <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:10px 14px;margin-bottom:18px;border-radius:4px;">
                <strong>❌ Yêu cầu đặt xe của bạn đã bị từ chối</strong><br/>
                <span style="font-size:13px;color:#555;">Lý do: <b>${escHtml(booking.RejectedReason || 'Không có lý do cụ thể')}</b></span>
            </div>`;

        const htmlBody = buildBookingEmailHtml(booking, prefixHtml);
        const subject = `[CRM - Đặt Xe] Yêu cầu bị từ chối: ${booking.BookingCode}`;

        await sendFleetEmail([booking.RequesterEmail.trim()], [], subject, htmlBody);
        console.log(`[Fleet Email] ✅ Rejection notification sent to ${booking.RequesterEmail} for ${booking.BookingCode}`);
    } catch (err) {
        console.error('[Fleet Email] ❌ Failed to send rejection notification:', err.message);
    }
}

/**
 * Email 4: Gửi email tự động cho Ban Quản Lý / Nhân Sự Nhà Máy nếu điểm đến là Nhà Máy
 */
async function sendFactoryNotificationEmail(booking, pool) {
    try {
        if (!booking || !booking.Destination) return;
        if (!pool) pool = await getCsrPool();

        const destClean = booking.Destination.trim();

        // Query CSR_Locations to see if destination matches a location record
        const locRes = await pool.request()
            .input('Name', sql.NVarChar(100), destClean)
            .execute('usp_Location_GetNotificationEmails');

        const matchedLoc = locRes.recordset?.[0];
        if (!matchedLoc || !matchedLoc.NotificationEmails) {
            console.log(`[Fleet Email] ℹ️ Destination "${destClean}" is not a Factory location with notification emails. Skipping factory email.`);
            return;
        }

        const locName = matchedLoc.Name || destClean;
        const factoryEmails = matchedLoc.NotificationEmails
            .split(/[,;]/)
            .map(e => e.trim())
            .filter(e => e && e.includes('@'));

        if (factoryEmails.length === 0) {
            console.log(`[Fleet Email] ℹ️ Destination "${destClean}" has empty notification emails. Skipping factory email.`);
            return;
        }

        // Build display name of factory
        let factoryDisplayName = locName;
        if (locName === 'VDC') factoryDisplayName = 'Nhà Máy Việt Đức';
        else if (locName === 'VAC') factoryDisplayName = 'Nhà Máy VAC';
        else if (locName === 'VSN-DN') factoryDisplayName = 'Nhà Máy VSN DN';
        else if (locName === 'VSPY') factoryDisplayName = 'Nhà Máy VSPY';
        else if (locName === 'VSPM') factoryDisplayName = 'Nhà Máy VSPM';
        else if (locName === 'VSN-NT') factoryDisplayName = 'Nhà Máy VSN Ninh Thuận';
        else if (!factoryDisplayName.toLowerCase().includes('nhà máy')) {
            factoryDisplayName = `Nhà Máy ${factoryDisplayName}`;
        }

        // Department info
        const rawDept = booking.RequesterDept || '';
        let deptTitle = rawDept;
        if (!deptTitle.toLowerCase().includes('phòng')) {
            deptTitle = `Phòng ${deptTitle}`;
        }

        let unitName = 'HQ';
        if (rawDept.toUpperCase().startsWith('VDC') || rawDept.toUpperCase().startsWith('VAC')) {
            unitName = rawDept.slice(0, 3).toUpperCase();
        }

        // Subject & Header
        const subject = `${deptTitle} công tác tại ${factoryDisplayName}`;

        // Date formatting: dd/MM/yyyy
        const formatShortDate = (dt) => {
            if (!dt) return '—';
            const d = new Date(dt);
            if (isNaN(d.getTime())) return '—';
            const day = String(d.getDate()).padStart(2, '0');
            const mon = String(d.getMonth() + 1).padStart(2, '0');
            return `${day}/${mon}/${d.getFullYear()}`;
        };

        const depDateStr = formatShortDate(booking.DepartureTime);
        const retDateStr = formatShortDate(booking.ReturnTime || booking.DepartureTime);

        // List of accompanying attendees or requester
        const attendeesList = booking.Attendees || booking.RequesterName || '—';

        // Notes
        const notesStr = booking.Notes || booking.AssignedNote || '—';

        // Vehicle Type
        const vehicleTypeStr = booking.VehicleType || 'Xe công ty';

        // Build HTML table matching user image exactly
        const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:20px;">
    <p style="margin-bottom:16px;">Kính gửi Ban Quản lý ${escHtml(factoryDisplayName)},</p>
    <p style="margin-bottom:20px;">${escHtml(deptTitle)} sẽ có chuyến công tác tại ${escHtml(factoryDisplayName)}.</p>
    
    <table style="width:100%;max-width:650px;border-collapse:collapse;font-size:14px;margin-bottom:24px;border:1px solid #e0e0e0;">
        <thead>
            <tr style="background-color:#e67e22;color:#ffffff;text-align:left;">
                <th style="padding:10px 14px;border:1px solid #d35400;width:30%;">Thông tin</th>
                <th style="padding:10px 14px;border:1px solid #d35400;">Chi tiết</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td style="border:1px solid #e0e0e0;padding:10px 14px;font-weight:600;background:#ffffff;color:#333;">Đơn vị</td>
                <td style="border:1px solid #e0e0e0;padding:10px 14px;color:#1d1d1d;">${escHtml(unitName)}</td>
            </tr>
            <tr>
                <td style="border:1px solid #e0e0e0;padding:10px 14px;font-weight:600;background:#ffffff;color:#333;">Phòng</td>
                <td style="border:1px solid #e0e0e0;padding:10px 14px;color:#1d1d1d;">${escHtml(rawDept)}</td>
            </tr>
            <tr>
                <td style="border:1px solid #e0e0e0;padding:10px 14px;font-weight:600;background:#ffffff;color:#333;">Nội dung đi công tác</td>
                <td style="border:1px solid #e0e0e0;padding:10px 14px;color:#1d1d1d;">${escHtml(booking.Purpose || '—')}</td>
            </tr>
            <tr>
                <td style="border:1px solid #e0e0e0;padding:10px 14px;font-weight:600;background:#ffffff;color:#333;">Địa điểm đi công tác</td>
                <td style="border:1px solid #e0e0e0;padding:10px 14px;color:#1d1d1d;">${escHtml(booking.Destination || '—')}</td>
            </tr>
            <tr>
                <td style="border:1px solid #e0e0e0;padding:10px 14px;font-weight:600;background:#ffffff;color:#333;">Số người đi</td>
                <td style="border:1px solid #e0e0e0;padding:10px 14px;color:#1d1d1d;">${escHtml(booking.PassengerCount || 1)}</td>
            </tr>
            <tr>
                <td style="border:1px solid #e0e0e0;padding:10px 14px;font-weight:600;background:#ffffff;color:#333;">Danh sách đi công tác</td>
                <td style="border:1px solid #e0e0e0;padding:10px 14px;color:#1d1d1d;">${escHtml(attendeesList)}</td>
            </tr>
            <tr>
                <td style="border:1px solid #e0e0e0;padding:10px 14px;font-weight:600;background:#ffffff;color:#333;">Ghi chú</td>
                <td style="border:1px solid #e0e0e0;padding:10px 14px;color:#1d1d1d;">${escHtml(notesStr)}</td>
            </tr>
            <tr>
                <td style="border:1px solid #e0e0e0;padding:10px 14px;font-weight:600;background:#ffffff;color:#333;">Phương tiện</td>
                <td style="border:1px solid #e0e0e0;padding:10px 14px;color:#1d1d1d;">${escHtml(vehicleTypeStr)}</td>
            </tr>
            <tr>
                <td style="border:1px solid #e0e0e0;padding:10px 14px;font-weight:600;background:#ffffff;color:#333;">Ngày đi</td>
                <td style="border:1px solid #e0e0e0;padding:10px 14px;color:#1d1d1d;">${escHtml(depDateStr)}</td>
            </tr>
            <tr>
                <td style="border:1px solid #e0e0e0;padding:10px 14px;font-weight:600;background:#ffffff;color:#333;">Ngày về</td>
                <td style="border:1px solid #e0e0e0;padding:10px 14px;color:#1d1d1d;">${escHtml(retDateStr)}</td>
            </tr>
        </tbody>
    </table>
</body>
</html>`;

        // Determine recipients
        // To: factory emails
        const toEmails = Array.from(new Set(factoryEmails));

        // Cc: requester email + attendees emails + Team Admin emails
        const ccEmailsSet = new Set();
        if (booking.RequesterEmail?.trim()) {
            ccEmailsSet.add(booking.RequesterEmail.trim());
        }
        if (booking.AttendeesEmail) {
            booking.AttendeesEmail.split(/[,;]/).forEach(e => {
                const clean = e.trim();
                if (clean && clean.includes('@')) ccEmailsSet.add(clean);
            });
        }

        // Fetch Team Admin emails for CC
        try {
            const adminRes = await pool.request().execute('usp_Fleet_GetTeamAdminEmails');
            (adminRes.recordset || []).forEach(r => {
                const e = r.Email?.trim();
                if (e && e.includes('@')) ccEmailsSet.add(e);
            });
        } catch (adminErr) {
            console.warn('[Fleet Email] Failed to fetch TeamAdmin emails for factory CC:', adminErr.message);
        }

        // Remove any CC emails that are already in TO
        toEmails.forEach(e => ccEmailsSet.delete(e));
        const ccEmails = Array.from(ccEmailsSet);

        await sendFleetEmail(toEmails, ccEmails, subject, htmlBody);
        console.log(`[Fleet Email] ✅ Factory notification email sent to [${toEmails.join(', ')}] for booking ${booking.BookingCode}`);
    } catch (err) {
        console.error('[Fleet Email] ❌ Failed to send factory notification email:', err.message);
    }
}

module.exports = {
    notifyAdminNewBooking,
    notifyRequesterApproved,
    notifyRequesterRejected,
    sendFactoryNotificationEmail,
    sendFleetEmail
};
