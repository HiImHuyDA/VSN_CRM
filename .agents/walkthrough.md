# Walkthrough - Kết quả thực hiện nâng cấp hệ thống & Triển khai CSR Feedback System

Tài liệu này tổng hợp toàn bộ các tính năng đã được hoàn thành cho hệ thống quản lý tiếp khách (CSR).

---

## 1. Nâng cấp và Tối ưu các nghiệp vụ có sẵn

### 1.1. Đồng bộ Ra Vào Cổng theo Mã Đơn Gốc
*   **Vị trí**: [sharepointExcel.js](file:///D:/PM%20-%20PD%20Rev/project/csr-web/backend/src/utils/sharepointExcel.js) và [approvalNotification.js](file:///D:/PM%20-%20PD%20Rev/project/csr-web/backend/src/utils/approvalNotification.js)
*   **Chi tiết**:
    *   Sử dụng `parentId` (mã đơn gốc) thay vì chuỗi key phiên bản.
    *   So khớp để cập nhật dòng cũ dựa vào cặp khóa: `Mã đơn gốc + Ngày Đến` giúp hỗ trợ các đơn có nhiều ngày đến khác nhau.

### 1.2. Validation tab Thông Tin Chung khi tạo đơn mới
*   **Vị trí**: [NewSubmission.jsx](file:///D:/PM%20-%20PD%20Rev/project/csr-web/frontend/src/pages/NewSubmission.jsx)
*   **Chi tiết**:
    *   Tích hợp hàm `validateGeneralInfo` kiểm tra các trường bắt buộc trước khi chuyển tab và khi submit.
    *   Đối với khách Brand: Kiểm tra phải có tối thiểu 1 đại diện khách hàng (có điền đầy đủ họ tên), có người tham dự VSN và có đính kèm file Agenda.

### 1.3. Ghi nhận và hiển thị lý do hủy đơn
*   **Vị trí**: [submissions.js](file:///D:/PM%20-%20PD%20Rev/project/csr-web/backend/src/routes/submissions.js) và [SubmissionDrawer.jsx](file:///D:/PM%20-%20PD%20Rev/project/csr-web/frontend/src/components/dashboard/SubmissionDrawer.jsx)
*   **Chi tiết**:
    *   Lưu lý do hủy đơn vào bảng `CSR_ApprovalLogs` dưới Action `'Cancel'`.
    *   Hiển thị dòng *"Lý do hủy: [Nội dung]"* ngay dưới badge trạng thái "Đã hủy" ở vùng trạng thái hiện tại.

### 1.4. Đề xuất nhà hàng tối và cơm trưa ăn ngoài
*   **Vị trí**: [TaskCard.jsx](file:///D:/PM%20-%20PD%20Rev/project/csr-web/frontend/src/components/tasks/TaskCard.jsx)
*   **Chi tiết**:
    *   **Thêm cột Ẩm thực (Cuisine)**: Phân loại nhà hàng theo món ăn (Việt, Âu, Nhật, Chay).
    *   **API đếm lịch sử**: Thống kê số lần đặt từng nhà hàng của một khách hàng cụ thể.
    *   **Logic matching đề xuất**: Gợi ý top 5 nhà hàng tối ưu nhất theo thứ tự: (1) Nhà hàng khách đã từng đặt trước đây; (2) Nhà hàng khớp Level chức danh và Ẩm thực mong muốn; (3) Khớp Level chức danh nhưng không khớp ẩm thực; (4) Nhà hàng còn lại.
    *   **Cơm trưa ăn ngoài**: Thêm checkbox *"Ăn ngoài với khách"* cho task cơm trưa để sử dụng danh sách nhà hàng ăn tối và hiển thị panel chi tiết tương tự.

---

## 2. Phân hệ Khảo Sát Phản Hồi Khách Hàng (CSR Feedback System)

### 2.1. Cấu trúc Cơ sở dữ liệu
*   **Migration**: [63_create_feedback_tables.sql](file:///D:/PM%20-%20PD%20Rev/project/csr-web/backend/database/migrations/63_create_feedback_tables.sql)
*   **Bảng dữ liệu**:
    *   `CSR_FeedbackInvitations`: Lưu thông tin token bảo mật, ngày tạo, ngày hết hạn và trạng thái thư mời.
    *   `CSR_FeedbackResponses`: Lưu kết quả đánh giá thực tế của khách hàng (điểm Overall, điểm chi tiết dạng JSON và bình luận).
*   **Stored Procedures**:
    *   `usp_ValidateFeedbackToken`: Trả về thông tin kiểm tra token kèm danh sách các tiêu chí đánh giá đang hoạt động (`StatusId = 1`) để Power Pages hiển thị form.
    *   `usp_SubmitFeedback`: Nộp kết quả đánh giá, ghi dữ liệu vào database và chuyển đổi trạng thái token sang `Completed` tức thời trong cùng một Transaction để chống Replay Attack.

### 2.2. Bộ lập lịch Quét gửi thư mời (Scheduler)
*   **Vị trí**: [feedbackScheduler.js](file:///D:/PM%20-%20PD%20Rev/project/csr-web/backend/src/utils/feedbackScheduler.js)
*   **Chi tiết**:
    *   Quét định kỳ hàng ngày lúc 08:30 sáng.
    *   Tìm các đơn có: `CustomerType = 'Brand'`, `Status = 'Hoàn thành'` và có Ngày tiếp đón cuối cùng trùng với hôm qua (`MAX(OnboardDate) = Ngày hôm qua`).
    *   Với mỗi đơn tiếp đón đáp ứng:
        *   Sinh ngẫu nhiên mã băm bảo mật 64 ký tự (hex) bằng thuật toán mã hóa mạnh (`crypto.randomBytes`).
        *   Lưu vào bảng `CSR_FeedbackInvitations` với trạng thái `Pending` và thời hạn sử dụng 7 ngày.
        *   Gọi API Webhook của Power Automate gửi mail HTML cho từng đại diện khách hàng.

### 2.3. Cổng API quản lý Feedback (Internal API Routes)
*   **Vị trí**: [feedback.js](file:///D:/PM%20-%20PD%20Rev/project/csr-web/backend/src/routes/feedback.js)
*   **Các Endpoint**:
    *   `GET /api/feedback/invitations`: Truy vấn danh sách thư mời đã gửi kèm bộ lọc (Ngày, Host, Phòng ban, Khách hàng, Trạng thái).
    *   `POST /api/feedback/invitations/resend`: Gửi lại thư mời (kéo dài ExpireDate, đổi token mới, đặt trạng thái về Pending và trigger lại Power Automate).
    *   `POST /api/feedback/invitations/cancel`: Hủy liên kết đánh giá (Status chuyển thành Cancelled).
    *   `GET /api/feedback/responses`: Lấy danh sách kết quả phản hồi ý kiến chi tiết của khách hàng.
    *   `POST /api/feedback/trigger-cron-manually`: Cho phép quản trị viên kích hoạt quét và gửi thư mời lập tức để kiểm thử mà không cần chờ đến 08:30.

### 2.4. Giao diện Quản lý Phản Hồi (Feedback Management UI)
*   **Vị trí**: [FeedbackManagement.jsx](file:///D:/PM%20-%20PD%20Rev/project/csr-web/frontend/src/pages/FeedbackManagement.jsx)
*   **Chi tiết**:
    *   Được tích hợp vào thanh Menu bên trái (Sidebar) cho phép các vai trò `Admin`, `BOD`, `PRD` truy cập.
    *   **Tab Thư Mời**: Cho phép theo dõi danh sách, trạng thái, ngày hết hạn. Hỗ trợ nút thao tác nhanh **Gửi lại** (Resend) và **Hủy bỏ** (Cancel) thư mời.
    *   **Tab Kết Quả**: Hiển thị bảng kết quả đánh giá (Overall Rating, bình luận chi tiết, ngày gửi).
    *   **Bộ lọc chuyên sâu**: Lọc theo Khách hàng, Host, Trạng thái, Điểm số, khoảng ngày gửi.
    *   **Xuất Excel**: Nút xuất báo cáo Excel tổng hợp nhanh dữ liệu của Tab đang chọn.
    *   **Nút quét thủ công**: Nút bấm "Quét & gửi tự động ngay" kích hoạt chạy job quét thử nghiệm lập tức.

---

## 3. Kết quả Kiểm thử & Biên dịch (Build Status)
*   **Frontend compilation**: Build thành công 100% bằng Vite/Rolldown (`vite build`).
*   **Backend integration**: Các file router và scheduler đã được đăng ký thành công vào luồng chạy chính trong [app.js](file:///D:/PM%20-%20PD%20Rev/project/csr-web/backend/src/app.js).
*   **PM2 process status**: Đã khởi động lại toàn bộ service thành công.
