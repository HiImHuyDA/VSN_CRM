// src/middleware/errorHandler.js

function errorHandler(err, req, res, next) {
  console.error('❌ Error:', err.message || err);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Đã xảy ra lỗi máy chủ';

  res.status(status).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

function notFound(req, res, next) {
  const err = new Error(`Route không tìm thấy: ${req.originalUrl}`);
  err.status = 404;
  next(err);
}

module.exports = { errorHandler, notFound };
