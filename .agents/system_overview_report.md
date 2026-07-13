# Báo Cáo Tổng Quan Hệ Thống CSR Web

Tài liệu này tổng hợp cấu trúc hệ thống, các luồng nghiệp vụ cốt lõi, cơ sở dữ liệu và tình trạng vận hành hiện tại của dự án **CSR Web (Customer Service Request)** để phục vụ phát triển và bàn giao.

---

## 1. Kiến Trúc & Công Nghệ (Architecture & Tech Stack)

```
┌─────────────────────────────────────────────────────────┐
│                    CSR WEB APPLICATION                   │
│ ├────────────────────┬────────────────────────────────┤ │
│ │   FRONTEND (React) │       BACKEND (Node.js Express)│ │
│ │   Port: 4173       │          Port: 3002            │ │
│ │   (Vite Preview)   │          (Production Env)      │ │
│ │                    │                                │ │
│ │ ┌──────────────┐   │  ┌───────────────────────────┐ │ │
│ │ │ React Router │   │  │  REST API Endpoints       │ │ │
│ │ │ + Auth State │   │  │  → /api/auth              │ │ │
│ │ │ + Pages      │   │  │  → /api/submissions       │ │ │
│ │ │ + Sidebar    │   │  │  → /api/employees         │ │ │
│ │ │ + config/    │   │  │  → /api/system-config     │ │ │
│ │ └──────────────┘   │  └──────────────┬────────────┘ │ │
│ └────────────────────┴─────────────────┼──────────────┘ │
│                                        │                │
│                         ┌──────────────▼────────────┐   │
│                         │    SQL Server (CSR_DB)    │   │
│                         │  + Stored Procedures Only │   │
│                         └───────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

*   **Frontend**: React.js (Vite), cổng preview chạy tại `4173` (hoặc dev chạy tại `5173`). Toàn bộ request `/api/*` được cấu hình proxy chuyển tiếp đến cổng `3002` trong [vite.config.js](file:///d:/PM%20-%20PD%20Rev/project/csr-web/frontend/vite.config.js) để loại bỏ vấn đề CORS.
*   **Backend**: Node.js Express, chạy tại cổng `3002` (cấu hình qua biến `PORT` trong [backend/.env](file:///d:/PM%20-%20PD%20Rev/project/csr-web/backend/.env)).
*   **Database**: SQL Server (MSSQL).
*   **Process Management**: Quản lý bởi PM2 thông qua file cấu hình [ecosystem.config.js](file:///d:/PM%20-%20PD%20Rev/project/csr-web/ecosystem.config.js) ở thư mục gốc.

---

## 2. Quy Tắc Cơ Sở Dữ Liệu & Stored Procedures

*   **Quy tắc nghiêm ngặt (No Inline SQL)**: Không viết bất kỳ truy vấn SQL trực tiếp nào trong Express routes của backend hoặc trong frontend. Mọi tương tác dữ liệu bắt buộc phải gọi qua Stored Procedures trong SQL Server.
*   **Quy chuẩn đặt tên**: Các Stored Procedures được chuẩn hóa dưới dạng `usp_[Module]_[Action]_[Scope]` để phân biệt rõ ràng:
    *   `usp_TaskConfig_GetDefaultsByDestinations` (tài task mặc định theo địa điểm)
    *   `usp_TaskConfig_List` (danh sách cấu hình cho admin)
    *   `usp_Submission_GetDetail` (chi tiết đơn tiếp khách và tasks)
    *   `usp_Submission_List` (danh sách phân trang và phân tách tab của Dashboard)
    *   `usp_Dashboard_GetStats` (thống kê KPIs và lịch tiếp đón)
    *   `usp_EmailTemplate_GetById` & `usp_EmailTemplate_List` (mẫu email chiến dịch)
*   **Migrations**: Lưu tại thư mục [backend/database/migrations/](file:///d:/PM%20-%20PD%20Rev/project/csr-web/backend/database/migrations/) và chạy thông qua script [run_migration.js](file:///d:/PM%20-%20PD%20Rev/project/csr-web/backend/run_migration.js).

---

## 3. Cấu Trúc Thư Mục Dự Án (Project Directory Structure)

Hệ thống tuân thủ cấu trúc phân cấp chức năng rõ ràng:

```
backend/
├── database/
│   └── migrations/    (Lưu lịch sử nâng cấp DB, hiện tại có ~70 files SQL)
├── src/
│   ├── config/        (database.js, sharepoint.js, jwtSecret.js)
│   ├── routes/        (Các API endpoints / Thin Proxy gọi Stored Procedure)
│   ├── middleware/    (auth.js, errorHandler.js)
│   ├── utils/         (Các helper, gửi mail, đồng bộ SharePoint, cron scheduler)
│   └── app.js         (Đăng ký Router & Khởi động Scheduler)
├── scripts/           (maintenance/, tests/, sync_employees.py)
├── server.js          (Entrypoint khởi chạy Express Server)
└── .env               (Biến môi trường)

frontend/
├── src/
│   ├── assets/        (hình ảnh, css, index.css)
│   ├── components/    (agenda/, dashboard/, form/, layout/, tasks/, ui/)
│   ├── pages/         (Dashboard, NewSubmission, FeedbackManagement, Reports, GuestCalendar, v.v.)
│   ├── services/      (api.js kết nối REST API)
│   ├── utils/         (helpers.js)
│   ├── App.jsx        (Routing chính)
│   └── main.jsx       (React Root DOM render)
├── package.json
└── vite.config.js
```

---

## 4. Các Luồng Nghiệp Vụ Chính (Core Business Workflows)

### 4.1. Tạo Đơn Tiếp Khách & Validate
*   Người dùng điền đơn qua trang [NewSubmission.jsx](file:///d:/PM%20-%20PD%20Rev/project/csr-web/frontend/src/pages/NewSubmission.jsx).
*   **Validation bắt buộc**: Loại khách `Brand` yêu cầu bắt buộc nhập: ít nhất một Đại diện khách hàng (Guest Rep), Người tham dự phía Vietsun (VSN Attendees) và đính kèm tệp Lịch trình (Agenda File).
*   Tự động tải danh sách công việc chuẩn bị bắt buộc (Tasks) theo địa điểm (ví dụ: Chuẩn bị xe, phòng họp, cơm trưa/tối) từ bảng `CSR_TaskConfig`.

### 4.2. Phê Duyệt Nhanh qua Microsoft Teams
*   Khi đơn tiếp khách loại `Brand` được PRD phê duyệt trên web, trạng thái đơn chuyển thành `PRD đã duyệt`.
*   Hệ thống backend gửi một Adaptive Card thông qua Incoming Webhook tới kênh Microsoft Teams của BOD.
*   BOD có thể ấn duyệt nhanh/từ chối trực tiếp từ Teams Card, chuyển hướng về trang duyệt trên web để BOD hoàn tất xác nhận ý kiến.

### 4.3. Đồng Bộ Ra Vào Cổng lên SharePoint Excel
*   Khi đơn chuyển trạng thái thành `Đã duyệt` hoặc `BOD đã duyệt`, hệ thống gọi Microsoft Graph API chèn/cập nhật dữ liệu xe/hành trình lên file Excel dùng chung ở SharePoint.
*   **Bảo toàn dữ liệu điều phối**: Để tránh đè dữ liệu trống khi cập nhật đơn, hệ thống tìm kiếm dòng cũ dựa trên khóa: `CSR_Id` + `ĐỊA ĐIỂM CÔNG TÁC` + `NGÀY ĐI`. Khi tìm thấy, hệ thống giữ nguyên thông tin tài xế, biển số xe, số điện thoại tài xế và giờ xuất phát đã được phân công trước đó.

### 4.4. Hệ Thống Khảo Sát Ý Kiến Khách Hàng (CSR Feedback System)
*   **Gửi thư mời tự động**: Một Cron Job chạy ngầm (`feedbackScheduler.js`) lúc **08:30 sáng** quét các đơn `Brand` có ngày đón tiếp cuối cùng kết thúc vào hôm trước.
*   Hệ thống sinh mã Secure Token ngẫu nhiên dài 64 ký tự bằng module `crypto` lưu vào `CSR_FeedbackInvitations` và gọi Power Automate Flow gửi email mời đánh giá đến khách hàng.
*   **Đánh giá ẩn danh**: Khách hàng click vào liên kết an toàn (chứa token) dẫn đến trang Power Pages công khai. Power Pages gọi Cloud Flow qua On-premises Data Gateway truy vấn cơ sở dữ liệu nội bộ để xác thực trạng thái Token.
*   **Lưu kết quả & Bảo mật**: Khi khách hàng nộp form, kết quả được lưu vào `CSR_FeedbackResponses`, đồng thời cập nhật token sang trạng thái `Completed` ngay trong cùng một Transaction để chống tấn công phát lại (Replay Attack). Giao diện [FeedbackManagement.jsx](file:///d:/PM%20-%20PD%20Rev/project/csr-web/frontend/src/pages/FeedbackManagement.jsx) cho phép PRD/BOD theo dõi lịch sử, kết quả và thực hiện gửi lại (Resend) hoặc huỷ bỏ (Cancel) thư mời.

---

## 5. Cảnh Báo Tình Trạng Hệ Thống Hiện Tại 🚨

Khi kiểm tra bằng lệnh `pm2 status`, dịch vụ **`csr-backend`** đang ở trạng thái **`stopped`** (đã dừng hoạt động).

### Nguyên nhân lỗi:
Nội dung file log lỗi (`~/.pm2/logs/csr-backend-error-1.log`) ghi nhận:
```
Error: [FATAL] Biến môi trường JWT_SECRET chưa được cấu hình hoặc quá ngắn (< 32 ký tự). Vui lòng set JWT_SECRET trong file .env với 1 chuỗi ngẫu nhiên đủ mạnh...
```

Tại file cấu hình môi trường [backend/.env](file:///d:/PM%20-%20PD%20Rev/project/csr-web/backend/.env#L25) hiện tại:
*   Dòng 25: `JWT_SECRET=` đang bị **bỏ trống**.
*   Điều này khiến backend vấp phải cơ chế bảo mật nghiêm ngặt tại [jwtSecret.js](file:///d:/PM%20-%20PD%20Rev/project/csr-web/backend/src/config/jwtSecret.js) và tự dừng hoạt động ngay lập tức khi khởi chạy.

### Hướng khắc phục:
1. Sinh một chuỗi bảo mật ngẫu nhiên đủ mạnh (độ dài trên 32 ký tự).
2. Điền chuỗi này vào trường `JWT_SECRET` tại file [backend/.env](file:///d:/PM%20-%20PD%20Rev/project/csr-web/backend/.env#L25).
3. Chạy lệnh `pm2 restart csr-backend` hoặc `pm2 restart all` để khởi động lại dịch vụ backend.
