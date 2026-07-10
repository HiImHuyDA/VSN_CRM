function authorizeRoles(...roles) {
    return (req, res, next) => {

        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Bạn không có quyền thực hiện chức năng này'
            });
        }

        next();
    };
}

module.exports = authorizeRoles;