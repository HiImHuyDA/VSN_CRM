const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getCsrPool, sql } = require('../config/database');
const { logAuditAction } = require('../utils/auditLogger');

const JWT_SECRET = process.env.JWT_SECRET || 'csr_super_secret_key_123';

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập MNV và mật khẩu' });
    }

    const pool = await getCsrPool();
    const result = await pool.request()
      .input('MNV', sql.NVarChar(50), username)
      .execute('usp_GetUserByMNV');

    const user = result.recordset[0];
    if (!user) {
      return res.status(401).json({ success: false, error: 'Tài khoản không tồn tại hoặc bị khóa' });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.PasswordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Mật khẩu không đúng' });
    }

    // Create Token
    const tokenPayload = {
      userId: user.UserId,
      mnv: user.MNV,
      role: user.Role,
      fullName: user.FullName
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '8h' });

    // Log Login
    await logAuditAction('Đăng nhập', user.MNV, 'Đăng nhập thành công');

    res.json({
      success: true,
      data: {
        token,
        user: {
          mnv: user.MNV,
          fullName: user.FullName,
          email: user.Email,
          role: user.Role,
          requiresPasswordChange: user.RequiresPasswordChange
        }
      }
    });

  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/change-password
 */
router.post('/change-password', async (req, res, next) => {
  try {
    const { mnv, oldPassword, newPassword } = req.body;

    const pool = await getCsrPool();
    const result = await pool.request()
      .input('MNV', sql.NVarChar(50), mnv)
      .execute('usp_GetUserByMNV');

    const user = result.recordset[0];
    if (!user) {
      return res.status(404).json({ success: false, error: 'User không tồn tại' });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.PasswordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Mật khẩu cũ không đúng' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.request()
      .input('MNV', sql.NVarChar(50), mnv)
      .input('NewPasswordHash', sql.NVarChar(255), newHash)
      .execute('usp_ChangePassword');

    // Log Change Password
    await logAuditAction('Đổi mật khẩu', mnv, 'Đổi mật khẩu thành công');

    res.json({ success: true, message: 'Đổi mật khẩu thành công' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
