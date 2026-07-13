// src/routes/menus.js
// Menu động theo Role + màn hình Admin cấu hình phân quyền menu
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const authorizeRoles = require('../middleware/authorize');
const { getCsrPool, sql } = require('../config/database');

router.use(authenticateToken);

/**
 * GET /api/menus/my-menu
 * Trả về danh sách menu (dạng phẳng) mà Role của user hiện tại được phép thấy.
 * Frontend tự dựng cây theo ParentId.
 */
router.get('/my-menu', async (req, res, next) => {
    try {
        const pool = await getCsrPool();
        const result = await pool.request()
            .input('Role', sql.NVarChar(50), req.user.role)
            .execute('usp_GetMyMenu');
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/menus/permissions-matrix
 * (Chỉ Admin) Trả về toàn bộ menu + toàn bộ gán quyền hiện tại, để dựng bảng ma trận menu x role.
 */
router.get('/permissions-matrix', authorizeRoles('Admin'), async (req, res, next) => {
    try {
        const pool = await getCsrPool();
        const result = await pool.request().execute('usp_GetMenuPermissionsMatrix');
        res.json({
            success: true,
            data: {
                menus: result.recordsets[0],
                permissions: result.recordsets[1],
            },
        });
    } catch (err) {
        next(err);
    }
});

/**
 * PUT /api/menus/:menuId/permissions
 * (Chỉ Admin) Cập nhật toàn bộ danh sách Role được phép cho 1 menu.
 * Body: { roles: ['Admin', 'BOD'] }
 */
router.put('/:menuId/permissions', authorizeRoles('Admin'), async (req, res, next) => {
    try {
        const { menuId } = req.params;
        const { roles } = req.body;

        if (!Array.isArray(roles)) {
            return res.status(400).json({ success: false, error: 'roles phải là một mảng (có thể rỗng)' });
        }

        const validRoles = ['Admin', 'BOD', 'PRD', 'User'];
        const rolesCsv = roles.filter(r => validRoles.includes(r)).join(',');

        const pool = await getCsrPool();
        await pool.request()
            .input('MenuId', sql.Int, menuId)
            .input('RolesCSV', sql.NVarChar(200), rolesCsv)
            .execute('usp_UpdateMenuRolePermissions');

        res.json({ success: true, message: 'Đã cập nhật phân quyền menu thành công' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;