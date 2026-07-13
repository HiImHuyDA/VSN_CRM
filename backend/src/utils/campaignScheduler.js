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
      .query(`
        WITH EarliestOnboard AS (
            SELECT Project_id, MIN(OnboardDate) as MinOnboardDate
            FROM CSR_Tasks
            WHERE StatusId = 1
            GROUP BY Project_id
        )
        SELECT p.Project_id, p.CustomerName, p.CustomerType, p.SubmitterName, p.SubmitterEmail, p.MeetingTopic, p.GuestReps, eo.MinOnboardDate
        FROM CSR_Projects p
        JOIN EarliestOnboard eo ON p.Project_id = eo.Project_id
        WHERE p.StatusId IN (5, 7)
          AND eo.MinOnboardDate = @TargetDate
      `);

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
      .query(`
        SELECT * FROM CSR_EmailCampaignTemplates
        WHERE IsActive = 1
          AND Purpose IN (N'Chào đón khách', N'Mời sự kiện')
          AND (StartDate IS NULL OR StartDate <= @Today)
          AND (EndDate IS NULL OR EndDate >= @Today)
      `);

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
          .query('SELECT 1 FROM CSR_EmailCampaignLogs WHERE ProjectId = @ProjectId AND Status = \'Success\'');

        if (logCheck.recordset.length > 0) {
          console.log(`[Campaign Scheduler] ℹ️ Campaign already successfully sent for project ${project.Project_id}. Skipping.`);
          continue;
        }

        // Lấy danh sách nhiệm vụ của đơn để kiểm tra địa điểm và ngày tiếp đón
        const tasksRes = await pool.request()
          .input('ProjectId', sql.NVarChar(100), project.Project_id)
          .query('SELECT Destination, OnboardDate FROM CSR_Tasks WHERE Project_id = @ProjectId AND StatusId = 1 ORDER BY OnboardDate ASC');
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
                .query('SELECT JsonData, Email FROM CSR_ConfigLists WHERE Category = @Category AND Name = @Name AND StatusId = 1');

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
              .query('SELECT JsonData FROM CSR_ConfigLists WHERE Category = @Category AND Name = @Name AND StatusId = 1');

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
            return `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}/${dObj.getFullYear()}`;
          });
        const concatDates = [...new Set(dateStrings)].join(', ');

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

          '{{Địa Điểm Tiếp Đón}}': concatDestinations
        };

        // Thực hiện replace
        Object.entries(placeholders).forEach(([tag, val]) => {
          finalSubject = finalSubject.split(tag).join(val);
          finalBody = finalBody.split(tag).join(val);
        });

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
    .query(`
      SELECT Project_id, CustomerName, CustomerType, SubmitterName, SubmitterEmail, MeetingTopic, GuestReps, Status
      FROM CSR_Projects
      WHERE Project_id = @ProjectId
    `);

  const project = projectRes.recordset?.[0];
  if (!project) {
    throw new Error(`Không tìm thấy đơn tiếp đón với ID: ${projectId}`);
  }

  // Lấy các nhiệm vụ của đơn để có Destination và OnboardDate
  const tasksRes = await pool.request()
    .input('ProjectId', sql.NVarChar(100), projectId)
    .query('SELECT Destination, OnboardDate FROM CSR_Tasks WHERE Project_id = @ProjectId AND StatusId = 1 ORDER BY OnboardDate ASC');
  const projectTasks = tasksRes.recordset || [];
  const projectDestinations = projectTasks.map(t => t.Destination).filter(Boolean);

  // 2. Tìm template
  let matchedTemplate = null;

  if (templateId) {
    // Nếu có truyền templateId cụ thể, lấy đúng template đó
    const tempRes = await pool.request()
      .input('TemplateId', sql.Int, parseInt(templateId))
      .query('SELECT * FROM CSR_EmailCampaignTemplates WHERE Id = @TemplateId');
    matchedTemplate = tempRes.recordset?.[0];
    if (!matchedTemplate) {
      throw new Error(`Không tìm thấy mẫu email với ID: ${templateId}`);
    }
  } else {
    // Tự động tìm template phù hợp nhất
    const todayStr = new Date().toISOString().split('T')[0];
    const templatesRes = await pool.request()
      .input('Today', sql.Date, todayStr)
      .query(`
        SELECT * FROM CSR_EmailCampaignTemplates
        WHERE IsActive = 1
          AND Purpose IN (N'Chào đón khách', N'Mời sự kiện')
          AND (StartDate IS NULL OR StartDate <= @Today)
          AND (EndDate IS NULL OR EndDate >= @Today)
      `);
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
          .query('SELECT JsonData, Email FROM CSR_ConfigLists WHERE Category = @Category AND Name = @Name AND StatusId = 1');

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
        .query('SELECT JsonData FROM CSR_ConfigLists WHERE Category = @Category AND Name = @Name AND StatusId = 1');

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
      return `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}/${dObj.getFullYear()}`;
    });
  const concatDates = [...new Set(dateStrings)].join(', ');

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
    '{{Địa Điểm Tiếp Đón}}': concatDestinations
  };

  Object.entries(placeholders).forEach(([tag, val]) => {
    finalSubject = finalSubject.split(tag).join(val);
    finalBody = finalBody.split(tag).join(val);
  });

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

module.exports = {
  startCampaignScheduler,
  processCampaigns,
  sendSingleCampaignEmail
};