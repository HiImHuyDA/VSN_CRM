// src/config/jwtSecret.js
// Đọc JWT_SECRET từ biến môi trường bắt buộc - KHÔNG dùng giá trị mặc định hardcode.
// Lý do: code này nằm trên repo GitHub public, nếu giữ giá trị fallback thì bất kỳ ai
// đọc được source code cũng có thể tự ký (forge) JWT token giả mạo mọi user (kể cả Admin)
// trong trường hợp server quên set biến môi trường JWT_SECRET.
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.trim().length < 32) {
    throw new Error(
        '[FATAL] Biến môi trường JWT_SECRET chưa được cấu hình hoặc quá ngắn (< 32 ký tự). ' +
        'Vui lòng set JWT_SECRET trong file .env với 1 chuỗi ngẫu nhiên đủ mạnh, ví dụ tạo bằng: ' +
        'openssl rand -hex 64 (hoặc node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))")'
    );
}

module.exports = JWT_SECRET;