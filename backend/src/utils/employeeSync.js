// src/utils/employeeSync.js
// Đồng bộ direct supervisor email từ SharePoint list Quản Lý Nhân Sự về SQL Server
const axios = require('axios');
const { getAccessToken } = require('../config/sharepoint');
const { getCsrPool, sql } = require('../config/database');

/**
 * Helper lấy Site ID của SharePoint site từ SHARE_URL
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
 * Đồng bộ email người quản lý trực tiếp từ SharePoint list Quản Lý Nhân Sự vào bảng CSR_Employees
 */
async function syncSupervisorEmails() {
  console.log('[Employee Supervisor Sync] 🔄 Starting supervisor emails synchronization...');
  try {
    const accessToken = await getAccessToken();
    const pool = await getCsrPool();

    // Sử dụng cấu hình từ env hoặc mặc định đã tìm thấy
    const siteId = process.env.SHAREPOINT_HR_SITE_ID || 'vietsunco.sharepoint.com,8011111f-dfb1-42c6-9271-0ad13af02e6c,bb18fe33-9bce-4273-9aff-20c19305f669';
    const listId = process.env.SHAREPOINT_HR_LIST_ID || 'c42012d2-ef37-480e-a363-13244597284b';

    let url = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items?$expand=fields&$top=1000`;
    let allItems = [];

    while (url) {
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000
      });
      if (res.data && res.data.value) {
        allItems = allItems.concat(res.data.value);
      }
      url = res.data['@odata.nextLink'] || null;
    }

    console.log(`[Employee Supervisor Sync] Found ${allItems.length} records in SharePoint list.`);

    const updates = [];
    for (const item of allItems) {
      const fields = item.fields;
      if (!fields) continue;

      const mnv = String(fields.MNV || '').trim();
      const managerEmail = String(fields.LineManagerEmailText || '').trim().toLowerCase();

      if (mnv && managerEmail && managerEmail !== '0' && managerEmail.includes('@')) {
        updates.push({ mnv, managerEmail });
      }
    }

    if (updates.length === 0) {
      console.log('[Employee Supervisor Sync] No valid manager email entries to update.');
      return { success: true, count: 0 };
    }

    console.log(`[Employee Supervisor Sync] Updating ${updates.length} employee manager email entries in SQL Server...`);

    const jsonPayload = JSON.stringify(updates);
    await pool.request()
      .input('SupervisorEmailsJson', sql.NVarChar(sql.MAX), jsonPayload)
      .execute('usp_Employee_UpdateSupervisorEmails');

    console.log('[Employee Supervisor Sync] ✅ Successfully synchronized direct supervisor emails.');
    return { success: true, count: updates.length };
  } catch (err) {
    console.error('[Employee Supervisor Sync] ❌ Failed to synchronize direct supervisor emails:', err.message);
    throw err;
  }
}

module.exports = { syncSupervisorEmails };
