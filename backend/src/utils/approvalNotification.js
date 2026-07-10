// src/utils/approvalNotification.js
const axios = require('axios');
const { getAccessToken } = require('../config/sharepoint');
const { getCsrPool, sql } = require('../config/database');
const { upsertExcelRow, upsertGateExcelRow } = require('./sharepointExcel');


/**
 * Xử lý toàn bộ tác vụ tự động hóa sau khi BOD duyệt đơn tiếp khách
 * @param {string} projectId - Mã đơn tiếp khách
 * @param {object} pool - Kết nối db pool (tùy chọn)
 */
async function handleBODApprovalActions(projectId, pool) {
  try {
    console.log(`[Approval Actions] 🚀 Starting BOD approval workflows for ${projectId}`);

    if (!pool) {
      pool = await getCsrPool();
    }

    // 1. Lấy thông tin chi tiết đơn + tasks qua usp_Submission_GetDetail
    const result = await pool.request()
      .input('ProjectId', sql.NVarChar(100), projectId)
      .execute('usp_Submission_GetDetail');

    const project = result.recordsets[0]?.[0];
    const tasks = result.recordsets[1] || [];

    if (!project) {
      console.warn(`[Approval Actions] ⚠️ Submissions details not found for ${projectId}`);
      return;
    }

    // Lấy thêm ParentId, Version, CustomerType từ database
    const verRes = await pool.request()
      .input('ProjectId', sql.NVarChar(100), projectId)
      .query('SELECT ParentId, Version, CustomerType FROM CSR_Projects WHERE Project_id = @ProjectId');
    if (verRes.recordset.length > 0) {
      project.ParentId = verRes.recordset[0].ParentId;
      project.Version = verRes.recordset[0].Version;
      project.CustomerType = verRes.recordset[0].CustomerType;
    }

    // Lọc danh sách công việc đang hoạt động (IsActive)
    const activeTasks = tasks.filter(t => t.IsActive !== false);
    if (activeTasks.length === 0) {
      console.warn(`[Approval Actions] ⚠️ No active tasks found for ${projectId}`);
    }

    const isSpecialType = ['Partner', 'Supplier', 'Khách vãng lai', 'Ứng viên phỏng vấn'].includes(project.CustomerType);

    if (isSpecialType) {
      // Đặt lịch phòng họp ngay lập tức
      await bookMeetingRooms(project, activeTasks, pool).catch(err => {
        console.error('[Approval Actions] ❌ Meeting room booking failed:', err.message);
      });

      // Lập lịch gửi email thông báo duyệt
      await scheduleApprovalEmail(projectId, project.ParentId || projectId, project.Version > 1, activeTasks, pool).catch(err => {
        console.error('[Approval Actions] ❌ Email scheduling failed:', err.message);
      });
    } else {
      // Đơn Brand: Gửi ngay lập tức và đặt lịch phòng họp ngay lập tức
      const emailPromise = (project.Version > 1 && project.ParentId)
        ? handleProjectEditNotification(projectId, project.ParentId, pool)
        : sendApprovalEmail(project, activeTasks, pool);

      await Promise.allSettled([
        emailPromise,
        bookMeetingRooms(project, activeTasks, pool)
      ]);
    }

    // 3. Gửi email đăng ký đi xe và đồng bộ lên SharePoint Excel nếu có task chuẩn bị xe
    await handleVehicleTasksSyncAndNotification(project, activeTasks, pool).catch(err => {
      console.error('[Approval Actions] ❌ Vehicle workflow failed:', err.message);
    });

    // 4. Đồng bộ đăng ký ra vào cổng tại VSN OFFICE lên SharePoint Excel
    await handleGatePassSync(project, activeTasks, pool).catch(err => {
      console.error('[Approval Actions] ❌ Gate pass sync failed:', err.message);
    });

    console.log(`[Approval Actions] ✅ Completed BOD approval workflows for ${projectId}`);
  } catch (error) {
    console.error(`[Approval Actions] ❌ Workflows failed:`, error.message);
  }
}


/**
 * Gửi email thông báo phê duyệt theo định dạng HTML bảng mẫu
 */
async function sendApprovalEmail(project, tasks, pool) {
  try {
    const senderEmail = process.env.SENDER_EMAIL;
    if (!senderEmail) {
      console.warn(`[Email Notification] ⚠️ No SENDER_EMAIL configured in env. Skipping approval email.`);
      return;
    }

    const accessToken = await getAccessToken();

    // 1. Xác định Team (Department/Role của người tạo đơn)
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

    // Parse lịch trình chung (AgendaJsonData) để lấy ngày & địa điểm
    let agendaJson = [];
    if (project.AgendaJsonData) {
      try {
        agendaJson = JSON.parse(project.AgendaJsonData);
      } catch (e) {
        console.error('Failed to parse AgendaJsonData JSON:', e.message);
      }
    }

    // Nhóm tasks/lịch trình theo Địa điểm để dựng dòng cho Bảng I
    let uniqueDestinations = [];
    if (agendaJson && agendaJson.length > 0) {
      const dests = agendaJson.flatMap(day => Object.keys(day.agenda || {}));
      uniqueDestinations = [...new Set(dests)].filter(Boolean).sort();
    } else {
      uniqueDestinations = [...new Set(tasks.map(t => t.Destination).filter(Boolean))].sort();
    }

    // Lấy danh sách ngày tiếp đón duy nhất (format DD/MM/YYYY)
    let uniqueDates = [];
    if (agendaJson && agendaJson.length > 0) {
      uniqueDates = [...new Set(agendaJson.map(day => {
        if (!day.date) return null;
        const d = new Date(day.date);
        const dayStr = String(d.getDate()).padStart(2, '0');
        const monthStr = String(d.getMonth() + 1).padStart(2, '0');
        return `${dayStr}/${monthStr}/${d.getFullYear()}`;
      }).filter(Boolean))].sort();
    } else {
      uniqueDates = [...new Set(tasks.map(t => {
        const d = new Date(t.OnboardDate);
        const dayStr = String(d.getDate()).padStart(2, '0');
        const monthStr = String(d.getMonth() + 1).padStart(2, '0');
        return `${dayStr}/${monthStr}/${d.getFullYear()}`;
      }))].sort();
    }
    const dateHeaderStr = uniqueDates.join(', ') || '—';

    // 2. Tạo danh sách người nhận (To & Cc)
    const toEmails = new Set();
    const ccEmails = new Set();

    // Thêm Submitter (Người làm phiếu)
    if (project.SubmitterEmail) {
      toEmails.add(project.SubmitterEmail.trim().toLowerCase());
    }

    // Thêm Assignees (Người thực hiện) -> To
    tasks.forEach(t => {
      if (t.AssigneeEmail) {
        t.AssigneeEmail.split(/[;,\s\n]+/).forEach(e => {
          const email = e.trim().toLowerCase();
          if (email.includes('@')) toEmails.add(email);
        });
      }
    });

    // Thêm Supervisors (Giám sát) -> Cc
    tasks.forEach(t => {
      if (t.SupervisorEmail) {
        t.SupervisorEmail.split(/[;,\s\n]+/).forEach(e => {
          const email = e.trim().toLowerCase();
          if (email.includes('@')) ccEmails.add(email);
        });
      }
    });

    // Thêm Attendees (Người tham gia) -> Cc
    if (project.AttendeesEmail) {
      project.AttendeesEmail.split(/[;,\s\n]+/).forEach(e => {
        const email = e.trim().toLowerCase();
        if (email.includes('@')) ccEmails.add(email);
      });
    }

    // Thêm các email thông báo của địa điểm tiếp đón -> Cc
    const uniqueDestinationsForCc = uniqueDestinations;
    for (const dest of uniqueDestinationsForCc) {
      try {
        const locRes = await pool.request()
          .input('DestName', sql.NVarChar(100), dest)
          .query('SELECT NotificationEmails FROM CSR_Locations WHERE Name = @DestName AND StatusId = 1');
        if (locRes.recordset.length > 0 && locRes.recordset[0].NotificationEmails) {
          locRes.recordset[0].NotificationEmails.split(/[;,\s\n]+/).forEach(e => {
            const email = e.trim().toLowerCase();
            if (email.includes('@')) ccEmails.add(email);
          });
        }
      } catch (locErr) {
        console.warn(`[Email Notification] ⚠️ Failed to fetch location emails for ${dest}:`, locErr.message);
      }
    }

    // Loại bỏ email trong To khỏi Cc
    toEmails.forEach(e => ccEmails.delete(e));

    if (toEmails.size === 0) {
      console.warn(`[Email Notification] ⚠️ No valid recipients (To) found for ${project.Project_id}`);
      return;
    }

    // Convert sang định dạng recipients của Graph API
    const toRecipients = Array.from(toEmails).map(email => ({
      emailAddress: { address: email }
    }));
    const ccRecipients = Array.from(ccEmails).map(email => ({
      emailAddress: { address: email }
    }));

    // 3. Xử lý dữ liệu hiển thị trong mail
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
        console.error('Failed to parse GuestReps JSON in approval mail generator:', e.message);
      }
    }

    // Dựng nội dung hàng cho Bảng I
    let tableIRowsHtml = '';
    uniqueDestinations.forEach(dest => {
      // Dựng thông tin lịch trình cho địa điểm hiện tại
      const scheduleText = getScheduleTextForDestination(agendaJson, dest);

      tableIRowsHtml += `
        <tr>
          <td style="border: 1px solid #dddddd; padding: 10px 12px;">${escapeHtml(teamName)}</td>
          <td style="border: 1px solid #dddddd; padding: 10px 12px;">${escapeHtml(project.MeetingTopic || '—')}</td>
          <td style="border: 1px solid #dddddd; padding: 10px 12px;">${escapeHtml(guestRepsStr)}</td>
          <td style="border: 1px solid #dddddd; padding: 10px 12px;">${escapeHtml(project.CustomerName || '—')}</td>
          <td style="border: 1px solid #dddddd; padding: 10px 12px;">${escapeHtml(scheduleText || '—')}</td>
          <td style="border: 1px solid #dddddd; padding: 10px 12px;">${escapeHtml(dest)}</td>
        </tr>
      `;
    });

    if (!tableIRowsHtml) {
      tableIRowsHtml = `<tr><td colspan="6" style="border: 1px solid #dddddd; padding: 10px 12px; text-align: center; color: #777;">Không có thông tin địa điểm</td></tr>`;
    }

    // Dựng nội dung hàng cho Bảng II
    let tableIIRowsHtml = '';
    tasks.forEach(t => {
      const deadlineFormatted = formatDDate(t.DeadlineDate);
      const assigneeEmailsHtml = formatEmailLinks(t.AssigneeEmail);
      const supervisorEmailsHtml = formatEmailLinks(t.SupervisorEmail);

      tableIIRowsHtml += `
        <tr>
          <td style="border: 1px solid #dddddd; padding: 10px 12px;">${escapeHtml(t.TaskName || '—')}</td>
          <td style="border: 1px solid #dddddd; padding: 10px 12px;">${escapeHtml(t.TaskDetail || '—')}</td>
          <td style="border: 1px solid #dddddd; padding: 10px 12px;">${deadlineFormatted}</td>
          <td style="border: 1px solid #dddddd; padding: 10px 12px;">${escapeHtml(t.Assignee || '—')}</td>
          <td style="border: 1px solid #dddddd; padding: 10px 12px;">${assigneeEmailsHtml}</td>
          <td style="border: 1px solid #dddddd; padding: 10px 12px;">${escapeHtml(t.Supervisor || '—')}</td>
          <td style="border: 1px solid #dddddd; padding: 10px 12px;">${supervisorEmailsHtml}</td>
        </tr>
      `;
    });

    if (!tableIIRowsHtml) {
      tableIIRowsHtml = `<tr><td colspan="7" style="border: 1px solid #dddddd; padding: 10px 12px; text-align: center; color: #777;">Không có công việc chuẩn bị</td></tr>`;
    }

    // 4. Dựng nội dung HTML Email hoàn chỉnh
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333333; margin: 0; padding: 20px; }
          .header-info { margin-bottom: 20px; font-weight: bold; font-size: 16px; color: #0078d4; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 14px; }
          th { background-color: #F29D38; color: #000000; font-weight: bold; border: 1px solid #dddddd; padding: 10px 12px; text-align: left; }
          td { border: 1px solid #dddddd; padding: 10px 12px; vertical-align: top; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .footer { margin-top: 25px; font-size: 14px; color: #555555; }
        </style>
      </head>
      <body>
        <p>Dear mọi người,</p>
        <p>HQ5 xin thông báo lịch tiếp đón khách hàng và nội dung công việc cần chuẩn bị:</p>
        
        <div style="margin-bottom: 20px; font-weight: bold; font-size: 16px; color: #0078d4;">📅 Ngày đón tiếp: ${dateHeaderStr}</div>
        
        <h3 style="margin-bottom: 10px; font-size: 15px; color: #333;">I. Thông tin chung:</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 13px;">
          <thead>
            <tr>
              <th style="background-color: #F29D38; color: #000000; font-weight: bold; border: 1px solid #dddddd; padding: 10px 12px; text-align: left; width: 8%;">Team</th>
              <th style="background-color: #F29D38; color: #000000; font-weight: bold; border: 1px solid #dddddd; padding: 10px 12px; text-align: left; width: 20%;">${project.CustomerType === 'Ứng viên phỏng vấn' ? 'Nội dung chính' : 'Nội dung tiếp đón'}</th>
              <th style="background-color: #F29D38; color: #000000; font-weight: bold; border: 1px solid #dddddd; padding: 10px 12px; text-align: left; width: 25%;">${project.CustomerType === 'Ứng viên phỏng vấn' ? 'Thông tin ứng viên' : 'Thông tin khách hàng'}</th>
              <th style="background-color: #F29D38; color: #000000; font-weight: bold; border: 1px solid #dddddd; padding: 10px 12px; text-align: left; width: 10%;">${project.CustomerType === 'Ứng viên phỏng vấn' ? 'Đối tượng' : 'Khách hàng'}</th>
              <th style="background-color: #F29D38; color: #000000; font-weight: bold; border: 1px solid #dddddd; padding: 10px 12px; text-align: left; width: 27%;">Thông tin lịch trình</th>
              <th style="background-color: #F29D38; color: #000000; font-weight: bold; border: 1px solid #dddddd; padding: 10px 12px; text-align: left; width: 10%;">Địa điểm tiếp đón</th>
            </tr>
          </thead>
          <tbody>
            ${tableIRowsHtml}
          </tbody>
        </table>
        
        <h3 style="margin-bottom: 10px; font-size: 15px; color: #333;">II. Chi tiết công việc cần chuẩn bị:</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 13px;">
          <thead>
            <tr>
              <th style="background-color: #F29D38; color: #000000; font-weight: bold; border: 1px solid #dddddd; padding: 10px 12px; text-align: left; width: 15%;">Công việc</th>
              <th style="background-color: #F29D38; color: #000000; font-weight: bold; border: 1px solid #dddddd; padding: 10px 12px; text-align: left; width: 25%;">Chi tiết công việc</th>
              <th style="background-color: #F29D38; color: #000000; font-weight: bold; border: 1px solid #dddddd; padding: 10px 12px; text-align: left; width: 12%;">Ngày cần hoàn thành chuẩn bị</th>
              <th style="background-color: #F29D38; color: #000000; font-weight: bold; border: 1px solid #dddddd; padding: 10px 12px; text-align: left; width: 13%;">Người thực hiện</th>
              <th style="background-color: #F29D38; color: #000000; font-weight: bold; border: 1px solid #dddddd; padding: 10px 12px; text-align: left; width: 15%;">Email người thực hiện</th>
              <th style="background-color: #F29D38; color: #000000; font-weight: bold; border: 1px solid #dddddd; padding: 10px 12px; text-align: left; width: 10%;">Giám sát</th>
              <th style="background-color: #F29D38; color: #000000; font-weight: bold; border: 1px solid #dddddd; padding: 10px 12px; text-align: left; width: 12%;">Email giám sát</th>
            </tr>
          </thead>
          <tbody>
            ${tableIIRowsHtml}
          </tbody>
        </table>
        
        <div style="margin-top: 25px; font-size: 14px; color: #555555;">
          <p>Nhờ anh chị PIC theo dõi, hoàn thành công việc đúng thời hạn, các giám sát công việc kiểm tra sát sao tình hình tiến độ trên nhé.</p>
          <p>Xin cảm ơn.</p>
          <p>Thân ái,</p>
        </div>
      </body>
      </html>
    `;

    // Lấy thêm ParentId nếu chưa có
    if (!project.ParentId) {
      const verRes = await pool.request()
        .input('ProjectId', sql.NVarChar(100), project.Project_id)
        .query('SELECT ParentId FROM CSR_Projects WHERE Project_id = @ProjectId');
      if (verRes.recordset.length > 0) {
        project.ParentId = verRes.recordset[0].ParentId;
      } else {
        project.ParentId = project.Project_id;
      }
    }

    // 5. Gửi thư qua Graph API
    const url = `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`;
    const mailPayload = {
      message: {
        subject: `CRM-Request: Thông báo khách đến thăm VSN [${project.ParentId}]`,
        body: {
          contentType: 'HTML',
          content: htmlBody
        },
        toRecipients,
        ccRecipients
      },
      saveToSentItems: 'true'
    };

    await axios.post(url, mailPayload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`[Email Notification] ✅ Approved email sent successfully for ${project.Project_id}`);
  } catch (error) {
    console.error(`[Email Notification] ❌ Failed to send approved email for ${project.Project_id}:`, error.response?.data || error.message);
  }
}

/**
 * Tự động book lịch phòng họp qua Graph API đối với các task phòng họp
 */
async function bookMeetingRooms(project, tasks, pool) {
  try {
    const organizerEmail = process.env.SENDER_EMAIL || project.SubmitterEmail;
    if (!organizerEmail) {
      console.warn(`[Meeting Room Calendar] ⚠️ No organizer email (SENDER_EMAIL or SubmitterEmail) available. Skipping meeting room booking.`);
      return;
    }

    // Lọc ra các task có chọn phòng họp
    const bookingTasks = tasks.filter(t =>
      t.MeetingRoom &&
      t.MeetingRoom.trim() !== '' &&
      t.MeetingRoom !== 'Chọn phòng họp...' &&
      t.MeetingRoomEmail &&
      t.MeetingRoomEmail.trim() !== ''
    );

    if (bookingTasks.length === 0) {
      console.log(`[Meeting Room Calendar] ℹ️ No meeting room booking tasks found for ${project.Project_id}`);
      return;
    }

    const accessToken = await getAccessToken();

    for (const task of bookingTasks) {
      try {
        console.log(`[Meeting Room Calendar] 🗓️ Booking room "${task.MeetingRoom}" for task ${task.Task_id}`);

        // 1. Tính toán ngày giờ bắt đầu/kết thúc
        const dateObj = new Date(task.OnboardDate);
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;

        const startTime = task.MeetingStartTime || '09:00';
        const endTime = task.MeetingEndTime || '10:00';

        const startDateTime = `${dateStr}T${startTime}:00`;
        const endDateTime = `${dateStr}T${endTime}:00`;

        // 2. Thu thập danh sách emails tham gia cuộc họp
        const attendeeEmails = new Set();

        // Thêm Executor (Assignee)
        if (task.AssigneeEmail) {
          task.AssigneeEmail.split(/[;,\s\n]+/).forEach(e => {
            const email = e.trim().toLowerCase();
            if (email.includes('@')) attendeeEmails.add(email);
          });
        }
        // Thêm Task Participants
        if (task.TaskAttendeesEmail) {
          task.TaskAttendeesEmail.split(/[;,\s\n]+/).forEach(e => {
            const email = e.trim().toLowerCase();
            if (email.includes('@')) attendeeEmails.add(email);
          });
        }
        // Thêm Submitter (Người làm phiếu)
        if (project.SubmitterEmail) {
          attendeeEmails.add(project.SubmitterEmail.trim().toLowerCase());
        }
        // Thêm Project Participants
        if (project.AttendeesEmail) {
          project.AttendeesEmail.split(/[;,\s\n]+/).forEach(e => {
            const email = e.trim().toLowerCase();
            if (email.includes('@')) attendeeEmails.add(email);
          });
        }

        // Loại bỏ email của Phòng họp và Organizer ra khỏi danh sách Required
        const roomEmailClean = task.MeetingRoomEmail.trim().toLowerCase();
        attendeeEmails.delete(roomEmailClean);
        attendeeEmails.delete(organizerEmail.trim().toLowerCase());

        const attendeesPayload = [];
        // Thêm phòng họp dưới dạng resource
        attendeesPayload.push({
          emailAddress: {
            address: task.MeetingRoomEmail.trim(),
            name: task.MeetingRoom
          },
          type: 'resource'
        });

        // Thêm những người tham gia khác dưới dạng required
        attendeeEmails.forEach(email => {
          attendeesPayload.push({
            emailAddress: { address: email },
            type: 'required'
          });
        });

        // 3. Cấu hình Event Payload
        const eventPayload = {
          subject: `Lịch họp tiếp khách: ${project.CustomerName} - ${project.MeetingTopic}`,
          body: {
            contentType: 'HTML',
            content: `
              <p>Lịch họp tiếp đón khách hàng được tạo tự động từ hệ thống quản lý lịch đón tiếp CSR.</p>
              <p><b>Khách hàng:</b> ${project.CustomerName}</p>
              <p><b>Nội dung:</b> ${project.MeetingTopic || 'Không có'}</p>
              <p><b>Phòng họp:</b> ${task.MeetingRoom}</p>
              <p><b>Thời gian:</b> ${startTime} - ${endTime} ngày ${dd}/${mm}/${yyyy}</p>
              <p>Vui lòng tham dự đầy đủ và chuẩn bị nội dung theo sự phân công.</p>
            `
          },
          start: {
            dateTime: startDateTime,
            timeZone: 'SE Asia Standard Time'
          },
          end: {
            dateTime: endDateTime,
            timeZone: 'SE Asia Standard Time'
          },
          location: {
            displayName: task.MeetingRoom
          },
          attendees: attendeesPayload
        };

        // 4. Gửi yêu cầu đặt phòng lên Graph API
        const url = `https://graph.microsoft.com/v1.0/users/${organizerEmail}/calendar/events`;
        const res = await axios.post(url, eventPayload, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        const eventId = res.data.id;
        console.log(`[Meeting Room Calendar] ✅ Room "${task.MeetingRoom}" booked successfully. Event ID: ${eventId}`);

        // 5. Lưu CalendarEventId ngược lại vào cơ sở dữ liệu
        await pool.request()
          .input('CalendarEventId', sql.NVarChar(200), eventId)
          .input('TaskId', sql.NVarChar(150), task.Task_id)
          .execute('usp_UpdateTaskCalendarEventId');

        console.log(`[Meeting Room Calendar] ✅ Database updated with CalendarEventId for task ${task.Task_id}`);
      } catch (err) {
        console.error(`[Meeting Room Calendar] ❌ Failed to book room "${task.MeetingRoom}" for task ${task.Task_id}:`, err.response?.data || err.message);
      }
    }
  } catch (error) {
    console.error(`[Meeting Room Calendar] ❌ Error in bookMeetingRooms workflow:`, error.message);
  }
}

/**
 * Gửi email reply thông báo chỉnh sửa dự án đã duyệt trước đó
 */
async function handleProjectEditNotification(newProjectId, oldProjectId, pool) {
  try {
    console.log(`[Edit Notification] 🚀 Starting edit notification for ${newProjectId} (reply to ${oldProjectId})`);

    if (!pool) {
      pool = await getCsrPool();
    }

    const result = await pool.request()
      .input('ProjectId', sql.NVarChar(100), newProjectId)
      .execute('usp_Submission_GetDetail');

    const project = result.recordsets[0]?.[0];
    const tasks = result.recordsets[1] || [];

    if (!project) {
      console.warn(`[Edit Notification] ⚠️ Submissions details not found for ${newProjectId}`);
      return;
    }

    const activeTasks = tasks.filter(t => t.IsActive !== false);

    // Gửi email custom với tiêu đề RE: và tiền tố thay đổi
    await sendApprovalEmailWithPrefix(
      project,
      activeTasks,
      `RE: CRM-Request: Thông báo khách đến thăm VSN [${oldProjectId}]`,
      `<div style="font-family: Arial, sans-serif; font-size: 15px; font-weight: bold; color: #d9381e; margin-bottom: 20px; border-left: 4px solid #d9381e; padding-left: 10px;">
        Đơn tiếp khách có thay đổi như sau:
      </div>`,
      pool
    );

  } catch (error) {
    console.error(`[Edit Notification] ❌ Failed to send edit notification for ${newProjectId}:`, error.message);
  }
}

/**
 * Gửi email reply thông báo hủy dự án đã duyệt trước đó, và tự động xóa phòng họp
 */
async function handleProjectCancelNotification(projectId, reason, pool) {
  try {
    console.log(`[Cancel Notification] 🚀 Starting cancel notification for ${projectId}`);

    if (!pool) {
      pool = await getCsrPool();
    }

    const result = await pool.request()
      .input('ProjectId', sql.NVarChar(100), projectId)
      .execute('usp_Submission_GetDetail');

    const project = result.recordsets[0]?.[0];
    const tasks = result.recordsets[1] || [];

    if (!project) {
      console.warn(`[Cancel Notification] ⚠️ Submissions details not found for ${projectId}`);
      return;
    }

    // Lấy thêm ParentId từ database
    const verRes = await pool.request()
      .input('ProjectId', sql.NVarChar(100), projectId)
      .query('SELECT ParentId FROM CSR_Projects WHERE Project_id = @ProjectId');
    const parentId = verRes.recordset[0]?.ParentId || projectId;

    // 1. Gửi email reply thông báo hủy đơn
    const senderEmail = process.env.SENDER_EMAIL;
    if (senderEmail) {
      const accessToken = await getAccessToken();
      const toEmails = new Set();
      const ccEmails = new Set();

      // Thêm Submitter (Người làm phiếu)
      if (project.SubmitterEmail) {
        toEmails.add(project.SubmitterEmail.trim().toLowerCase());
      }

      // Thêm Assignees
      tasks.forEach(t => {
        if (t.AssigneeEmail) {
          t.AssigneeEmail.split(/[;,\s\n]+/).forEach(e => {
            const email = e.trim().toLowerCase();
            if (email.includes('@')) toEmails.add(email);
          });
        }
      });

      // Thêm Supervisors
      tasks.forEach(t => {
        if (t.SupervisorEmail) {
          t.SupervisorEmail.split(/[;,\s\n]+/).forEach(e => {
            const email = e.trim().toLowerCase();
            if (email.includes('@')) ccEmails.add(email);
          });
        }
      });

      // Thêm Attendees
      if (project.AttendeesEmail) {
        project.AttendeesEmail.split(/[;,\s\n]+/).forEach(e => {
          const email = e.trim().toLowerCase();
          if (email.includes('@')) ccEmails.add(email);
        });
      }

      // Thêm các email thông báo của địa điểm -> Cc
      const uniqueDestinations = [...new Set(tasks.map(t => t.Destination).filter(Boolean))];
      for (const dest of uniqueDestinations) {
        try {
          const locRes = await pool.request()
            .input('DestName', sql.NVarChar(100), dest)
            .query('SELECT NotificationEmails FROM CSR_Locations WHERE Name = @DestName AND StatusId = 1');
          if (locRes.recordset.length > 0 && locRes.recordset[0].NotificationEmails) {
            locRes.recordset[0].NotificationEmails.split(/[;,\s\n]+/).forEach(e => {
              const email = e.trim().toLowerCase();
              if (email.includes('@')) ccEmails.add(email);
            });
          }
        } catch (locErr) {
          console.warn(`[Cancel Notification] ⚠️ Failed to fetch location emails for ${dest}:`, locErr.message);
        }
      }

      toEmails.forEach(e => ccEmails.delete(e));

      if (toEmails.size > 0) {
        const toRecipients = Array.from(toEmails).map(email => ({ emailAddress: { address: email } }));
        const ccRecipients = Array.from(ccEmails).map(email => ({ emailAddress: { address: email } }));

        const htmlBody = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333333; margin: 0; padding: 20px; }
              .cancel-banner { font-family: Arial, sans-serif; font-size: 15px; font-weight: bold; color: #d9381e; margin-bottom: 20px; border-left: 4px solid #d9381e; padding-left: 10px; }
              .footer { margin-top: 25px; font-size: 14px; color: #555555; }
            </style>
          </head>
          <body>
            <p>Dear mọi người,</p>
            
            <div class="cancel-banner">
              Đơn tiếp khách [${project.Project_id}] đã bị HỦY / TỪ CHỐI.
            </div>
            
            <p><b>Lý do hủy/từ chối:</b> <i>${escapeHtml(reason || 'Không có lý do cụ thể')}</i></p>
            <p>Vui lòng dừng các công việc chuẩn bị cho đơn đón tiếp khách hàng này.</p>
            
            <div class="footer">
              <p>Xin cảm ơn.</p>
              <p>Thân ái,</p>
            </div>
          </body>
          </html>
        `;

        const url = `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`;
        const mailPayload = {
          message: {
            subject: `RE: CRM-Request: Thông báo khách đến thăm VSN [${parentId}]`,
            body: {
              contentType: 'HTML',
              content: htmlBody
            },
            toRecipients,
            ccRecipients
          },
          saveToSentItems: 'true'
        };

        await axios.post(url, mailPayload, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });
        console.log(`[Cancel Notification] ✅ Cancel email sent successfully for ${project.Project_id}`);
      }
    }

    // 2. Hủy các phòng họp đã đặt trên Outlook (nếu có)
    const organizerEmail = process.env.SENDER_EMAIL || project.SubmitterEmail;
    if (organizerEmail) {
      const accessToken = await getAccessToken();
      const bookingTasks = tasks.filter(t => t.CalendarEventId && t.CalendarEventId.trim() !== '');

      for (const task of bookingTasks) {
        try {
          console.log(`[Cancel Notification] 🗓️ Cancelling Outlook event ${task.CalendarEventId} for room ${task.MeetingRoom}`);
          const url = `https://graph.microsoft.com/v1.0/users/${organizerEmail}/events/${task.CalendarEventId}`;
          await axios.delete(url, {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          });
          console.log(`[Cancel Notification] ✅ Outlook event ${task.CalendarEventId} cancelled.`);

          // Clear CalendarEventId trong DB
          await pool.request()
            .input('TaskId', sql.NVarChar(150), task.Task_id)
            .input('CalendarEventId', sql.NVarChar(200), null)
            .execute('usp_UpdateTaskCalendarEventId');
        } catch (eventErr) {
          console.error(`[Cancel Notification] ❌ Failed to cancel Outlook event ${task.CalendarEventId}:`, eventErr.response?.data || eventErr.message);
        }
      }
    }

  } catch (error) {
    console.error(`[Cancel Notification] ❌ Failed to process cancel notification for ${projectId}:`, error.message);
  }
}

/**
 * Hàm phụ trợ để gửi email thông báo phê duyệt với Tiêu đề và Tiền tố tùy chỉnh
 */
async function sendApprovalEmailWithPrefix(project, tasks, customSubject, prefixHtml, pool) {
  try {
    const senderEmail = process.env.SENDER_EMAIL;
    if (!senderEmail) return;

    const accessToken = await getAccessToken();

    // 1. Xác định Team
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
    // Parse lịch trình chung (AgendaJsonData) để lấy ngày & địa điểm
    let agendaJson = [];
    if (project.AgendaJsonData) {
      try {
        agendaJson = JSON.parse(project.AgendaJsonData);
      } catch (e) {
        console.error('Failed to parse AgendaJsonData JSON:', e.message);
      }
    }

    // Nhóm tasks/lịch trình theo Địa điểm để dựng dòng cho Bảng I
    let uniqueDestinations = [];
    if (agendaJson && agendaJson.length > 0) {
      const dests = agendaJson.flatMap(day => Object.keys(day.agenda || {}));
      uniqueDestinations = [...new Set(dests)].filter(Boolean).sort();
    } else {
      uniqueDestinations = [...new Set(tasks.map(t => t.Destination).filter(Boolean))].sort();
    }

    // Lấy danh sách ngày tiếp đón duy nhất (format DD/MM/YYYY)
    let uniqueDates = [];
    if (agendaJson && agendaJson.length > 0) {
      uniqueDates = [...new Set(agendaJson.map(day => {
        if (!day.date) return null;
        const d = new Date(day.date);
        const dayStr = String(d.getDate()).padStart(2, '0');
        const monthStr = String(d.getMonth() + 1).padStart(2, '0');
        return `${dayStr}/${monthStr}/${d.getFullYear()}`;
      }).filter(Boolean))].sort();
    } else {
      uniqueDates = [...new Set(tasks.map(t => {
        const d = new Date(t.OnboardDate);
        const dayStr = String(d.getDate()).padStart(2, '0');
        const monthStr = String(d.getMonth() + 1).padStart(2, '0');
        return `${dayStr}/${monthStr}/${d.getFullYear()}`;
      }))].sort();
    }
    const dateHeaderStr = uniqueDates.join(', ') || '—';

    // 2. Tạo danh sách người nhận (To & Cc)
    const toEmails = new Set();
    const ccEmails = new Set();

    if (project.SubmitterEmail) toEmails.add(project.SubmitterEmail.trim().toLowerCase());

    tasks.forEach(t => {
      if (t.AssigneeEmail) {
        t.AssigneeEmail.split(/[;,\s\n]+/).forEach(e => {
          const email = e.trim().toLowerCase();
          if (email.includes('@')) toEmails.add(email);
        });
      }
    });

    tasks.forEach(t => {
      if (t.SupervisorEmail) {
        t.SupervisorEmail.split(/[;,\s\n]+/).forEach(e => {
          const email = e.trim().toLowerCase();
          if (email.includes('@')) ccEmails.add(email);
        });
      }
    });

    if (project.AttendeesEmail) {
      project.AttendeesEmail.split(/[;,\s\n]+/).forEach(e => {
        const email = e.trim().toLowerCase();
        if (email.includes('@')) ccEmails.add(email);
      });
    }

    // Thêm các email thông báo của địa điểm -> Cc
    const uniqueDestinationsForCc = uniqueDestinations;
    for (const dest of uniqueDestinationsForCc) {
      try {
        const locRes = await pool.request()
          .input('DestName', sql.NVarChar(100), dest)
          .query('SELECT NotificationEmails FROM CSR_Locations WHERE Name = @DestName AND StatusId = 1');
        if (locRes.recordset.length > 0 && locRes.recordset[0].NotificationEmails) {
          locRes.recordset[0].NotificationEmails.split(/[;,\s\n]+/).forEach(e => {
            const email = e.trim().toLowerCase();
            if (email.includes('@')) ccEmails.add(email);
          });
        }
      } catch (locErr) {
        console.warn(`[Email Notification] ⚠️ Failed to fetch location emails for ${dest}:`, locErr.message);
      }
    }

    toEmails.forEach(e => ccEmails.delete(e));

    if (toEmails.size === 0) return;

    const toRecipients = Array.from(toEmails).map(email => ({ emailAddress: { address: email } }));
    const ccRecipients = Array.from(ccEmails).map(email => ({ emailAddress: { address: email } }));

    // 3. Xử lý dữ liệu hiển thị
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
      } catch (e) { }
    }

    const uniqueDests = uniqueDestinations;

    let tableIRowsHtml = '';
    uniqueDests.forEach(dest => {
      const scheduleText = getScheduleTextForDestination(agendaJson, dest);
      tableIRowsHtml += `
        <tr>
          <td style="border: 1px solid #dddddd; padding: 10px 12px;">${escapeHtml(teamName)}</td>
          <td style="border: 1px solid #dddddd; padding: 10px 12px;">${escapeHtml(project.MeetingTopic || '—')}</td>
          <td style="border: 1px solid #dddddd; padding: 10px 12px;">${escapeHtml(guestRepsStr)}</td>
          <td style="border: 1px solid #dddddd; padding: 10px 12px;">${escapeHtml(project.CustomerName || '—')}</td>
          <td style="border: 1px solid #dddddd; padding: 10px 12px;">${escapeHtml(scheduleText || '—')}</td>
          <td style="border: 1px solid #dddddd; padding: 10px 12px;">${escapeHtml(dest)}</td>
        </tr>
      `;
    });

    if (!tableIRowsHtml) {
      tableIRowsHtml = `<tr><td colspan="6" style="border: 1px solid #dddddd; padding: 10px 12px; text-align: center; color: #777;">Không có thông tin địa điểm</td></tr>`;
    }

    let tableIIRowsHtml = '';
    tasks.forEach(t => {
      const deadlineFormatted = formatDDate(t.DeadlineDate);
      const assigneeEmailsHtml = formatEmailLinks(t.AssigneeEmail);
      const supervisorEmailsHtml = formatEmailLinks(t.SupervisorEmail);

      tableIIRowsHtml += `
        <tr>
          <td style="border: 1px solid #dddddd; padding: 10px 12px;">${escapeHtml(t.TaskName || '—')}</td>
          <td style="border: 1px solid #dddddd; padding: 10px 12px;">${escapeHtml(t.TaskDetail || '—')}</td>
          <td style="border: 1px solid #dddddd; padding: 10px 12px;">${deadlineFormatted}</td>
          <td style="border: 1px solid #dddddd; padding: 10px 12px;">${escapeHtml(t.Assignee || '—')}</td>
          <td style="border: 1px solid #dddddd; padding: 10px 12px;">${assigneeEmailsHtml}</td>
          <td style="border: 1px solid #dddddd; padding: 10px 12px;">${escapeHtml(t.Supervisor || '—')}</td>
          <td style="border: 1px solid #dddddd; padding: 10px 12px;">${supervisorEmailsHtml}</td>
        </tr>
      `;
    });

    if (!tableIIRowsHtml) {
      tableIIRowsHtml = `<tr><td colspan="7" style="border: 1px solid #dddddd; padding: 10px 12px; text-align: center; color: #777;">Không có công việc chuẩn bị</td></tr>`;
    }

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333333; margin: 0; padding: 20px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 14px; }
          th { background-color: #F29D38; color: #000000; font-weight: bold; border: 1px solid #dddddd; padding: 10px 12px; text-align: left; }
          td { border: 1px solid #dddddd; padding: 10px 12px; vertical-align: top; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .footer { margin-top: 25px; font-size: 14px; color: #555555; }
        </style>
      </head>
      <body>
        <p>Dear mọi người,</p>
        
        ${prefixHtml || ''}
        
        <p>HQ5 xin thông báo lịch tiếp đón khách hàng và nội dung công việc cần chuẩn bị:</p>
        
        <div style="margin-bottom: 20px; font-weight: bold; font-size: 16px; color: #0078d4;">📅 Ngày đón tiếp: ${dateHeaderStr}</div>
        
        <h3 style="margin-bottom: 10px; font-size: 15px; color: #333;">I. Thông tin chung:</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 13px;">
          <thead>
            <tr>
              <th style="background-color: #F29D38; color: #000000; font-weight: bold; border: 1px solid #dddddd; padding: 10px 12px; text-align: left; width: 8%;">Team</th>
              <th style="background-color: #F29D38; color: #000000; font-weight: bold; border: 1px solid #dddddd; padding: 10px 12px; text-align: left; width: 20%;">${project.CustomerType === 'Ứng viên phỏng vấn' ? 'Nội dung chính' : 'Nội dung tiếp đón'}</th>
              <th style="background-color: #F29D38; color: #000000; font-weight: bold; border: 1px solid #dddddd; padding: 10px 12px; text-align: left; width: 25%;">${project.CustomerType === 'Ứng viên phỏng vấn' ? 'Thông tin ứng viên' : 'Thông tin khách hàng'}</th>
              <th style="background-color: #F29D38; color: #000000; font-weight: bold; border: 1px solid #dddddd; padding: 10px 12px; text-align: left; width: 10%;">${project.CustomerType === 'Ứng viên phỏng vấn' ? 'Đối tượng' : 'Khách hàng'}</th>
              <th style="background-color: #F29D38; color: #000000; font-weight: bold; border: 1px solid #dddddd; padding: 10px 12px; text-align: left; width: 27%;">Thông tin lịch trình</th>
              <th style="background-color: #F29D38; color: #000000; font-weight: bold; border: 1px solid #dddddd; padding: 10px 12px; text-align: left; width: 10%;">Địa điểm tiếp đón</th>
            </tr>
          </thead>
          <tbody>
            ${tableIRowsHtml}
          </tbody>
        </table>
        
        <h3 style="margin-bottom: 10px; font-size: 15px; color: #333;">II. Chi tiết công việc cần chuẩn bị:</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 13px;">
          <thead>
            <tr>
              <th style="background-color: #F29D38; color: #000000; font-weight: bold; border: 1px solid #dddddd; padding: 10px 12px; text-align: left; width: 15%;">Công việc</th>
              <th style="background-color: #F29D38; color: #000000; font-weight: bold; border: 1px solid #dddddd; padding: 10px 12px; text-align: left; width: 25%;">Chi tiết công việc</th>
              <th style="background-color: #F29D38; color: #000000; font-weight: bold; border: 1px solid #dddddd; padding: 10px 12px; text-align: left; width: 12%;">Ngày cần hoàn thành chuẩn bị</th>
              <th style="background-color: #F29D38; color: #000000; font-weight: bold; border: 1px solid #dddddd; padding: 10px 12px; text-align: left; width: 13%;">Người thực hiện</th>
              <th style="background-color: #F29D38; color: #000000; font-weight: bold; border: 1px solid #dddddd; padding: 10px 12px; text-align: left; width: 15%;">Email người thực hiện</th>
              <th style="background-color: #F29D38; color: #000000; font-weight: bold; border: 1px solid #dddddd; padding: 10px 12px; text-align: left; width: 10%;">Giám sát</th>
              <th style="background-color: #F29D38; color: #000000; font-weight: bold; border: 1px solid #dddddd; padding: 10px 12px; text-align: left; width: 12%;">Email giám sát</th>
            </tr>
          </thead>
          <tbody>
            ${tableIIRowsHtml}
          </tbody>
        </table>
        
        <div style="margin-top: 25px; font-size: 14px; color: #555555;">
          <p>Nhờ anh chị PIC theo dõi, hoàn thành công việc đúng thời hạn, các giám sát công việc kiểm tra sát sao tình hình tiến độ trên nhé.</p>
          <p>Xin cảm ơn.</p>
          <p>Thân ái,</p>
        </div>
      </body>
      </html>
    `;

    const url = `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`;
    const mailPayload = {
      message: {
        subject: customSubject,
        body: {
          contentType: 'HTML',
          content: htmlBody
        },
        toRecipients,
        ccRecipients
      },
      saveToSentItems: 'true'
    };

    await axios.post(url, mailPayload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`[Email Notification] ✅ Custom email "${customSubject}" sent successfully`);
  } catch (error) {
    console.error(`[Email Notification] ❌ Failed to send custom email "${customSubject}":`, error.response?.data || error.message);
  }
}

/**
 * Trích xuất và gom chuỗi thông tin lịch trình cho 1 địa điểm từ AgendaJsonData
 */
function getScheduleTextForDestination(agendaJson, destination) {
  if (!agendaJson || !Array.isArray(agendaJson)) return '';

  const items = [];
  agendaJson.forEach(day => {
    const dateStr = day.date; // yyyy-MM-dd
    const agendaList = day.agenda?.[destination] || [];
    agendaList.forEach(item => {
      items.push({
        date: dateStr,
        timeStart: item.timeStart || '',
        contentType: item.contentType || '',
        detail: item.detail || ''
      });
    });
  });

  // Sắp xếp lịch trình theo ngày, sau đó theo giờ bắt đầu
  items.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.timeStart.localeCompare(b.timeStart);
  });

  return items.map(item => {
    const type = item.contentType || 'Công việc';
    const time = item.timeStart || '⏰';
    const desc = item.detail || '';
    return `${type} - ${time}${desc ? ' - ' + desc : ''}`;
  }).join(' | ');
}

/**
 * Định dạng hiển thị email dạng link mailto
 */
function formatEmailLinks(emailStr) {
  if (!emailStr || emailStr.trim() === '' || emailStr === ';') return '—';
  return emailStr
    .split(/[;,\s\n]+/)
    .map(email => email.trim())
    .filter(email => email.includes('@') && email.length > 3)
    .map(email => `<a href="mailto:${email}" style="color: #0078d4; text-decoration: underline; word-break: break-all;">${email}</a>`)
    .join('; ');
}

/**
 * Định dạng ngày từ Date object hoặc ISO string thành DD-MM-YYYY
 */
function formatDDate(dateVal) {
  if (!dateVal) return '—';
  try {
    const d = new Date(dateVal);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}-${month}-${d.getFullYear()}`;
  } catch (e) {
    return '—';
  }
}

/**
 * Escape ký tự đặc biệt HTML chống XSS và bể cấu trúc email
 */
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
 * Kiểm tra xem công việc có phải là chuẩn bị xe hay không (loại trừ từ sân bay ở VSN-NT)
 */
function isCarPreparationTask(task) {
  const taskName = (task.TaskName || '').toLowerCase().trim();
  const dest = (task.Destination || '').trim();
  const isCar = taskName.includes('chuẩn bị xe');
  const isExcluded = taskName.includes('từ sân bay') && dest === 'VSN-NT';
  return isCar && !isExcluded;
}

/**
 * Lấy chuỗi ngày dạng YYYY-MM-DD từ đối tượng Date hoặc chuỗi ngày an toàn theo múi giờ địa phương
 */
function getYYYYMMDD(dateVal) {
  if (!dateVal) return '';
  try {
    if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateVal)) {
      return dateVal.substring(0, 10);
    }
    const d = new Date(dateVal);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    return '';
  }
}

/**
 * Trích xuất và gom chuỗi thông tin lịch trình cho 1 địa điểm và ngày cụ thể từ AgendaJsonData
 */
function getScheduleTextForDestinationAndDate(agendaJson, destination, onboardDate) {
  if (!agendaJson || !Array.isArray(agendaJson)) return '';

  const targetDateStr = getYYYYMMDD(onboardDate);
  if (!targetDateStr) return '';

  const items = [];

  agendaJson.forEach(day => {
    const dayDateStr = getYYYYMMDD(day.date);
    if (dayDateStr !== targetDateStr) return;

    const agendaList = day.agenda?.[destination] || [];
    agendaList.forEach(item => {
      items.push({
        timeStart: item.timeStart || '',
        contentType: item.contentType || '',
        detail: item.detail || ''
      });
    });
  });

  items.sort((a, b) => a.timeStart.localeCompare(b.timeStart));

  return items.map(item => {
    const type = item.contentType || 'Di chuyển';
    const time = item.timeStart || '⏰';
    const desc = item.detail || '';
    return `${type} - ${time}${desc ? ' - ' + desc : ''}`;
  }).join(' | ');
}

/**
 * Biên dịch danh sách đại diện khách hàng từ Json
 */
function compileGuestRepsList(guestRepsJson) {
  if (!guestRepsJson) return '—';
  try {
    const reps = JSON.parse(guestRepsJson);
    if (Array.isArray(reps) && reps.length > 0) {
      return reps.map(r => {
        const salutation = r.salutation || '';
        const name = r.name || '';
        const title = r.title || '';
        return `${salutation ? salutation + ' ' : ''}${name}${title ? ' - ' + title : ''}`;
      }).join('; ');
    }
  } catch (e) {
    console.error('Error parsing GuestReps JSON in vehicle mail compiler:', e.message);
  }
  return '—';
}

/**
 * So sánh xem thông tin đi xe có thay đổi hay không
 */
function hasVehicleInfoChanged(oldProject, oldTasks, newProject, newTasks) {
  const oldDates = [...new Set(oldTasks.map(t => new Date(t.OnboardDate).toISOString().split('T')[0]))].sort().join(',');
  const newDates = [...new Set(newTasks.map(t => new Date(t.OnboardDate).toISOString().split('T')[0]))].sort().join(',');
  if (oldDates !== newDates) return true;

  const oldDests = [...new Set(oldTasks.map(t => t.Destination))].sort().join(',');
  const newDests = [...new Set(newTasks.map(t => t.Destination))].sort().join(',');
  if (oldDests !== newDests) return true;

  if (oldProject.AgendaJsonData !== newProject.AgendaJsonData) return true;

  const oldCarTasks = oldTasks.filter(isCarPreparationTask);
  const newCarTasks = newTasks.filter(isCarPreparationTask);
  if (oldCarTasks.length !== newCarTasks.length) return true;

  for (let i = 0; i < newCarTasks.length; i++) {
    const n = newCarTasks[i];
    const o = oldCarTasks.find(x => x.TaskName === n.TaskName && x.Destination === n.Destination);
    if (!o) return true;
    if (n.Vehicle !== o.Vehicle || n.PassengerCount !== o.PassengerCount) {
      return true;
    }
    const oRet = o.ReturnDate ? new Date(o.ReturnDate).getTime() : 0;
    const nRet = n.ReturnDate ? new Date(n.ReturnDate).getTime() : 0;
    if (oRet !== nRet) return true;
  }

  return false;
}

/**
 * Gửi email thông báo chuẩn bị xe (Đăng ký đi công tác) cho PIC và Supervisor
 */
async function sendCarNotificationEmail(project, task, donVi, phong, excelData, isEditChange, accessToken) {
  try {
    const senderEmail = process.env.SENDER_EMAIL;
    if (!senderEmail) return;

    const toEmails = new Set();
    const ccEmails = new Set();

    if (task.AssigneeEmail) {
      task.AssigneeEmail.split(/[;,\s\n]+/).forEach(e => {
        const email = e.trim().toLowerCase();
        if (email.includes('@')) toEmails.add(email);
      });
    }

    if (task.SupervisorEmail) {
      task.SupervisorEmail.split(/[;,\s\n]+/).forEach(e => {
        const email = e.trim().toLowerCase();
        if (email.includes('@')) ccEmails.add(email);
      });
    }

    if (project.SubmitterEmail) {
      ccEmails.add(project.SubmitterEmail.trim().toLowerCase());
    }

    toEmails.forEach(e => ccEmails.delete(e));

    if (toEmails.size === 0) {
      console.warn(`[Vehicle Workflow] ⚠️ No assignee email found for car task ${task.Task_id}`);
      return;
    }

    const toRecipients = Array.from(toEmails).map(email => ({ emailAddress: { address: email } }));
    const ccRecipients = Array.from(ccEmails).map(email => ({ emailAddress: { address: email } }));

    const editPrefixHtml = isEditChange
      ? `<div style="font-family: Arial, sans-serif; font-size: 15px; font-weight: bold; color: #d9381e; margin-bottom: 20px; border-left: 4px solid #d9381e; padding-left: 10px;">
          Nội dung công tác thay đổi như sau:
         </div>`
      : '';

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333333; margin: 0; padding: 20px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 14px; }
          th { background-color: #F29D38; color: #000000; font-weight: bold; border: 1px solid #dddddd; padding: 10px 12px; text-align: left; }
          td { border: 1px solid #dddddd; padding: 10px 12px; vertical-align: top; }
          .label { font-weight: bold; background-color: #f9f9f9; width: 30%; }
        </style>
      </head>
      <body>
        <p>Kính gửi anh/chị <b>${escapeHtml(project.SubmitterName)}</b>,</p>
        
        ${editPrefixHtml}
        
        <p>Đăng ký đi công tác đã được gửi với nội dung như sau:</p>
        
        <table>
          <thead>
            <tr>
              <th>Thông tin</th>
              <th>Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="label">Đơn vị</td>
              <td>${escapeHtml(donVi)}</td>
            </tr>
            <tr>
              <td class="label">Phòng</td>
              <td>${escapeHtml(phong)}</td>
            </tr>
            <tr>
              <td class="label">Nội dung đi công tác</td>
              <td>${escapeHtml(excelData.noiDungCongTac)}</td>
            </tr>
            <tr>
              <td class="label">Địa điểm đi công tác</td>
              <td>${escapeHtml(excelData.diaDiemCongTac)}</td>
            </tr>
            <tr>
              <td class="label">Số người đi</td>
              <td>${escapeHtml(excelData.soNguoiDi)}</td>
            </tr>
            <tr>
              <td class="label">Danh sách đi công tác</td>
              <td>${escapeHtml(excelData.danhSachDiCongTac)}</td>
            </tr>
            <tr>
              <td class="label">Phương tiện</td>
              <td>${escapeHtml(excelData.phuongTien)}</td>
            </tr>
            <tr>
              <td class="label">Ngày đi</td>
              <td>${escapeHtml(excelData.ngayDi)}</td>
            </tr>
            <tr>
              <td class="label">Ngày về</td>
              <td>${escapeHtml(excelData.ngayVe)}</td>
            </tr>
          </tbody>
        </table>
        
        <p style="color: #555555; font-size: 0.9em; margin-top: 25px;">
          Lưu ý: Email này được tạo tự động từ Hệ thống Đăng ký và Quản lý Lịch tiếp đón CSR.
        </p>
      </body>
      </html>
    `;

    const subject = isEditChange
      ? `[CẬP NHẬT CHỈNH SỬA] Đăng ký đi công tác - Đơn tiếp khách [${project.ParentId}] - Xe đi ${task.Destination}`
      : `Đăng ký đi công tác - Đơn tiếp khách [${project.ParentId}] - Xe đi ${task.Destination}`;

    const sendMailUrl = `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`;

    const mailPayload = {
      message: {
        subject,
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
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 8000
    });

    console.log(`[Vehicle Workflow] ✅ Vehicle email sent successfully for task ${task.Task_id}`);
  } catch (error) {
    console.error(`[Vehicle Workflow] ❌ Failed to send car email for task ${task.Task_id}:`, error.response?.data || error.message);
  }
}

/**
 * Quản lý toàn bộ luồng đồng bộ Excel và gửi email chuẩn bị xe khi BOD duyệt
 */
async function handleVehicleTasksSyncAndNotification(project, tasks, pool) {
  try {
    const carTasks = tasks.filter(isCarPreparationTask);
    if (carTasks.length === 0) {
      console.log(`[Vehicle Workflow] ℹ️ No car preparation tasks found for ${project.Project_id}`);
      return;
    }

    console.log(`[Vehicle Workflow] 🚗 Processing ${carTasks.length} car tasks for ${project.Project_id}`);

    let shouldNotify = true;
    let isEditChange = false;

    if (project.Version > 1 && project.ParentId) {
      const prevVer = project.Version - 1;
      const prevRes = await pool.request()
        .input('ParentId', sql.NVarChar(50), project.ParentId)
        .input('Version', sql.Int, prevVer)
        .query('SELECT Project_id, AgendaJsonData FROM CSR_Projects WHERE ParentId = @ParentId AND Version = @Version');

      const prevProject = prevRes.recordset?.[0];
      if (prevProject) {
        const prevTasksRes = await pool.request()
          .input('ProjectId', sql.NVarChar(100), prevProject.Project_id)
          .execute('usp_Submission_GetDetail');
        const prevTasks = prevTasksRes.recordsets[1] || [];
        const prevActiveTasks = prevTasks.filter(t => t.IsActive !== false);

        const changed = hasVehicleInfoChanged(prevProject, prevActiveTasks, project, tasks);
        if (!changed) {
          console.log(`[Vehicle Workflow] ℹ️ Vehicle-related fields did not change for edited sheet. Skipping notification & sync.`);
          shouldNotify = false;
        } else {
          isEditChange = true;
        }
      }
    }

    if (!shouldNotify) return;

    const accessToken = await getAccessToken();
    const shareUrl = process.env.SHARE_URL;
    const tableName = process.env.SHAREPOINT_EXCEL_TABLE || 'Table1';

    let submitterDept = '';
    if (project.SubmitterMNV) {
      const userRes = await pool.request()
        .input('MNV', sql.NVarChar(50), project.SubmitterMNV)
        .query('SELECT Department FROM CSR_Users WHERE MNV = @MNV');
      if (userRes.recordset.length > 0) {
        submitterDept = userRes.recordset[0].Department || '';
      }
    }

    let donVi = 'VSN';
    let phong = submitterDept || '—';
    if (submitterDept) {
      const deptUpper = submitterDept.toUpperCase().trim();
      if (deptUpper.startsWith('BU') || deptUpper.startsWith('PD') || deptUpper.startsWith('TD') || deptUpper.startsWith('SMP')) {
        donVi = 'DC';
      } else if (deptUpper.includes('PY') || deptUpper.includes('VSPY')) {
        donVi = 'VSN-PY';
      } else if (deptUpper.includes('NT') || deptUpper.includes('VSNT')) {
        donVi = 'VSN-NT';
      }
    }

    let agendaJson = [];
    if (project.AgendaJsonData) {
      try {
        agendaJson = JSON.parse(project.AgendaJsonData);
      } catch (e) { }
    }

    const guestRepsCompiled = compileGuestRepsList(project.GuestReps);
    const guestsSuffix = guestRepsCompiled !== '—' ? `; Khách: ${guestRepsCompiled}` : '';
    const attendeesList = `${project.Attendees || ''}${guestsSuffix}`;

    // Đếm khách và người tham gia công việc đó
    const empCount = (project.Attendees || '').split(/[;,\n]+/).map(x => x.trim()).filter(Boolean).length;
    let guestCount = 0;
    if (project.GuestCount) {
      guestCount = parseInt(project.GuestCount, 10) || 0;
    }
    // Nếu trong DB cột GuestCount bằng 0 hoặc rỗng, ta fallback đếm từ số phần tử của mảng GuestReps
    if (guestCount === 0 && project.GuestReps) {
      try {
        const reps = JSON.parse(project.GuestReps);
        if (Array.isArray(reps)) {
          guestCount = reps.length;
        }
      } catch (e) {
        console.error('[Vehicle Workflow] Error parsing GuestReps to count guests:', e.message);
      }
    }
    const totalPeople = empCount + guestCount;

    for (const task of carTasks) {
      const taskOnboardDateStr = getYYYYMMDD(task.OnboardDate);
      const trackingKey = `${project.ParentId}_${task.Destination}_${taskOnboardDateStr}`;

      const scheduleText = getScheduleTextForDestinationAndDate(agendaJson, task.Destination, task.OnboardDate);

      // Lấy số người đi xe từ task.PassengerCount nếu được nhập, nếu không fallback về totalPeople, tối thiểu là 1
      const passengerCount = parseInt(task.PassengerCount, 10) || totalPeople || 1;
      const ngayVeFormatted = formatDDate(task.ReturnDate || task.OnboardDate);

      const noiDungCongTac = `Số người: ${passengerCount} ; Phương tiện: ${task.Vehicle || '—'} ; Ngày về: ${ngayVeFormatted} ; Thông tin lịch trình: ${scheduleText || '—'}`;

      const excelData = {
        donVi,
        phong,
        mnv: project.SubmitterMNV || '',
        nguoiTao: project.SubmitterName || '',
        email: project.SubmitterEmail || '',
        noiDungCongViec: noiDungCongTac,
        soNguoi: passengerCount,
        diaDiemCongTac: task.Destination,
        danhSachDi: attendeesList,
        thongTin: noiDungCongTac,
        phuongTien: task.Vehicle || '—',
        thang: formatDDate(task.OnboardDate),
        ngayDi: formatDDate(task.OnboardDate),
        ngayVe: ngayVeFormatted
      };

      // A. Đẩy dữ liệu lên SharePoint Excel Table (không chặn email nếu thất bại)
      try {
        await upsertExcelRow(accessToken, shareUrl, tableName, project.ParentId, excelData);
      } catch (syncErr) {
        console.error(`[Vehicle Workflow] ⚠️ SharePoint sync failed for task ${task.Task_id}, continuing to send email:`, syncErr.message);
      }

      // B. Gửi email đăng ký đi công tác
      await sendCarNotificationEmail(project, task, donVi, phong, { ...excelData, noiDungCongTac: noiDungCongTac, danhSachDiCongTac: attendeesList, soNguoiDi: passengerCount }, isEditChange, accessToken);
    }

  } catch (err) {
    console.error('[Vehicle Workflow] ❌ Error in handleVehicleTasksSyncAndNotification:', err.message);
  }
}

/**
 * Lập lịch gửi email cho các loại khách đặc biệt vào lúc 16:00 chiều của ngày trước ngày tiếp đón 1 ngày
 */
async function scheduleApprovalEmail(projectId, parentId, isEdit, activeTasks, pool) {
  try {
    let minOnboardDate = null;
    if (activeTasks && activeTasks.length > 0) {
      const dates = activeTasks
        .map(t => t.OnboardDate ? new Date(t.OnboardDate) : null)
        .filter(d => d && !isNaN(d.getTime()));
      if (dates.length > 0) {
        minOnboardDate = new Date(Math.min(...dates));
      }
    }

    if (!minOnboardDate) {
      const projRes = await pool.request()
        .input('ProjectId', sql.NVarChar(100), projectId)
        .query('SELECT AgendaJsonData FROM CSR_Projects WHERE Project_id = @ProjectId');
      if (projRes.recordset.length > 0 && projRes.recordset[0].AgendaJsonData) {
        try {
          const agendaJson = JSON.parse(projRes.recordset[0].AgendaJsonData);
          if (Array.isArray(agendaJson) && agendaJson.length > 0) {
            const dates = agendaJson
              .map(day => day.date ? new Date(day.date) : null)
              .filter(d => d && !isNaN(d.getTime()));
            if (dates.length > 0) {
              minOnboardDate = new Date(Math.min(...dates));
            }
          }
        } catch (e) {
          console.error('[Scheduled Email] Failed to parse AgendaJsonData:', e.message);
        }
      }
    }

    let sendAt = new Date();
    if (minOnboardDate) {
      sendAt = new Date(minOnboardDate);
      // Giảm đi 1 ngày
      sendAt.setDate(sendAt.getDate() - 1);
      // Đặt giờ gửi lúc 16:00:00.000
      sendAt.setHours(16, 0, 0, 0);
    } else {
      // Fallback nếu không có task, gửi vào lúc 16:00 ngày hôm nay hoặc ngay lập tức nếu đã qua 16:00
      sendAt.setHours(16, 0, 0, 0);
    }

    const emailType = isEdit ? 'Edit' : 'Approval';

    // Đăng ký vào bảng CSR_ScheduledEmails
    await pool.request()
      .input('ProjectId', sql.NVarChar(100), projectId)
      .input('ParentId', sql.NVarChar(100), parentId)
      .input('EmailType', sql.NVarChar(50), emailType)
      .input('SendAt', sql.DateTime, sendAt)
      .execute('usp_InsertScheduledEmail');

    console.log(`[Scheduled Email] ⏰ Scheduled email type "${emailType}" for project ${projectId} at ${sendAt.toISOString()}`);
  } catch (error) {
    console.error(`[Scheduled Email] ❌ Failed to schedule email for ${projectId}:`, error.message);
    throw error;
  }
}

/**
 * Hủy toàn bộ email lập lịch còn chưa gửi (Pending) của dự án
 */
async function cancelPendingScheduledEmails(parentId, pool) {
  try {
    if (!pool) {
      pool = await getCsrPool();
    }
    await pool.request()
      .input('ParentId', sql.NVarChar(100), parentId)
      .execute('usp_CancelPendingScheduledEmails');
    console.log(`[Scheduled Email] ❌ Cancelled all pending scheduled emails for parent ${parentId}`);
  } catch (error) {
    console.error(`[Scheduled Email] ❌ Failed to cancel pending scheduled emails for parent ${parentId}:`, error.message);
  }
}

/**
 * Đồng bộ thông tin đăng ký ra vào cổng tại VSN OFFICE lên SharePoint Excel Table
 */
async function handleGatePassSync(project, tasks, pool) {
  try {
    // 1. Lọc các task diễn ra tại VSN OFFICE (không phân biệt hoa thường)
    const gateTasks = tasks.filter(t => t.Destination && t.Destination.toUpperCase().trim() === 'VSN OFFICE');
    if (gateTasks.length === 0) {
      console.log(`[Gate Sync] ℹ️ No VSN OFFICE tasks found for ${project.Project_id}. Skipping gate sync.`);
      return;
    }

    console.log(`[Gate Sync] 🚪 Processing ${gateTasks.length} VSN OFFICE task(s) for ${project.Project_id}`);

    const accessToken = await getAccessToken();
    const gateShareUrl = process.env.SHAREPOINT_GATE_EXCEL_URL;
    const gateTableName = process.env.SHAREPOINT_GATE_EXCEL_TABLE || 'Table1';

    if (!gateShareUrl) {
      console.warn('[Gate Sync] ⚠️ No SHAREPOINT_GATE_EXCEL_URL configured in env. Cannot sync gate logs.');
      return;
    }

    const getYYYYMMDDNoDash = (dateVal) => {
      if (!dateVal) return '';
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '';
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}${mm}${dd}`;
    };

    const getDMYYYY = (dateVal) => {
      if (!dateVal) return '';
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '';
      return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    };

    const customerNameUpper = String(project.CustomerName || '').toUpperCase().trim();
    const submitDateStr = getYYYYMMDDNoDash(project.SubmitDate || project.CreatedAt || new Date());

    let guestInfo = '';
    if (project.GuestReps) {
      try {
        const reps = JSON.parse(project.GuestReps);
        if (Array.isArray(reps)) {
          guestInfo = reps.map(r => {
            const salu = r.salutation ? (r.salutation.endsWith('.') ? r.salutation : r.salutation + '.') : '';
            const namePart = r.name ? r.name.trim() : '';
            const titlePart = r.title ? ` - ${r.title.trim()}` : '';
            return `${salu} ${namePart}${titlePart}`.trim();
          })
            .filter(x => x && x !== '.' && x !== '-')
            .join(' | ');
        }
      } catch (e) {
        console.error('[Gate Sync] Error parsing GuestReps:', e.message);
      }
    }

    const parentId = project.ParentId || project.Project_id;

    for (const task of gateTasks) {
      const gateData = {
        customerName: project.CustomerName || '',
        ngayDen: getDMYYYY(task.OnboardDate),
        guestInfo: guestInfo || '—',
        lyDo: project.MeetingTopic || '—',
        mnvTiepNhan: project.SubmitterMNV || '',
        nguoiTiepNhan: project.SubmitterName || ''
      };

      await upsertGateExcelRow(accessToken, gateShareUrl, gateTableName, parentId, gateData);
    }
  } catch (err) {
    console.error('[Gate Sync] ❌ Error in handleGatePassSync:', err.message);
  }
}

module.exports = {
  handleBODApprovalActions,
  handleProjectEditNotification,
  handleProjectCancelNotification,
  sendApprovalEmail,
  cancelPendingScheduledEmails
};