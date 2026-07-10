const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
router.use(authenticateToken);
const authorizeRoles = require('../middleware/authorize');
router.use(authorizeRoles('Admin'));

const bcrypt = require('bcrypt');
const { getCsrPool, sql } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const pool = await getCsrPool();
    const result = await pool.request().execute('[dbo].[usp_GetAllUsers]');
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách tài khoản' });
  }
});

// Thêm API Tạo tài khoản mới
router.post('/', async (req, res) => {
  const { MNV, Password, FullName, Email, Role, Department, IsActive } = req.body;
  if (!MNV || !FullName) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ thông tin bắt buộc' });
  }
  try {
    // Nếu Admin không nhập mật khẩu, mặc định dùng chính MNV làm mật khẩu ban đầu
    const pwdToUse = (Password && String(Password).trim()) || MNV;
    const PasswordHash = await bcrypt.hash(pwdToUse, 10);
    const pool = await getCsrPool();
    await pool.request()
      .input('UserId', sql.Int, 0)
      .input('MNV', sql.NVarChar(50), MNV)
      .input('FullName', sql.NVarChar(200), FullName)
      .input('Email', sql.NVarChar(200), Email || '')
      .input('Role', sql.NVarChar(50), Role)
      .input('IsActive', sql.Bit, IsActive)
      .input('PasswordHash', sql.NVarChar(255), PasswordHash)
      .execute('[dbo].[usp_UpsertUser]');

    // Nếu có department, cần upsert vào CSR_Employees (vì Department nằm ở CSR_Employees)
    if (Department) {
      const empJson = JSON.stringify([{
        fullName: FullName,
        email: Email || '',
        mnv: MNV,
        department: Department
      }]);
      await pool.request()
        .input('EmployeesJson', sql.NVarChar(sql.MAX), empJson)
        .input('FileModifiedAt', sql.DateTime, new Date())
        .execute('[dbo].[usp_SyncEmployees]');
    }

    res.json({ success: true, message: 'Tạo tài khoản thành công' });
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi tạo tài khoản' });
  }
});

// Cập nhật Role và IsActive
router.put('/:userId', async (req, res) => {
  const { userId } = req.params;
  const { MNV, FullName, Email, Role, IsActive } = req.body;
  try {
    const pool = await getCsrPool();
    await pool.request()
      .input('UserId', sql.Int, userId)
      .input('MNV', sql.NVarChar(50), MNV)
      .input('FullName', sql.NVarChar(200), FullName)
      .input('Email', sql.NVarChar(200), Email || '')
      .input('Role', sql.NVarChar(50), Role)
      .input('IsActive', sql.Bit, IsActive)
      .input('PasswordHash', sql.NVarChar(255), null)
      .execute('[dbo].[usp_UpsertUser]');
    res.json({ success: true, message: 'Cập nhật thành công' });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật tài khoản' });
  }
});

// Reset password về mặc định (= MNV của tài khoản đó)
router.post('/:mnv/reset-password', async (req, res) => {
  const { mnv } = req.params;
  try {
    const PasswordHash = await bcrypt.hash(mnv, 10);
    const pool = await getCsrPool();
    await pool.request()
      .input('MNV', sql.NVarChar(50), mnv)
      .input('NewPasswordHash', sql.NVarChar(255), PasswordHash)
      .execute('[dbo].[usp_ChangePassword]');
    res.json({ success: true, message: 'Đã reset mật khẩu thành công' });
  } catch (err) {
    console.error('Error resetting password:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi reset mật khẩu' });
  }
});

// POST /api/users/batch — batch create or update users from Excel import
router.post('/batch', async (req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ success: false, message: 'Không có dữ liệu' });
  }

  const pool = await getCsrPool();
  let inserted = 0;
  const errors = [];

  for (const row of rows) {
    const mnv = String(row.mnv || '').trim();
    const fullName = String(row.fullName || '').trim();
    const email = String(row.email || '').trim();
    const role = String(row.role || 'User').trim();
    const department = String(row.department || '').trim();
    const password = String(row.password || '').trim();

    if (!mnv || !fullName) {
      errors.push(`Bỏ qua dòng thiếu MNV hoặc Họ tên: ${mnv || '(trống)'}`);
      continue;
    }

    // Mật khẩu mặc định cho tài khoản mới = chính MNV của người đó (nếu Excel không có cột password riêng)
    const defaultPassword = mnv;

    try {
      // Kiểm tra xem User đã tồn tại theo MNV hay chưa
      const existingUserRes = await pool.request()
        .input('MNV_Check', sql.NVarChar(50), mnv)
        .query('SELECT UserId FROM [dbo].[CSR_Users] WHERE MNV = @MNV_Check');
      const existingUser = existingUserRes.recordset[0];

      let targetUserId = 0;
      let finalPasswordHash = null;

      if (existingUser) {
        targetUserId = existingUser.UserId;
        // Nếu user đã tồn tại và trong Excel có mật khẩu mới, thì mã hóa cập nhật, ngược lại giữ nguyên (null)
        if (password) {
          finalPasswordHash = await bcrypt.hash(password, 10);
        }
      } else {
        // Tài khoản mới, dùng mật khẩu từ Excel hoặc mật khẩu mặc định
        const pwdToUse = password || defaultPassword;
        finalPasswordHash = await bcrypt.hash(pwdToUse, 10);
      }

      // Xử lý cột isActive: hỗ trợ nhận dạng chữ 'Hoạt động', 'Ngưng hoạt động' hoặc số 1/0
      const activeRaw = String(row.isActive || '').trim();
      let isActiveVal = 1;
      if (activeRaw === 'Ngưng hoạt động' || activeRaw === '0' || activeRaw === 'false') {
        isActiveVal = 0;
      }

      await pool.request()
        .input('UserId', sql.Int, targetUserId)
        .input('MNV', sql.NVarChar(50), mnv)
        .input('FullName', sql.NVarChar(200), fullName)
        .input('Email', sql.NVarChar(200), email || '')
        .input('Role', sql.NVarChar(50), role)
        .input('IsActive', sql.Bit, isActiveVal)
        .input('PasswordHash', sql.NVarChar(255), finalPasswordHash)
        .execute('[dbo].[usp_UpsertUser]');

      if (department) {
        const empJson = JSON.stringify([{ fullName, email, mnv, department }]);
        await pool.request()
          .input('EmployeesJson', sql.NVarChar(sql.MAX), empJson)
          .input('FileModifiedAt', sql.DateTime, new Date())
          .execute('[dbo].[usp_SyncEmployees]');
      }

      inserted++;
    } catch (e) {
      errors.push(`Tài khoản "${mnv}": ${e.message}`);
    }
  }

  res.json({ success: true, message: `Đã xử lý ${inserted}/${rows.length} tài khoản`, errors });
});

module.exports = router;