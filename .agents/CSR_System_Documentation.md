# Tài Liệu Hệ Thống CSR Web (Customer Service Request)
## Vietsun Corporation — Cập nhật: 29/06/2026

---

## 1. Tổng Quan Kiến Trúc

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

- **Frontend**: Dự án React (Vite). Môi trường preview chạy ở cổng `4173`. Có tích hợp proxy trong `vite.config.js` để chuyển tiếp ngầm toàn bộ request `/api` sang backend cổng `3002` nhằm xử lý triệt để vấn đề CORS.
- **Backend**: Ứng dụng Node.js Express chạy ở cổng `3002` (cấu hình qua `PORT` trong `backend/.env`).
- **Database**: SQL Server. Toàn bộ logic nghiệp vụ truy vấn hoặc ghi dữ liệu bắt buộc gọi qua **Stored Procedures**, không sử dụng truy vấn thô (inline query).

---

## 2. Database Schema & Stored Procedures

### Bảng dữ liệu chính
- `CSR_Projects`: Thông tin đơn tiếp khách.
- `CSR_Tasks`: Chi tiết công việc chuẩn bị cho từng chuyến đi (phòng họp, ăn uống, xe đưa đón...).
- `CSR_TaskConfig`: Cấu hình danh mục công việc mặc định theo từng địa điểm tiếp đón.
- `CSR_Employees`: Danh sách nhân viên Vietsun (đồng bộ định kỳ từ file Excel dữ liệu nhân sự).
- `CSR_Users`: Tài khoản đăng nhập, băm mật khẩu, phân quyền.
- `CSR_ConfigLists`: Danh mục cấu hình dùng chung (Category: `Brand`, `Partner`, `DinnerRestaurant`, `LunchMenu`, `MeetingRoom`).
- `CSR_Locations`: Các địa điểm tiếp đón khách hàng và danh sách email thông báo tương ứng.

### Danh sách Stored Procedures chuẩn hóa (Mới nhất)
Các SP được đặt tên nhất quán theo cấu trúc `usp_[Module]_[Action]_[Scope]` để tránh nhầm lẫn:
- **Cấu hình (TaskConfig)**:
  - `usp_TaskConfig_GetDefaultsByDestinations`: Phân tách danh sách địa điểm và trả về cấu hình công việc mặc định tương ứng.
  - `usp_TaskConfig_List`: Trả về danh sách toàn bộ các cấu hình công việc để hiển thị ở trang Admin.
- **Quản lý đơn tiếp khách (Submission)**:
  - `usp_Submission_GetDetail`: Lấy chi tiết thông tin đơn tiếp đón và các công việc liên quan theo `ProjectId`.
  - `usp_Submission_List`: Lấy danh sách các đơn tiếp khách phân trang, hỗ trợ bộ lọc tìm kiếm và phân tách tab.
- **Mẫu Email (EmailTemplate)**:
  - `usp_EmailTemplate_GetById`: Lấy chi tiết một mẫu Email chiến dịch theo Id.
  - `usp_EmailTemplate_List`: Liệt kê các mẫu email chiến dịch hiện có.
- **File đính kèm (TaskAttachment)**:
  - `usp_TaskAttachment_GetById`: Lấy thông tin đường dẫn vật lý của file đính kèm.
  - `usp_TaskAttachment_ListByTaskId`: Danh sách file đính kèm thuộc một công việc cụ thể.
- **Thống kê (Dashboard)**:
  - `usp_Dashboard_GetStats`: Trả về các KPI, biểu đồ tháng, danh sách phê duyệt chờ duyệt và lịch tiếp khách.

---

## 3. Quy Trình Đồng Bộ & Gửi Thông Báo Tự Động

### 3.1. Đồng bộ lên Bảng Excel SharePoint 365
- **Cơ chế**: Sử dụng Microsoft Graph Excel Table API để chèn mới hoặc cập nhật trực tiếp dòng dữ liệu.
- **Thiết lập bảng**: Tên bảng (`SHAREPOINT_EXCEL_TABLE=Table1`) và sheet (`SHAREPOINT_EXCEL_SHEET=Sheet1`) được cấu hình trong `backend/.env`.
- **Logic cập nhật/chèn mới**:
  - Khi tạo đơn mới: Chèn thêm dòng mới vào Excel, tự động sinh mã số ID lớn nhất kế tiếp.
  - Khi sửa đổi đơn: Hệ thống so khớp dòng cũ trong Excel dựa trên bộ ba khóa: `CSR_Id` + `ĐỊA ĐIỂM CÔNG TÁC` + `NGÀY ĐI`. Nếu khớp, hệ thống cập nhật lại các thông tin lịch trình thay đổi nhưng **bảo toàn nguyên vẹn** các thông tin tài xế, biển số xe, số điện thoại tài xế và giờ xuất phát đã được điều phối trước đó.
- **Tính toán số lượng**: Tổng số người đi được tính bằng số nhân viên Vietsun (`Attendees`) + số khách (`GuestCount`).

### 3.2. Gửi Email thông báo khi BOD duyệt đơn
- **Điều kiện**: Tự động kích hoạt khi đơn được BOD duyệt thành công (`Status = N'BOD đã duyệt'`).
- **Nội dung email**: Chứa bảng thông tin chi tiết về hành trình đi công tác (đơn vị, ngày đi/về, phương tiện, địa điểm, danh sách đi...).
- **Xử lý khi thay đổi lịch trình**: Khi người dùng chỉnh sửa đơn (`Version > 1`) và có thay đổi về lịch trình/địa điểm/ngày đi, hệ thống sẽ gửi lại email thông báo kèm tiêu đề cảnh báo thay đổi: `"Đơn tiếp khách có thay đổi như sau:"`.
- **Người nhận**: Gửi trực tiếp đến Người thực hiện (Assignee) và Người giám sát (Supervisor) của công việc đó (Ngoại trừ công việc *Chuẩn bị xe (từ sân bay)* tại địa điểm *VSN-NT*).

---

## 4. Hướng Dẫn Vận Hành & Chạy Hệ Thống

### Khởi chạy môi trường Phát triển (Local)
1. **Khởi chạy Backend**:
   ```bash
   cd backend
   npm install
   # Thiết lập file .env (copy từ .env.example)
   node server.js
   # Chạy trên cổng 3002
   ```
2. **Khởi chạy Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   # Chạy trên http://localhost:5173 (Chuyển tiếp API về localhost:3002)
   ```

### Vận hành trên máy chủ (Production - PM2)
Sử dụng file cấu hình `ecosystem.config.js` ở thư mục gốc để quản lý cả frontend và backend:
```bash
# Khởi động toàn bộ dịch vụ
pm2 start ecosystem.config.js

# Khởi động lại dịch vụ
pm2 restart all

# Cập nhật và nạp lại hoàn toàn biến môi trường mới
pm2 delete all
pm2 start ecosystem.config.js
```
Dịch vụ chạy thực tế:
- **Backend**: Cổng `3002`
- **Frontend (Vite Preview)**: Cổng `4173` (người dùng truy cập qua cổng này)
