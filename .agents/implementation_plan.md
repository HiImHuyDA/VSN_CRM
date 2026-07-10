# Kế hoạch triển khai: Tính năng Đánh giá Khách hàng (CSR Feedback System)

Kế hoạch này mô tả các đầu việc cần thực hiện trên mã nguồn hệ thống CSR Web nội bộ để tích hợp với hệ thống Power Pages & Power Automate.

---

## Các thay đổi đề xuất

### 1. Database Migration: Tạo các bảng lưu trữ Feedback
*   **Vị trí**: [63_create_feedback_tables.sql](file:///D:/PM%20-%20PD%20Rev/project/csr-web/backend/database/migrations/63_create_feedback_tables.sql) [NEW]
*   **Giải pháp**:
    *   Tạo bảng `CSR_FeedbackInvitations` lưu thông tin Token và trạng thái gửi mail.
    *   Tạo bảng `CSR_FeedbackResponses` lưu kết quả đánh giá của khách hàng.
    *   Tạo Stored Procedure `usp_ValidateFeedbackToken` và `usp_SubmitFeedback` để phục vụ gọi qua Gateway.

### 2. Cron Job Service: Tự động quét và gửi thư mời đánh giá
*   **Vị trí**: [feedbackScheduler.js](file:///D:/PM%20-%20PD%20Rev/project/csr-web/backend/src/utils/feedbackScheduler.js) [NEW]
*   **Giải pháp**:
    *   Viết một hàm cron job quét định kỳ hàng ngày (ví dụ 08:00 sáng).
    *   Tìm các đơn có: `CustomerType = 'Brand'`, `Status = 'Hoàn thành'` và có Ngày tiếp đón cuối cùng trùng với ngày hôm qua (`OnboardDate` cuối cùng cách hiện tại 1 ngày).
    *   Với mỗi đơn:
        *   Sinh ngẫu nhiên mã băm độ dài 64 ký tự (hex) bằng `crypto.randomBytes(32).toString('hex')`.
        *   Ghi bản ghi vào bảng `CSR_FeedbackInvitations` với trạng thái `Pending`.
        *   Gọi Webhook API của Power Automate (URL cấu hình trong `.env`) để gửi email HTML mời khách hàng đánh giá.
    *   Tích hợp khởi động cron job này trong file khởi động backend `server.js` hoặc `app.js`.

### 3. Backend Routing: API quản lý Lời mời & Kết quả Đánh giá
*   **Vị trí**: [feedback.js](file:///D:/PM%20-%20PD%20Rev/project/csr-web/backend/src/routes/feedback.js) [NEW]
*   **Giải pháp**:
    *   Đăng ký router `/api/feedback` trong backend:
        *   `GET /api/feedback/invitations`: Truy vấn danh sách thư mời đã gửi kèm bộ lọc (Ngày, Host, Phòng ban, Khách hàng, Trạng thái).
        *   `POST /api/feedback/invitations/resend`: Gửi lại thư mời (kéo dài ExpireDate, đổi trạng thái về Pending và gọi lại webhook).
        *   `POST /api/feedback/invitations/cancel`: Hủy chủ động lời mời (đổi trạng thái sang Cancelled).
        *   `GET /api/feedback/responses`: Lấy danh sách kết quả đánh giá chi tiết.

### 4. Frontend Router & Service: API integration
*   **Vị trí**: 
    *   [api.js](file:///D:/PM%20-%20PD%20Rev/project/csr-web/frontend/src/services/api.js) [MODIFY]
    *   [App.jsx](file:///D:/PM%20-%20PD%20Rev/project/csr-web/frontend/src/App.jsx) [MODIFY]
*   **Giải pháp**:
    *   Thêm các hàm gọi API `/api/feedback` vào file `api.js`.
    *   Khai báo route `/feedback-management` trong file `App.jsx` và tích hợp vào thanh menu bên trái.

### 5. Frontend UI: Giao diện Quản lý Đánh giá (Feedback Management)
*   **Vị trí**: [FeedbackManagement.jsx](file:///D:/PM%20-%20PD%20Rev/project/csr-web/frontend/src/pages/FeedbackManagement.jsx) [NEW]
*   **Giải pháp**:
    *   Xây dựng bảng danh sách Thư mời đánh giá và Tab kết quả đánh giá của khách hàng.
    *   Bộ lọc chuyên sâu: Ngày, Host, Bộ phận, Tên khách, Trạng thái (Pending, Completed, Expired, Cancelled), Điểm số rating (1-5 sao).
    *   Hành động nhanh: Click nút **"Gửi lại mail"**, **"Hủy bỏ thư mời"**, hoặc click **"Xem chi tiết bình luận"** của khách hàng.
    *   Hỗ trợ xuất Excel báo cáo tổng hợp.

---

## Verification Plan

### Automated Tests
- Chạy thử script migration database.
- Viết script test thủ công kích hoạt trigger scheduler ngay lập tức để kiểm tra logic sinh token và gọi webhook Power Automate.

### Manual Verification
1.  **Chạy Migration SQL**: Xác nhận tạo thành công các bảng và Stored Procedure trong SQL Server local.
2.  **Tự động gửi feedback**:
    *   Tạo một đơn tiếp khách Brand hoàn thành vào ngày hôm qua.
    *   Chạy trigger scheduler, xác nhận bản ghi `CSR_FeedbackInvitations` được tạo với Token hex 64 ký tự và có request HTTP gửi lên Power Automate.
3.  **Thao tác Quản lý tại Giao diện**:
    *   Mở trang Quản lý Đánh giá, kiểm tra danh sách lời mời hiển thị đầy đủ thông tin.
    *   Thử bấm Hủy bỏ thư mời và xác nhận trạng thái đổi sang `Cancelled`.
    *   Thử bấm Gửi lại thư mời, kiểm tra cập nhật hạn sử dụng và kích hoạt lại email.
