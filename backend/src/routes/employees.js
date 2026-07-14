// src/routes/employees.js — Thin proxy: gọi usp_SearchEmployees + usp_SyncEmployees
const express   = require('express');
const router    = express.Router();
const { exec }  = require('child_process');
const path      = require('path');
const { getCsrPool, sql } = require('../config/database');

const SYNC_SCRIPT = path.join(__dirname, '../../scripts/sync_employees.py');
let isSyncing = false; // Tránh chạy 2 sync cùng lúc

/**
 * GET /api/employees?q=...
 * Tìm kiếm nhân viên cho autocomplete
 */
router.get('/', async (req, res, next) => {
  try {
    const { q = '' } = req.query;
    const pool = await getCsrPool();
    const result = await pool.request()
      .input('Query', sql.NVarChar(200), q.trim())
      .input('TopN',  sql.Int,           q.trim() ? 20 : 200)
      .execute('usp_SearchEmployees');
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/employees/sync-status
 * Trạng thái đồng bộ: lần sync gần nhất, số nhân viên, ngày file Excel
 */
router.get('/sync-status', async (req, res, next) => {
  try {
    const pool = await getCsrPool();
    const result = await pool.request().execute('usp_GetSyncStatus');
    const row = result.recordset?.[0];
    res.json({
      success: true,
      data: row
        ? {
            employeeCount:  row.EmployeeCount,
            rowsAffected:   row.RowsAffected,
            fileModifiedAt: row.FileModifiedAt,
            lastSyncAt:     row.LastSyncAt,
            status:         row.Status,
            message:        row.Message,
          }
        : { employeeCount: 0, lastSyncAt: null, message: 'Chưa đồng bộ lần nào' },
      isSyncing,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/employees/sync
 * Kích hoạt đồng bộ nhân viên từ file Excel \\10.0.0.214\...
 * Gọi Python script sync_employees.py
 */
router.post('/sync', async (req, res, next) => {
  if (isSyncing) {
    return res.status(409).json({
      success: false,
      error: 'Đang có tiến trình đồng bộ, vui lòng chờ...',
    });
  }

  isSyncing = true;
  const force = req.body?.force === true;
  const args  = force ? '--force' : '';
  const pythonPath = process.env.PYTHON_PATH || 'python';
  const cmd   = `"${pythonPath}" "${SYNC_SCRIPT}" ${args}`;

  console.log(`▶ Sync employees: ${cmd}`);

  exec(cmd, { timeout: 60000, encoding: 'utf8' }, async (error, stdout, stderr) => {
    isSyncing = false;

    // Nếu stdout có dữ liệu JSON trả về (kể cả khi exit code !== 0)
    if (stdout && stdout.trim()) {
      try {
        const result = JSON.parse(stdout.trim());
        if (!result.success) {
          console.error('❌ Sync script failed:', result.error);
          return res.status(500).json({ success: false, error: result.error });
        }
        console.log(`✅ Sync done: ${result.rowsAffected} employees`);

        // Tự động tạo tài khoản (User) cho các nhân viên mới được thêm vào từ Excel
        const newEmployees = result.newEmployees || [];
        if (newEmployees.length > 0) {
          const bcrypt = require('bcryptjs');
          const pool = await getCsrPool();
          
          for (const emp of newEmployees) {
            try {
              // Kiểm tra xem User đã tồn tại theo MNV hay chưa (để tránh lỗi trùng lặp)
              const checkUser = await pool.request()
                .input('MNV_Check', sql.NVarChar(50), emp.MNV)
                .query('SELECT UserId FROM [dbo].[CSR_Users] WHERE MNV = @MNV_Check');
              
              if (checkUser.recordset.length === 0) {
                // Sử dụng chính MNV làm mật khẩu mặc định ban đầu
                const defaultPassword = emp.MNV;
                const passwordHash = await bcrypt.hash(defaultPassword, 10);
                
                await pool.request()
                  .input('UserId', sql.Int, 0)
                  .input('MNV', sql.NVarChar(50), emp.MNV)
                  .input('FullName', sql.NVarChar(200), emp.FullName)
                  .input('Email', sql.NVarChar(200), emp.Email || '')
                  .input('Role', sql.NVarChar(50), 'User')
                  .input('IsActive', sql.Bit, 1)
                  .input('PasswordHash', sql.NVarChar(255), passwordHash)
                  .execute('[dbo].[usp_UpsertUser]');
                
                console.log(`[Auto User Sync] Created user account for MNV: ${emp.MNV}`);
              }
            } catch (userErr) {
              console.error(`[Auto User Sync] Failed to create user for ${emp.MNV}:`, userErr.message);
            }
          }
        }

        return res.json({ success: true, data: result });
      } catch (e) {
        console.error('Error parsing sync script output or creating users:', e);
        // stdout không phải JSON hợp lệ, tiếp tục xử lý lỗi tiêu chuẩn bên dưới
      }
    }

    if (error) {
      console.error('❌ Sync error:', stderr || error.message);
      return res.status(500).json({
        success: false,
        error: stderr?.trim() || error.message,
      });
    }

    res.status(500).json({ success: false, error: 'Unknown sync error' });
  });
});

module.exports = router;

