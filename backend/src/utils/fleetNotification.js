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
        const adminRes = await pool.request().execute('usp_Fleet_GetAdminEmails');
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
        const adminRes = await pool.request().execute('usp_Fleet_GetAdminEmails');
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

module.exports = {
    notifyAdminNewBooking,
    notifyRequesterApproved,
    notifyRequesterRejected,
};
