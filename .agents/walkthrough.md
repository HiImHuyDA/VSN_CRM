# walkthrough.md — Security & Role-Based Access Scope Refactoring

Tài liệu này ghi lại các chỉnh sửa và kiểm nghiệm cho nghiệp vụ phân quyền bảo mật & giới hạn truy cập theo vai trò (Role-Based Access Scope) đối với các module **Guest (Tiếp khách)** và **Fleet (Quản lý xe công tác)**.

---

## 1. Cơ sở dữ liệu (Stored Procedures)

### 📌 usp_Submission_List & usp_Fleet_Booking_List
- Đã được cập nhật cấu trúc truy vấn phân quyền tại file [89_role_permission_matrix_security.sql](file:///d:/PM%20-%20PD%20Rev/project/csr-web/backend/database/migrations/89_role_permission_matrix_security.sql).
- **User role**:
  - Đối với Tiếp khách: Chỉ xem được các đơn của bản thân hoặc của nhân viên trực thuộc mình quản lý (quy chiếu qua email `ManagerEmail` trong bảng `CSR_Employees`).
  - Đối với Xe công tác: Chỉ xem được các đơn do bản thân tạo hoặc của nhân viên thuộc quyền quản lý của mình.

---

## 2. Server Backend

### 📌 API Tiếp khách (submissions.js)
- **GET `/api/submissions`**: Ràng buộc tham số role và mnv từ JWT payload (`req.user`) để tránh giả mạo tham số request.
- **GET `/api/submissions/:projectId`**:
  - Trả về thông tin chi tiết kèm đối tượng `permissions` tính toán trực tiếp từ DB: `canEdit`, `canCancel`, `canApprove`, `canReject`.
  - Phê duyệt / Từ chối được kiểm soát chính xác theo chuỗi trạng thái (`Chờ phản hồi` -> PRD, `PRD đã duyệt` -> BOD).
- **POST `/:projectId/cancel`**: Kiểm tra quyền hủy đơn (chỉ Creator, Manager của Creator hoặc Admin).
- **POST `/:projectId/approve` / `/:projectId/reject`**: Chặn các vai trò không hợp lệ phê duyệt sai trình tự trạng thái.

### 📌 Lịch trình xe công tác (`fleet.js` - `/bookings/calendar`)
- Khắc phục lỗi **"ID không hợp lệ" (400 Bad Request)** khi tải lịch trình xe.
- **Nguyên nhân**: Bản chất Express định tuyến tuần tự. Endpoint động `/bookings/:id` được định nghĩa nhưng hệ thống thiếu mất endpoint `/bookings/calendar` khiến Express hiểu lầm `'calendar'` là tham số `:id` (dẫn tới lỗi kiểm tra kiểu số `isNaN(Number('calendar'))`).
- **Cách khắc phục**: Đã tạo mới endpoint `GET /bookings/calendar` gọi Stored Procedure `usp_Fleet_Booking_GetCalendar` trong database và đặt lên **trước** endpoint `/bookings/:id` để bảo đảm tính khớp chính xác.

### 📌 Guest & Fleet Configurations (`fleet.js` & `systemConfig.js`)
- Thay thế danh sách vai trò cố định (hardcoded) trong các endpoint ghi/sửa dữ liệu cấu hình bằng việc kiểm tra động trực tiếp từ cơ sở dữ liệu!
- Tạo tệp cơ sở dữ liệu mới [91_create_usp_MenuPermission_Check.sql](file:///d:/PM%20-%20PD%20Rev/project/csr-web/backend/database/migrations/91_create_usp_MenuPermission_Check.sql) khởi tạo Stored Procedure `usp_MenuPermission_Check` để kiểm tra quyền truy cập menu của một Role.
- Khởi tạo Middleware dùng chung [authorizeMenu.js](file:///d:/PM%20-%20PD%20Rev/project/csr-web/backend/src/middleware/authorizeMenu.js) giúp xác thực phân quyền động:
  - Cấu hình Xe, Tài xế, Loại xe -> Menu key `'vehicle.config'`
  - Địa điểm (và batch địa điểm) -> Menu key `'guest.config.locations'`
  - Cấu hình công việc -> Menu key `'guest.config.tasks'`
  - Phòng họp -> Menu key `'guest.config.meeting-rooms'`
  - Nhà hàng/Thực đơn -> Menu key `'guest.config.restaurants'`
  - Khách hàng -> Menu key `'guest.config.customers'`
- Điều này đảm bảo rằng **bất kỳ tài khoản thuộc vai trò nào được gán quyền truy cập menu tương ứng trong ma trận Phân Quyền Menu (Admin UI) đều có toàn quyền thêm mới, cập nhật và import dữ liệu cấu hình đó**, loại bỏ hoàn toàn việc khóa cứng vai trò trong code.


---

## 3. Client Frontend

### 📌 SubmissionDrawer.jsx
- Loại bỏ logic phân quyền cứng ở phía Client.
- Đồng bộ hóa hiển thị nút bấm với đối tượng `permissions` do API trả về:
  - ✏️ **Chỉnh Sửa** hiển thị dựa trên `canEdit`.
  - 🗑️ **Huỷ Đơn** hiển thị dựa trên `canCancel`.
  - ✅ **Phê Duyệt** & ❌ **Từ Chối** hiển thị dựa trên `canApprove`.

### 📌 VehicleBookingDetail.jsx
- Đồng bộ hóa hiển thị và các thao tác duyệt/hủy/sửa thông qua các cờ phân quyền chi tiết từ Backend trả về:
  - ✏️ **Chỉnh sửa** dựa trên `canEdit`.
  - 🗑️ **Hủy đơn** dựa trên `canCancel`.
  - **Duyệt Đơn** (cấp Giám sát) dựa trên `canApproveSupervisor`.
  - **Duyệt & Phân Xe** (cấp Team Admin) dựa trên `canApproveTeamAdmin`.

---

## 4. Kết quả build & triển khai
- Mã nguồn Frontend đã được biên dịch thành công (`npm run build`) và không có bất kỳ lỗi cú pháp hay cảnh báo TypeScript nào.
- ⚠️ **Lưu ý hệ thống**: Do server cơ sở dữ liệu nội bộ của người dùng (`10.0.0.36`) đang tạm thời không liên kết được từ môi trường local tại thời điểm này (ping timeout), tiến trình backend PM2 sẽ tự động khôi phục bình thường ngay khi kết nối mạng nội bộ của bạn được thiết lập trở lại.
