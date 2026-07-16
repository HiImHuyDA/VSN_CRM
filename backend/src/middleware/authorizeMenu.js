const { getCsrPool, sql } = require('../config/database');

function authorizeMenu(menuKey) {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Unauthorized'
                });
            }

            const { role } = req.user;
            if (role === 'Admin') {
                return next();
            }

            const pool = await getCsrPool();
            const result = await pool.request()
                .input('Role', sql.NVarChar(50), role)
                .input('MenuKey', sql.NVarChar(100), menuKey)
                .output('HasPermission', sql.Int)
                .execute('usp_MenuPermission_Check');

            const hasPermission = result.output.HasPermission;

            if (hasPermission !== 1) {
                return res.status(403).json({
                    success: false,
                    error: 'Bạn không có quyền thực hiện chức năng này'
                });
            }

            next();
        } catch (err) {
            next(err);
        }
    };
}

module.exports = authorizeMenu;
