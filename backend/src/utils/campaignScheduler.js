const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { getCsrPool, sql } = require('../config/database');
const { getAccessToken } = require('../config/sharepoint');

/**
 * Khởi chạy job lập lịch kiểm tra và gửi email chiến dịch marketing tự động hàng ngày lúc 08:00
 */
function startCampaignScheduler() {
  console.log('[Campaign Scheduler] ⏰ Campaign scheduler registered. Checking every minute...');

  let lastRunDate = ''; // Lưu ngày cuối cùng chạy để tránh chạy nhiều lần trong cùng một ngày ở khung giờ 08:00

  setInterval(async () => {
    try {
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();

      // Kiểm tra nếu là đúng 08:00 sáng
      if (currentHours === 8 && currentMinutes === 0) {
        const todayStr = now.toISOString().split('T')[0]; // Định dạng YYYY-MM-DD

        if (lastRunDate !== todayStr) {
          console.log(`[Campaign Scheduler] 🚀 Triggering daily campaign job at 08:00 on ${todayStr}`);
          lastRunDate = todayStr;
          await processCampaigns();
        }
      }
    } catch (err) {
      console.error('[Campaign Scheduler] ❌ Interval job check error:', err.message);
    }
  }, 60000); // Kiểm tra mỗi phút
}

/**
 * Xử lý chính việc quét lịch và gửi email
 */
async function processCampaigns() {
  try {
    const pool = await getCsrPool();
    const now = new Date();

    // Tính ngày tiếp đón 7 ngày tới (YYYY-MM-DD)
    const targetDate = new Date();
    targetDate.setDate(now.getDate() + 7);
    const targetDateStr = targetDate.toISOString().split('T')[0];

    console.log(`[Campaign Scheduler] Scanning for customer receptions on target date: ${targetDateStr}`);

    // 1. Tìm các lịch tiếp đón cách 7 ngày (Ngày tiếp đón đầu tiên của đơn là ngày đích)
    const projectRes = await pool.request()
      .input('TargetDate', sql.Date, targetDateStr)
      .execute('usp_EmailCampaign_GetUpcomingProjects');

    const upcomingProjects = projectRes.recordset || [];
    if (upcomingProjects.length === 0) {
      console.log(`[Campaign Scheduler] No upcoming customer receptions found for target date ${targetDateStr}.`);
      return;
    }

    console.log(`[Campaign Scheduler] Found ${upcomingProjects.length} customer reception(s) for target date ${targetDateStr}.`);

    // 2. Lấy các template mục đích "Chào đón khách" hoặc "Mời sự kiện" đang hoạt động và trong thời hạn hiệu lực
    const todayStr = now.toISOString().split('T')[0];
    const templateRes = await pool.request()
      .input('Today', sql.Date, todayStr)
      .execute('usp_EmailCampaign_GetActiveTemplates');

    const activeTemplates = templateRes.recordset || [];
    if (activeTemplates.length === 0) {
      console.log('[Campaign Scheduler] No active templates available today.');
      return;
    }

    console.log(`[Campaign Scheduler] Loaded ${activeTemplates.length} active template(s).`);

    const defaultSenderEmail = process.env.SENDER_EMAIL;
    if (!defaultSenderEmail) {
      console.error('[Campaign Scheduler] ❌ No SENDER_EMAIL configured in .env. Cannot send campaigns.');
      return;
    }

    const accessToken = await getAccessToken();

    // 3. Khớp và gửi email
    for (const project of upcomingProjects) {
      try {
        // Kiểm tra xem đã gửi bất kỳ email campaign nào cho Project này chưa (để đảm bảo chỉ gửi 1 lần)
        const logCheck = await pool.request()
          .input('ProjectId', sql.NVarChar(100), project.Project_id)
          .execute('usp_EmailCampaign_CheckLogSuccess');

        if (logCheck.recordset.length > 0) {
          console.log(`[Campaign Scheduler] ℹ️ Campaign already successfully sent for project ${project.Project_id}. Skipping.`);
          continue;
        }

        // Lấy danh sách nhiệm vụ của đơn để kiểm tra địa điểm và ngày tiếp đón
        const tasksRes = await pool.request()
          .input('ProjectId', sql.NVarChar(100), project.Project_id)
          .execute('usp_EmailCampaign_GetProjectTasks');
        const projectTasks = tasksRes.recordset || [];
        const projectDestinations = projectTasks.map(t => t.Destination).filter(Boolean);

        // Tìm template phù hợp nhất
        let matchedTemplate = null;

        for (const temp of activeTemplates) {
          // A. Kiểm tra địa điểm của template
          if (temp.Location && temp.Location.trim() !== '') {
            // Nếu template cấu hình cho một địa điểm cụ thể, đơn phải đi qua địa điểm đó
            const hasLocationMatch = projectDestinations.some(d => d.toLowerCase() === temp.Location.toLowerCase());
            if (!hasLocationMatch) continue;
          }

          // B. Kiểm tra khách hàng của template
          if (temp.IsAllCustomer) {
            matchedTemplate = temp;
            break; // Tìm thấy template áp dụng cho tất cả -> chọn luôn
          } else if (temp.Customers) {
            try {
              const customerList = JSON.parse(temp.Customers);
              if (Array.isArray(customerList) && customerList.some(c => c.toLowerCase() === project.CustomerName.toLowerCase())) {
                matchedTemplate = temp;
                break; // Tìm thấy khớp chính xác khách hàng -> chọn và dừng
              }
            } catch (e) {
              console.error(`[Campaign Scheduler] Error parsing template customers json for ID ${temp.Id}:`, e.message);
            }
          }
        }

        if (!matchedTemplate) {
          console.log(`[Campaign Scheduler] No matching template found for customer "${project.CustomerName}" in project ${project.Project_id}.`);
          continue;
        }

        console.log(`[Campaign Scheduler] Matched template "${matchedTemplate.TemplateName}" for project ${project.Project_id}`);

        // 4. Xác định thông tin người nhận
        const toRecipientsSet = new Set();
        let recipientName = matchedTemplate.RecipientName || '';
        let recipientEmailSetting = matchedTemplate.RecipientEmail || '';

        // Nếu có cấu hình email thủ công cụ thể (không phải lookup/trống) thì gửi tới đó
        if (recipientEmailSetting && recipientEmailSetting.trim() !== '' && recipientEmailSetting.toLowerCase() !== 'lookup') {
          recipientEmailSetting.split(/[;,\s\n]+/).forEach(e => {
            const email = e.trim().toLowerCase();
            if (email.includes('@')) {
              toRecipientsSet.add(email);
            }
          });
        } else {
          // Tự động tìm kiếm theo loại mục đích chiến dịch
          if (matchedTemplate.Purpose === 'Chào đón khách') {
            if (project.GuestReps) {
              try {
                const reps = JSON.parse(project.GuestReps);
                if (Array.isArray(reps)) {
                  reps.forEach(r => {
                    const email = r.email ? r.email.trim().toLowerCase() : '';
                    if (email.includes('@')) {
                      toRecipientsSet.add(email);
                    }
                  });
                }
              } catch (e) {
                console.error(`[Campaign Scheduler] Error parsing project.GuestReps for project ${project.Project_id}:`, e.message);
              }
            }

            // Fallback: Nếu không tìm thấy email nào trong đơn tiếp đón, tìm từ danh mục cấu hình khách hàng
            if (toRecipientsSet.size === 0) {
              const custRes = await pool.request()
                .input('Category', sql.NVarChar(50), project.CustomerType)
                .input('Name', sql.NVarChar(200), project.CustomerName)
                .execute('usp_GetCustomerConfigReps');

              const row = custRes.recordset?.[0];
              if (row) {
                if (row.JsonData) {
                  try {
                    const reps = JSON.parse(row.JsonData);
                    if (Array.isArray(reps)) {
                      reps.forEach(r => {
                        const email = r.email ? r.email.trim().toLowerCase() : '';
                        if (email.includes('@')) toRecipientsSet.add(email);
                      });
                    }
                  } catch (e) { }
                }
                if (row.Email && row.Email.trim() !== '') {
                  row.Email.split(/[;,\s\n]+/).forEach(e => {
                    const email = e.trim().toLowerCase();
                    if (email.includes('@')) toRecipientsSet.add(email);
                  });
                }
              }
            }
          } else if (matchedTemplate.Purpose === 'Mời sự kiện') {
            const custRes = await pool.request()
              .input('Category', sql.NVarChar(50), project.CustomerType)
              .input('Name', sql.NVarChar(200), project.CustomerName)
              .execute('usp_GetCustomerConfigReps');

            const customerJsonData = custRes.recordset?.[0]?.JsonData;
            if (customerJsonData) {
              try {
                const reps = JSON.parse(customerJsonData);
                if (Array.isArray(reps)) {
                  reps.forEach(r => {
                    const email = r.email ? r.email.trim().toLowerCase() : '';
                    if (email.includes('@')) {
                      toRecipientsSet.add(email);
                    }
                  });
                }
              } catch (e) {
                console.error(`[Campaign Scheduler] Error parsing customer config JsonData for ${project.CustomerName}:`, e.message);
              }
            }
          }
        }

        if (toRecipientsSet.size === 0) {
          console.warn(`[Campaign Scheduler] ⚠️ No valid recipient email resolved for template ${matchedTemplate.TemplateName} and project ${project.Project_id}. Skipping.`);

          // Ghi log thất bại
          await pool.request()
            .input('TemplateId', sql.Int, matchedTemplate.Id)
            .input('ProjectId', sql.NVarChar(100), project.Project_id)
            .input('Status', sql.NVarChar(50), 'Failed')
            .input('ErrorMessage', sql.NVarChar(sql.MAX), `Không tìm thấy bất kỳ email người nhận hợp lệ nào cho mục đích ${matchedTemplate.Purpose}`)
            .execute('usp_InsertEmailCampaignLog');
          continue;
        }

        const toRecipients = Array.from(toRecipientsSet).map(email => ({
          emailAddress: {
            address: email,
            name: recipientName || project.CustomerName || ''
          }
        }));

        // 5. Render nội dung và tiêu đề (Placeholder replacements)
        const concatDestinations = [...new Set(projectTasks.map(t => t.Destination).filter(Boolean))].join(', ');

        const dateStrings = projectTasks
          .map(t => t.OnboardDate)
          .filter(Boolean)
          .map(d => {
            const dObj = new Date(d);
            return String(dObj.getDate()).padStart(2, '0') + '/' + String(dObj.getMonth() + 1).padStart(2, '0') + '/' + dObj.getFullYear();
          });
        const concatDates = [...new Set(dateStrings)].join(', ');

        // Bảng Lịch Agenda HTML
        const agendaRowsP = projectTasks
          .filter(t => t.OnboardDate)
          .map(t => {
            const d = new Date(t.OnboardDate);
            const dateStr = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
            const pickupTime = t.MeetingStartTime ? String(t.MeetingStartTime).slice(0, 5) : '';
            const dest = t.Destination || '';
            const meal = t.MealOption || '';
            return '<tr>' +
              '<td style="border:1px solid #e5e7eb;padding:8px 12px;white-space:nowrap">' + dateStr + '</td>' +
              '<td style="border:1px solid #e5e7eb;padding:8px 12px">' + dest + '</td>' +
              '<td style="border:1px solid #e5e7eb;padding:8px 12px;white-space:nowrap">' + pickupTime + '</td>' +
              '<td style="border:1px solid #e5e7eb;padding:8px 12px">' + meal + '</td>' +
              '</tr>';
          }).join('');
        const agendaTableP =
          '<table style="border-collapse:collapse;width:100%;font-size:13px;font-family:Segoe UI,sans-serif">' +
          '<thead><tr style="background:#f3f4f6">' +
          '<th style="border:1px solid #e5e7eb;padding:8px 12px;text-align:left">Onboard Date</th>' +
          '<th style="border:1px solid #e5e7eb;padding:8px 12px;text-align:left">Destination</th>' +
          '<th style="border:1px solid #e5e7eb;padding:8px 12px;text-align:left">Pick-up Time</th>' +
          '<th style="border:1px solid #e5e7eb;padding:8px 12px;text-align:left">Restaurant</th>' +
          '</tr></thead>' +
          '<tbody>' + agendaRowsP + '</tbody></table>';

        let finalSubject = matchedTemplate.EmailSubject || '';
        let finalBody = matchedTemplate.EmailBody || '';

        const placeholders = {
          '{{CustomerName}}': project.CustomerName || '',
          '{{Tên Khách Hàng}}': project.CustomerName || '',
          '{{Khách Hàng}}': project.CustomerName || '',

          '{{MeetingTopic}}': project.MeetingTopic || '',
          '{{Chủ Đề Tiếp Đón}}': project.MeetingTopic || '',

          '{{OnboardDate}}': concatDates,
          '{{Ngày Tiếp Đón}}': concatDates,

          '{{SubmitterName}}': project.SubmitterName || '',
          '{{Người Lập Phiếu}}': project.SubmitterName || '',
          '{{Người Gửi}}': project.SubmitterName || '',

          '{{Địa Điểm Tiếp Đón}}': concatDestinations,
          '{{Lịch Agenda}}': agendaTableP
        };

        // Thực hiện replace
        Object.entries(placeholders).forEach(([tag, val]) => {
          finalSubject = finalSubject.split(tag).join(val);
          finalBody = finalBody.split(tag).join(val);
        });

        finalSubject = sanitizeEmailSubject(finalSubject);
        finalBody = await processBodyImages(finalBody, pool);

        // 6. Gửi thư qua Graph API
        const finalSenderEmail = (matchedTemplate.SenderEmail && matchedTemplate.SenderEmail.trim()) || defaultSenderEmail;
        const url = `https://graph.microsoft.com/v1.0/users/${finalSenderEmail}/sendMail`;
        const mailPayload = {
          message: {
            subject: finalSubject,
            body: {
              contentType: 'HTML',
              content: finalBody
            },
            toRecipients
          },
          saveToSentItems: 'true'
        };

        await axios.post(url, mailPayload, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        console.log(`[Campaign Scheduler] ✅ Email campaign sent successfully to ${Array.from(toRecipientsSet).join(', ')} for project ${project.Project_id}`);

        // Ghi log thành công
        await pool.request()
          .input('TemplateId', sql.Int, matchedTemplate.Id)
          .input('ProjectId', sql.NVarChar(100), project.Project_id)
          .input('Status', sql.NVarChar(50), 'Success')
          .execute('usp_InsertEmailCampaignLog');

      } catch (projErr) {
        console.error(`[Campaign Scheduler] ❌ Failed to process campaign for project ${project.Project_id}:`, projErr.message);

        // Ghi log thất bại
        try {
          // Lấy ID template đầu tiên khớp làm tham chiếu ghi log
          const errorMsg = projErr.response?.data ? JSON.stringify(projErr.response.data) : projErr.message;
          await pool.request()
            .input('TemplateId', sql.Int, matchedTemplate?.Id || 0)
            .input('ProjectId', sql.NVarChar(100), project.Project_id)
            .input('Status', sql.NVarChar(50), 'Failed')
            .input('ErrorMessage', sql.NVarChar(sql.MAX), errorMsg)
            .execute('usp_InsertEmailCampaignLog');
        } catch (dbLogErr) {
          console.error('[Campaign Scheduler] Failed to write error log to DB:', dbLogErr.message);
        }
      }
    }
  } catch (err) {
    console.error('[Campaign Scheduler] ❌ Error in campaign processing:', err.message);
  }
}

/**
 * Gửi thủ công/kiểm thử một email campaign cho một dự án cụ thể và một template cụ thể.
 * Bỏ qua bộ lọc thời gian +7 ngày và chấp nhận cả đơn Draft/Nháp để phục vụ việc test.
 */
async function sendSingleCampaignEmail(projectId, templateId = null) {
  const pool = await getCsrPool();

  // 1. Lấy thông tin Project
  const projectRes = await pool.request()
    .input('ProjectId', sql.NVarChar(100), projectId)
    .execute('usp_Submission_GetDetail');

  const project = projectRes.recordset?.[0];
  if (!project) {
    throw new Error(`Không tìm thấy đơn tiếp đón với ID: ${projectId}`);
  }

  // Lấy các nhiệm vụ của đơn để có Destination, OnboardDate và các trường Agenda
  const tasksRes = await pool.request()
    .input('ProjectId', sql.NVarChar(100), projectId)
    .execute('usp_EmailCampaign_GetProjectTasks');
  const projectTasks = tasksRes.recordset || [];
  const projectDestinations = projectTasks.map(t => t.Destination).filter(Boolean);

  // 2. Tìm template
  let matchedTemplate = null;

  if (templateId) {
    // Nếu có truyền templateId cụ thể, lấy đúng template đó
    const tempRes = await pool.request()
      .input('Id', sql.Int, parseInt(templateId))
      .execute('usp_EmailTemplate_GetById');
    matchedTemplate = tempRes.recordset?.[0];
    if (!matchedTemplate) {
      throw new Error(`Không tìm thấy mẫu email với ID: ${templateId}`);
    }
  } else {
    // Tự động tìm template phù hợp nhất
    const todayStr = new Date().toISOString().split('T')[0];
    const templatesRes = await pool.request()
      .input('Today', sql.Date, todayStr)
      .execute('usp_EmailCampaign_GetActiveTemplates');
    const activeTemplates = templatesRes.recordset || [];

    for (const temp of activeTemplates) {
      if (temp.Location && temp.Location.trim() !== '') {
        const hasLocationMatch = projectDestinations.some(d => d.toLowerCase() === temp.Location.toLowerCase());
        if (!hasLocationMatch) continue;
      }

      if (temp.IsAllCustomer) {
        matchedTemplate = temp;
        break;
      } else if (temp.Customers) {
        try {
          const customerList = JSON.parse(temp.Customers);
          if (Array.isArray(customerList) && customerList.some(c => c.toLowerCase() === project.CustomerName.toLowerCase())) {
            matchedTemplate = temp;
            break;
          }
        } catch { }
      }
    }

    if (!matchedTemplate) {
      throw new Error(`Không tìm thấy mẫu email phù hợp tự động cho khách hàng "${project.CustomerName}"`);
    }
  }

  // 3. Lấy Sender Email mặc định
  const defaultSenderEmail = process.env.SENDER_EMAIL;
  if (!defaultSenderEmail) {
    throw new Error('Chưa cấu hình SENDER_EMAIL trong file môi trường .env của Backend.');
  }

  // 4. Giải quyết người nhận (Recipients)
  const toRecipientsSet = new Set();
  const recipientName = matchedTemplate.RecipientName || '';
  const recipientEmailSetting = matchedTemplate.RecipientEmail || '';

  if (recipientEmailSetting && recipientEmailSetting.trim() !== '' && recipientEmailSetting.toLowerCase() !== 'lookup') {
    recipientEmailSetting.split(/[;,\s\n]+/).forEach(e => {
      const email = e.trim().toLowerCase();
      if (email.includes('@')) toRecipientsSet.add(email);
    });
  } else {
    if (matchedTemplate.Purpose === 'Chào đón khách') {
      if (project.GuestReps) {
        try {
          const reps = JSON.parse(project.GuestReps);
          if (Array.isArray(reps)) {
            reps.forEach(r => {
              const email = r.email ? r.email.trim().toLowerCase() : '';
              if (email.includes('@')) toRecipientsSet.add(email);
            });
          }
        } catch { }
      }

      // Fallback: Nếu không tìm thấy email nào trong đơn tiếp đón, tìm từ danh mục cấu hình khách hàng
      if (toRecipientsSet.size === 0) {
        const custRes = await pool.request()
          .input('Category', sql.NVarChar(50), project.CustomerType)
          .input('Name', sql.NVarChar(200), project.CustomerName)
          .execute('usp_GetCustomerConfigReps');

        const row = custRes.recordset?.[0];
        if (row) {
          if (row.JsonData) {
            try {
              const reps = JSON.parse(row.JsonData);
              if (Array.isArray(reps)) {
                reps.forEach(r => {
                  const email = r.email ? r.email.trim().toLowerCase() : '';
                  if (email.includes('@')) toRecipientsSet.add(email);
                });
              }
            } catch (e) { }
          }
          if (row.Email && row.Email.trim() !== '') {
            row.Email.split(/[;,\s\n]+/).forEach(e => {
              const email = e.trim().toLowerCase();
              if (email.includes('@')) toRecipientsSet.add(email);
            });
          }
        }
      }
    } else if (matchedTemplate.Purpose === 'Mời sự kiện') {
      const custRes = await pool.request()
        .input('Category', sql.NVarChar(50), project.CustomerType)
        .input('Name', sql.NVarChar(200), project.CustomerName)
        .execute('usp_GetCustomerConfigReps');

      const customerJsonData = custRes.recordset?.[0]?.JsonData;
      if (customerJsonData) {
        try {
          const reps = JSON.parse(customerJsonData);
          if (Array.isArray(reps)) {
            reps.forEach(r => {
              const email = r.email ? r.email.trim().toLowerCase() : '';
              if (email.includes('@')) toRecipientsSet.add(email);
            });
          }
        } catch { }
      }
    }
  }

  if (toRecipientsSet.size === 0) {
    const noRecipError = `Không tìm thấy email người nhận hợp lệ (Mục đích: ${matchedTemplate.Purpose}, Cách cấu hình: ${recipientEmailSetting || 'Tự động tra cứu'})`;
    // Ghi log thất bại
    await pool.request()
      .input('TemplateId', sql.Int, matchedTemplate.Id)
      .input('ProjectId', sql.NVarChar(100), project.Project_id)
      .input('Status', sql.NVarChar(50), 'Failed')
      .input('ErrorMessage', sql.NVarChar(sql.MAX), noRecipError)
      .execute('usp_InsertEmailCampaignLog');
    throw new Error(noRecipError);
  }

  const toRecipients = Array.from(toRecipientsSet).map(email => ({
    emailAddress: {
      address: email,
      name: recipientName || project.CustomerName || ''
    }
  }));

  // 5. Thay thế placeholder
  const concatDestinations = [...new Set(projectTasks.map(t => t.Destination).filter(Boolean))].join(', ');
  const dateStrings = projectTasks
    .map(t => t.OnboardDate)
    .filter(Boolean)
    .map(d => {
      const dObj = new Date(d);
      return String(dObj.getDate()).padStart(2, '0') + '/' + String(dObj.getMonth() + 1).padStart(2, '0') + '/' + dObj.getFullYear();
    });
  const concatDates = [...new Set(dateStrings)].join(', ');

  // Bảng Lịch Agenda HTML
  const agendaRows = projectTasks
    .filter(t => t.OnboardDate)
    .map(t => {
      const d = new Date(t.OnboardDate);
      const dateStr = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
      const pickupTime = t.MeetingStartTime ? String(t.MeetingStartTime).slice(0, 5) : '';
      const dest = t.Destination || '';
      const meal = t.MealOption || '';
      return '<tr>' +
        '<td style="border:1px solid #e5e7eb;padding:8px 12px;white-space:nowrap">' + dateStr + '</td>' +
        '<td style="border:1px solid #e5e7eb;padding:8px 12px">' + dest + '</td>' +
        '<td style="border:1px solid #e5e7eb;padding:8px 12px;white-space:nowrap">' + pickupTime + '</td>' +
        '<td style="border:1px solid #e5e7eb;padding:8px 12px">' + meal + '</td>' +
        '</tr>';
    }).join('');

  const agendaTable =
    '<table style="border-collapse:collapse;width:100%;font-size:13px;font-family:Segoe UI,sans-serif">' +
    '<thead><tr style="background:#f3f4f6">' +
    '<th style="border:1px solid #e5e7eb;padding:8px 12px;text-align:left">Onboard Date</th>' +
    '<th style="border:1px solid #e5e7eb;padding:8px 12px;text-align:left">Destination</th>' +
    '<th style="border:1px solid #e5e7eb;padding:8px 12px;text-align:left">Pick-up Time</th>' +
    '<th style="border:1px solid #e5e7eb;padding:8px 12px;text-align:left">Restaurant</th>' +
    '</tr></thead>' +
    '<tbody>' + agendaRows + '</tbody></table>';

  let finalSubject = matchedTemplate.EmailSubject || '';
  let finalBody = matchedTemplate.EmailBody || '';

  const placeholders = {
    '{{CustomerName}}': project.CustomerName || '',
    '{{Tên Khách Hàng}}': project.CustomerName || '',
    '{{Khách Hàng}}': project.CustomerName || '',
    '{{MeetingTopic}}': project.MeetingTopic || '',
    '{{Chủ Đề Tiếp Đón}}': project.MeetingTopic || '',
    '{{OnboardDate}}': concatDates,
    '{{Ngày Tiếp Đón}}': concatDates,
    '{{SubmitterName}}': project.SubmitterName || '',
    '{{Người Lập Phiếu}}': project.SubmitterName || '',
    '{{Người Gửi}}': project.SubmitterName || '',
    '{{Địa Điểm Tiếp Đón}}': concatDestinations,
    '{{Lịch Agenda}}': agendaTable
  };

  Object.entries(placeholders).forEach(([tag, val]) => {
    finalSubject = finalSubject.split(tag).join(val);
    finalBody = finalBody.split(tag).join(val);
  });

  finalSubject = sanitizeEmailSubject(finalSubject);
  finalBody = await processBodyImages(finalBody, pool);

  // 6. Gửi Graph API
  const accessToken = await getAccessToken();
  const finalSenderEmail = (matchedTemplate.SenderEmail && matchedTemplate.SenderEmail.trim()) || defaultSenderEmail;
  const url = `https://graph.microsoft.com/v1.0/users/${finalSenderEmail}/sendMail`;
  const mailPayload = {
    message: {
      subject: finalSubject,
      body: {
        contentType: 'HTML',
        content: finalBody
      },
      toRecipients
    },
    saveToSentItems: 'true'
  };

  try {
    await axios.post(url, mailPayload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    // Ghi log thành công
    await pool.request()
      .input('TemplateId', sql.Int, matchedTemplate.Id)
      .input('ProjectId', sql.NVarChar(100), project.Project_id)
      .input('Status', sql.NVarChar(50), 'Success')
      .execute('usp_InsertEmailCampaignLog');

    return {
      success: true,
      message: `Đã gửi thành công email chiến dịch "${matchedTemplate.TemplateName}" tới ${Array.from(toRecipientsSet).join(', ')}`
    };
  } catch (err) {
    const errorMsg = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    // Ghi log thất bại
    await pool.request()
      .input('TemplateId', sql.Int, matchedTemplate.Id)
      .input('ProjectId', sql.NVarChar(100), project.Project_id)
      .input('Status', sql.NVarChar(50), 'Failed')
      .input('ErrorMessage', sql.NVarChar(sql.MAX), errorMsg)
      .execute('usp_InsertEmailCampaignLog');

    throw new Error(`Graph API Error: ${errorMsg}`);
  }
}

/**
 * Làm sạch tiêu đề email: loại bỏ tất cả thẻ HTML và decode các thực thể HTML (HTML entities)
 */
function sanitizeEmailSubject(subjectStr) {
  if (!subjectStr) return '';
  return String(subjectStr)
    .replace(/<[^>]*>?/gm, '')     // Strip all HTML tags
    .replace(/&nbsp;/gi, ' ')      // Non-breaking space entity
    .replace(/&#160;/g, ' ')       // Non-breaking space numeric
    .replace(/&#8203;/g, '')       // Zero-width space numeric
    .replace(/\u200B/g, '')        // Zero-width space unicode
    .replace(/&amp;/gi, '&')       // Ampersand
    .replace(/&lt;/gi, '<')        // Less than
    .replace(/&gt;/gi, '>')        // Greater than
    .replace(/&quot;/gi, '"')      // Double quote
    .replace(/&#39;/gi, "'")       // Single quote
    .replace(/&#x200B;/gi, '')     // Zero-width space hex
    .replace(/\s+/g, ' ')          // Collapse whitespace
    .trim();
}

/**
 * Xử lý hình ảnh trong nội dung Email:
 * Tự động chuyển đổi các thẻ <img src="..."> tương đối (/api/files/:id, /uploads/...)
 * thành dạng Base64 Data URI (data:image/...;base64,...) để đảm bảo
 * ứng dụng Email (Outlook, Gmail...) luôn tải và hiển thị hình ảnh 100% thành công.
 */
async function processBodyImages(htmlBody, pool) {
  if (!htmlBody) return '';

  const imgRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let match;
  let processedHtml = htmlBody;
  const srcMatches = [];

  while ((match = imgRegex.exec(htmlBody)) !== null) {
    srcMatches.push(match[1]);
  }

  if (srcMatches.length === 0) return htmlBody;

  const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
  const frontendUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');

  for (const src of srcMatches) {
    try {
      // Skip already-inlined data URIs
      if (src.startsWith('data:image/')) continue;

      // 1. Check if src matches /api/files/:id (relative or absolute URL)
      const fileIdMatch = src.match(/\/api\/files\/(\d+)/i);
      if (fileIdMatch) {
        const fileId = parseInt(fileIdMatch[1]);
        if (pool) {
          try {
            const fileRes = await pool.request()
              .input('Id', sql.Int, fileId)
              .execute('usp_GetUploadedFileById');

            const fileRec = fileRes.recordset?.[0];
            if (fileRec && fileRec.file_path) {
              // Resolve path to handle relative/absolute correctly on Windows
              const resolvedPath = path.resolve(fileRec.file_path);
              if (fs.existsSync(resolvedPath)) {
                const fileBuf = fs.readFileSync(resolvedPath);
                const base64Data = fileBuf.toString('base64');
                const mime = fileRec.mime_type || 'image/jpeg';
                const dataUri = `data:${mime};base64,${base64Data}`;
                processedHtml = processedHtml.split(src).join(dataUri);
                console.log(`[Campaign Image] ✅ Converted /api/files/${fileId} to inline Base64 (${fileBuf.length} bytes).`);
                continue;
              } else {
                console.warn(`[Campaign Image] ⚠️ File DB record found for ID ${fileId} but physical file missing at: ${resolvedPath}`);
              }
            } else {
              console.warn(`[Campaign Image] ⚠️ No DB record found for file ID ${fileId}`);
            }
          } catch (dbErr) {
            console.error(`[Campaign Image] ❌ DB error looking up file ID ${fileId}:`, dbErr.message);
          }
        }

        // Fallback: If base64 failed, replace with public-facing URL using FRONTEND_URL
        if (frontendUrl && !src.startsWith('http')) {
          const publicUrl = `${frontendUrl}/api/files/${fileIdMatch[1]}`;
          processedHtml = processedHtml.split(src).join(publicUrl);
          console.log(`[Campaign Image] 🔗 Fallback: replaced relative /api/files/${fileIdMatch[1]} with public URL: ${publicUrl}`);
        }
        continue;
      }

      // 2. Check if src contains /uploads/
      const uploadsMatch = src.match(/\/uploads\/(.+)/i);
      if (uploadsMatch) {
        const relPath = uploadsMatch[1];
        const fullPath = path.resolve(path.join(uploadDir, relPath));
        if (fs.existsSync(fullPath)) {
          const fileBuf = fs.readFileSync(fullPath);
          const base64Data = fileBuf.toString('base64');
          const ext = path.extname(fullPath).toLowerCase();
          const mime = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
          const dataUri = `data:${mime};base64,${base64Data}`;
          processedHtml = processedHtml.split(src).join(dataUri);
          console.log(`[Campaign Image] ✅ Converted /uploads/${relPath} to inline Base64 (${fileBuf.length} bytes).`);
          continue;
        } else {
          console.warn(`[Campaign Image] ⚠️ Upload file not found at: ${fullPath}`);
        }
      }

      // 3. If relative path or localhost URL, replace with FRONTEND_URL
      if (frontendUrl && (src.startsWith('/') || src.includes('localhost') || src.includes('127.0.0.1'))) {
        let cleanSrc = src;
        if (src.startsWith('http://localhost') || src.startsWith('http://127.0.0.1')) {
          try {
            const urlObj = new URL(src);
            cleanSrc = urlObj.pathname + urlObj.search;
          } catch {}
        }
        const fullUrl = `${frontendUrl}${cleanSrc.startsWith('/') ? '' : '/'}${cleanSrc}`;
        processedHtml = processedHtml.split(src).join(fullUrl);
        console.log(`[Campaign Image] 🔗 Replaced relative/localhost src with public URL: ${fullUrl}`);
      }

      // 4. External HTTPS URLs — leave as-is (already accessible by email clients)
      if (src.startsWith('https://') || src.startsWith('http://')) {
        console.log(`[Campaign Image] ℹ️ External image URL kept as-is: ${src.substring(0, 80)}...`);
      }
    } catch (err) {
      console.error(`[Campaign Image] ❌ Error processing image src "${src}":`, err.message);
    }
  }

  return processedHtml;
}

module.exports = {
  startCampaignScheduler,
  processCampaigns,
  sendSingleCampaignEmail,
  sanitizeEmailSubject,
  processBodyImages
};