const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { getCsrPool, sql } = require('../config/database');

const LOG_FILE_PATH = path.join(__dirname, '../../uploads/cloud_sync_log.json');

// Đảm bảo thư mục uploads tồn tại
const ensureUploadsDir = () => {
  const dir = path.dirname(LOG_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Ghi log đồng bộ
const writeSyncLog = (status, syncedCount, message) => {
  try {
    ensureUploadsDir();
    const logData = {
      lastSyncTime: new Date().toISOString(),
      status,
      syncedCount,
      message
    };
    fs.writeFileSync(LOG_FILE_PATH, JSON.stringify(logData, null, 2), 'utf8');
  } catch (err) {
    console.error('[Cloud Sync] Failed to write sync log:', err.message);
  }
};

// Đọc log đồng bộ
const getSyncLog = () => {
  try {
    if (fs.existsSync(LOG_FILE_PATH)) {
      return JSON.parse(fs.readFileSync(LOG_FILE_PATH, 'utf8'));
    }
  } catch (e) {}
  return {
    lastSyncTime: null,
    status: 'Idle',
    syncedCount: 0,
    message: 'Chưa chạy đồng bộ lần nào.'
  };
};

/**
 * Hàm kích hoạt đồng bộ hóa dữ liệu từ Cloud
 */
async function triggerCloudSync() {
  const syncEnabled = process.env.CLOUD_SYNC_ENABLED === 'true';
  const cloudUrl = process.env.CLOUD_API_URL;
  const cloudKey = process.env.CLOUD_API_KEY;

  if (!syncEnabled || !cloudUrl) {
    const msg = 'Tính năng đồng bộ Cloud chưa kích hoạt hoặc thiếu CLOUD_API_URL.';
    writeSyncLog('Disabled', 0, msg);
    return { success: false, error: msg, log: getSyncLog() };
  }

  console.log('[Cloud Sync] 🔄 Starting cloud feedback synchronization...');
  try {
    const pool = await getCsrPool();

    // 1. Fetch dữ liệu pending từ Cloud API
    const response = await axios.get(`${cloudUrl}/pending`, {
      headers: {
        'x-api-key': cloudKey || '',
        'Authorization': `Bearer ${cloudKey || ''}`
      },
      timeout: 15000
    });

    const pendingFeedbacks = response.data || [];
    if (!Array.isArray(pendingFeedbacks) || pendingFeedbacks.length === 0) {
      console.log('[Cloud Sync] ℹ️ No pending feedbacks found on Cloud.');
      writeSyncLog('Success', 0, 'Không có phản hồi mới cần đồng bộ.');
      return { success: true, message: 'Đồng bộ hoàn thành. Không có dữ liệu mới.', log: getSyncLog() };
    }

    console.log(`[Cloud Sync] Found ${pendingFeedbacks.length} new feedback(s) to sync.`);

    // 2. Tải toàn bộ tiêu chí đánh giá từ database nội bộ để làm từ điển đối chiếu theo tên
    const criteriaRes = await pool.request()
      .query('SELECT Id, CriteriaName FROM [dbo].[CSR_ReviewCriteria] WHERE IsActive = 1');
    const criteriaMap = {};
    criteriaRes.recordset.forEach(c => {
      criteriaMap[c.CriteriaName.toLowerCase().trim()] = c.Id;
    });

    let successfullySyncedCount = 0;
    const syncedCloudIds = [];

    // 3. Import từng feedback vào DB nội bộ
    for (const fb of pendingFeedbacks) {
      try {
        const { id, projectId, reviewerName, reviews = [] } = fb;

        if (!projectId || !Array.isArray(reviews) || reviews.length === 0) {
          console.warn(`[Cloud Sync] ⚠️ Skip invalid feedback record: ${id || 'no-id'}`);
          continue;
        }

        // Map feedback sang định dạng local criteriaId
        const localReviews = [];
        reviews.forEach(r => {
          const nameClean = (r.criteriaName || '').toLowerCase().trim();
          const matchedId = criteriaMap[nameClean];
          if (matchedId) {
            localReviews.push({
              criteriaId: matchedId,
              rating: parseInt(r.rating) || 5,
              comment: r.comment || ''
            });
          } else {
            console.warn(`[Cloud Sync] ⚠️ Unknown criteria name: "${r.criteriaName}" for project ${projectId}. Skip item.`);
          }
        });

        if (localReviews.length > 0) {
          // Lưu vào database qua usp_SubmitReviews
          await pool.request()
            .input('ProjectId', sql.NVarChar(100), projectId)
            .input('ReviewerName', sql.NVarChar(200), reviewerName || null)
            .input('ReviewsJson', sql.NVarChar(sql.MAX), JSON.stringify(localReviews))
            .execute('usp_SubmitReviews');

          successfullySyncedCount++;
          if (id) {
            syncedCloudIds.push(id);
          }
        }
      } catch (err) {
        console.error(`[Cloud Sync] ❌ Failed to import cloud feedback ${fb.id || 'N/A'}:`, err.message);
      }
    }

    // 4. Báo ngược lại cho Cloud API là đã đồng bộ thành công các ID này
    if (syncedCloudIds.length > 0) {
      try {
        await axios.post(`${cloudUrl}/mark-synced`, {
          ids: syncedCloudIds
        }, {
          headers: {
            'x-api-key': cloudKey || '',
            'Authorization': `Bearer ${cloudKey || ''}`
          },
          timeout: 10000
        });
        console.log(`[Cloud Sync] ✅ Marked ${syncedCloudIds.length} feedback(s) as synced on Cloud.`);
      } catch (postErr) {
        console.error('[Cloud Sync] ❌ Failed to post back synced IDs to Cloud API:', postErr.message);
        writeSyncLog('Warning', successfullySyncedCount, `Đã import ${successfullySyncedCount} đánh giá nhưng lỗi báo nhận về Cloud: ${postErr.message}`);
        return { success: true, message: `Import thành công nhưng lỗi phản hồi Cloud: ${postErr.message}`, log: getSyncLog() };
      }
    }

    const finalMsg = `Đồng bộ thành công ${successfullySyncedCount} phản hồi mới từ Cloud database.`;
    writeSyncLog('Success', successfullySyncedCount, finalMsg);
    console.log(`[Cloud Sync] ${finalMsg}`);

    return { success: true, message: finalMsg, log: getSyncLog() };

  } catch (err) {
    const errMsg = `Đồng bộ thất bại: ${err.message}`;
    writeSyncLog('Error', 0, errMsg);
    console.error('[Cloud Sync] ❌ Error during cloud sync:', err.message);
    return { success: false, error: errMsg, log: getSyncLog() };
  }
}

/**
 * Đăng ký cron job tự động đồng bộ mỗi 5 phút
 */
function startCloudSyncScheduler() {
  const syncEnabled = process.env.CLOUD_SYNC_ENABLED === 'true';
  if (!syncEnabled) {
    console.log('[Cloud Sync] ℹ️ Cloud synchronizer scheduler is disabled in environment.');
    return;
  }

  console.log('[Cloud Sync] ⏰ Cloud synchronizer registered. Running every 5 minutes.');
  
  // Chạy lần đầu tiên sau khi khởi động server 30 giây
  setTimeout(() => {
    triggerCloudSync().catch(() => {});
  }, 30000);

  // Chạy lặp lại mỗi 5 phút (300.000 ms)
  setInterval(() => {
    triggerCloudSync().catch(() => {});
  }, 300000);
}

/**
 * Đẩy cấu hình tiêu chí của 1 biểu mẫu lên Cloud
 */
async function pushCriteriaToCloud(formId) {
  const syncEnabled = process.env.CLOUD_SYNC_ENABLED === 'true';
  const cloudUrl = process.env.CLOUD_API_URL;
  const cloudKey = process.env.CLOUD_API_KEY;

  if (!syncEnabled || !cloudUrl) {
    console.log('[Cloud Sync] ℹ️ Cloud sync disabled or CLOUD_API_URL missing. Skipping criteria push.');
    return { success: false, error: 'Cloud sync is disabled.' };
  }

  console.log(`[Cloud Sync] 📤 Pushing criteria config for Form ID \${formId} to cloud...`);
  try {
    const pool = await getCsrPool();

    // 1. Lấy thông tin form
    const formRes = await pool.request()
      .input('Id', sql.Int, parseInt(formId))
      .query('SELECT * FROM [dbo].[CSR_EvaluationForms] WHERE Id = @Id');

    const form = formRes.recordset?.[0];
    if (!form) {
      console.warn(`[Cloud Sync] ⚠️ Form ID \${formId} not found in DB. Cannot push.`);
      return { success: false, error: 'Form not found.' };
    }

    // 2. Lấy tiêu chí đang hoạt động thuộc form này
    const criteriaRes = await pool.request()
      .input('FormId', sql.Int, parseInt(formId))
      .query('SELECT * FROM [dbo].[CSR_ReviewCriteria] WHERE FormId = @FormId AND IsActive = 1 ORDER BY SortOrder ASC');

    const criteria = (criteriaRes.recordset || []).map(c => ({
      name: c.CriteriaName,
      group: c.CriteriaGroup || 'Tổng hợp',
      description: c.Description || '',
      sortOrder: c.SortOrder || 0,
      isRequired: !!c.IsRequired
    }));

    // 3. Chuẩn bị payload gửi lên Cloud
    const payload = {
      formId: form.Id,
      formName: form.FormName,
      sendToCustomer: !!form.SendToCustomer,
      sendToPrd: !!form.SendToPrd,
      sendToSubmitter: !!form.SendToSubmitter,
      sendToBod: !!form.SendToBod,
      isActive: !!form.IsActive,
      criteria
    };

    // 4. Gửi HTTP POST tới Cloud API
    const response = await axios.post(`\${cloudUrl}/criteria`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cloudKey || '',
        'Authorization': `Bearer \${cloudKey || ''}`
      },
      timeout: 10000
    });

    console.log(`[Cloud Sync] ✅ Successfully pushed Form ID \${formId} to Cloud:`, response.data);
    return { success: true, data: response.data };

  } catch (err) {
    console.error(`[Cloud Sync] ❌ Failed to push criteria config for Form ID \${formId}:`, err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  startCloudSyncScheduler,
  triggerCloudSync,
  getSyncLog,
  pushCriteriaToCloud
};
