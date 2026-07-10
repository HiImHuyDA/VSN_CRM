const jwt = require('jsonwebtoken');
const JWT_SECRET = require('../config/jwtSecret');

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: 'Thiếu token'
        });
    }

    const token = authHeader.substring(7);

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        req.user = decoded;

        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            error: 'Token không hợp lệ hoặc đã hết hạn'
        });
    }
}

module.exports = authenticateToken;