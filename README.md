# CSR Web (Customer Service Request) - Quản lý Khách Hàng

Ứng dụng quản lý quy trình khách hàng của **Vietsun Corporation**, tích hợp đồng bộ lịch trình ra vào cổng lên SharePoint, phê duyệt nhanh qua Microsoft Teams và hệ thống đánh giá khảo sát khách hàng tự động.

---

## 🚀 1. Tổng Quan Kiến Trúc (Architecture Overview)

Hệ thống được thiết kế theo mô hình 3-tier tách biệt:
*   **Frontend**: ReactJS xây dựng bằng Vite, đóng gói và chạy thực tế ở cổng `4173` (môi trường preview) hoặc `5173` (môi trường phát triển dev).
*   **Backend**: Node.js Express API chạy tại cổng `3002`, chịu trách nhiệm làm proxy trung gian giao tiếp DB và tích hợp dịch vụ bên thứ ba (SharePoint, Teams, Mail, Scheduler).
*   **Database**: SQL Server (MSSQL). Toàn bộ logic nghiệp vụ truy vấn/thao tác dữ liệu đều bắt buộc gọi qua **Stored Procedures**, không sử dụng SQL inline trong mã nguồn.

---

## 📂 2. Cấu Trúc Thư Mục (Folder Structure)

```
csr-web/
├── .agents/           # Thư mục lưu trữ tài liệu phân tích hệ thống và quy tắc phát triển
├── backend/           # Mã nguồn Backend Node.js
│   ├── database/      # Chứa các file migrations SQL Server (~70 bản cập nhật)
│   ├── scripts/       # Script tiện ích & sync dữ liệu
│   ├── src/
│   │   ├── config/    # Cấu hình DB, JWT, SharePoint
│   │   ├── middleware/# Middleware xác thực JWT, bắt lỗi tập trung
│   │   ├── routes/    # Định nghĩa API (Submissions, Tasks, Feedback, v.v.)
│   │   └── utils/     # Xử lý Logic (Đồng bộ SharePoint, gửi mail, Teams webhook, cron job)
│   ├── server.js      # Entrypoint khởi chạy server backend
│   └── .env           # File cấu hình môi trường backend
├── frontend/          # Mã nguồn Frontend React (Vite)
│   ├── src/
│   │   ├── components/# Các thành phần UI (Form, Agenda, Tasks, Dashboard)
│   │   ├── pages/     # Trang ứng dụng (Dashboard, NewSubmission, FeedbackManagement)
│   │   ├── services/  # Quản lý gọi API (api.js)
│   │   └── App.jsx    # Định nghĩa tuyến đường router chính
│   └── vite.config.js # Cấu hình Vite & API Proxy
└── ecosystem.config.js# File cấu hình vận hành PM2 cho môi trường Production
```

---

## 💾 3. Quy Tắc Cơ Sở Dữ Liệu (Database Guidelines)

*   **Tuyệt đối không sử dụng inline query**: Tất cả các tuyến Express routes trong [backend/src/routes/](file:///d:/PM%20-%20PD%20Rev/project/csr-web/backend/src/routes/) không được phép chứa câu lệnh SQL thô. Mọi thao tác đọc/ghi đều phải thực thi Stored Procedure.
*   **Quy chuẩn đặt tên Stored Procedure**:
    *   Tất cả stored procedure sử dụng tiền tố chuẩn hóa: `usp_[Module]_[Action]_[Scope]`.
    *   Ví dụ:
        *   `usp_Submission_List`: Tải danh sách đơn tiếp khách phân trang & lọc.
        *   `usp_Submission_GetDetail`: Lấy chi tiết đơn tiếp khách và danh sách công việc.
        *   `usp_Dashboard_GetStats`: Sinh các chỉ số báo cáo KPI Dashboard.
*   **Migration**: Khi có sự thay đổi cấu trúc bảng hoặc Stored Procedure, tạo file `.sql` tương ứng đặt tại [backend/database/migrations/](file:///d:/PM%20-%20PD%20Rev/project/csr-web/backend/database/migrations/) và chạy lệnh nạp:
    ```bash
    node run_migration.js <tên_file_migration.sql>
    ```

---

## ⚙️ 4. Cấu Hình Môi Trường (Environment Variables)

Sao chép file cấu hình mẫu tại `backend/.env.example` thành `backend/.env` và điền đầy đủ các thông tin:

*   **Database cấu hình**: `DB_SERVER`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE`.
*   **Bảo mật JWT**: Cần cấu hình `JWT_SECRET` với chuỗi ngẫu nhiên đủ mạnh dài ít nhất 32 ký tự để đảm bảo khởi động backend (Ví dụ sinh mã bằng Node: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`).
*   **Tích hợp SharePoint & Microsoft Graph**: `TENANT_ID`, `CLIENT_ID`, `CLIENT_SECRET`.
*   **Đồng bộ bảo vệ cổng**: `SHAREPOINT_GATE_EXCEL_URL` và `SHAREPOINT_GATE_EXCEL_TABLE`.
*   **Teams Webhook (BOD Approve)**: `TEAMS_WEBHOOK_BOD_URL`.

---

## 🚀 5. Hướng Dẫn Vận Hành & Khởi Chạy (Getting Started)

### Môi trường Phát triển (Local Development)

#### 1. Khởi chạy Backend
```bash
cd backend
npm install
# Cấu hình .env
npm run dev # Hoặc node server.js
```
Backend sẽ lắng nghe tại cổng `http://localhost:3002`.

#### 2. Khởi chạy Frontend
```bash
cd frontend
npm install
npm run dev
```
Trình duyệt sẽ mở cổng dev `http://localhost:5173`. Các yêu cầu đến `/api` sẽ được tự động chuyển tiếp về backend cổng `3002`.

---

### Môi trường Vận hành Production (Sử dụng PM2)

Tại thư mục gốc dự án, sử dụng file cấu hình `ecosystem.config.js` để quản lý đồng thời cả 2 dịch vụ:

```bash
# Khởi chạy toàn bộ dịch vụ (Cả Frontend Vite Preview & Backend API)
pm2 start ecosystem.config.js

# Khởi động lại toàn bộ dịch vụ
pm2 restart all

# Xóa cache môi trường và tải lại cấu hình .env mới
pm2 delete all && pm2 start ecosystem.config.js

# Theo dõi nhật ký hệ thống (Logs)
pm2 logs
```

*   **Cổng truy cập người dùng**: Cổng `4173` (Vite Preview).
*   **Cổng API backend**: Cổng `3002` (Được cấu hình proxy ngược từ cổng `4173` thông qua Vite).

---

## ✉️ 6. Các Luồng Nghiệp Vụ Tích Hợp Tự Động

1.  **Đồng bộ hóa SharePoint Excel**: Khi đơn tiếp khách được duyệt hoàn tất, hệ thống tự động ghi nhận thông tin biển số xe ra vào cổng lên SharePoint Excel. Khi có chỉnh sửa lịch trình, hệ thống tìm kiếm dòng cũ theo cặp khóa `CSR_Id` + `ĐỊA ĐIỂM CÔNG TÁC` + `NGÀY ĐI` để cập nhật đè nội dung và **bảo toàn các thông tin tài xế/xe đã điều phối**.
2.  **Thông báo Teams BOD**: Tự động bắn Adaptive Card đẩy tin nhắn phê duyệt nhanh sang kênh Microsoft Teams của BOD đối với các đơn loại khách `Brand` khi PRD duyệt.
3.  **Tự động gửi Thư mời Đánh giá (CSR Feedback)**: Bộ Scheduler tự động quét mỗi ngày lúc 08:30 sáng tìm các đơn loại `Brand` kết thúc đón tiếp vào ngày hôm trước, sinh token mã hóa ngẫu nhiên gửi mail HTML cho khách hàng đánh giá ẩn danh thông qua Power Pages & On-premises Data Gateway.
