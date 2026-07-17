# Walkthrough — Fleet Bookings Refactoring & Form Redesign

Tài liệu này ghi lại các chỉnh sửa, cập nhật cấu trúc cơ sở dữ liệu và tái cấu trúc giao diện cho phân hệ **Quản Lý Xe Công Tác (Fleet Management)** theo mô hình Master-Detail (một đơn đặt xe gồm nhiều chuyến/chặng di chuyển).

---

## 1. Cơ sở dữ liệu (Database Migrations)

### 📌 Migration 96: Tách bảng Fleet_BookingsDetailed
- Đường dẫn file migration: [96_refactor_fleet_bookings_detailed.sql](file:///d:/PM%20-%20PD%20Rev/project/csr-web/backend/database/migrations/96_refactor_fleet_bookings_detailed.sql)
- **Hành động**:
  - Tạo mới bảng chi tiết các chặng di chuyển `Fleet_BookingsDetailed` (nối với bảng chính qua `BookingCode`).
  - Thực hiện di chuyển và chuẩn hóa dữ liệu cũ tự động từ `Fleet_Bookings` sang bảng mới.
  - Loại bỏ các cột chặng đi dư thừa khỏi `Fleet_Bookings` và thêm trường `ParentBookingCode`.

### 📌 Migration 97: Cập nhật Stored Procedures
- Đường dẫn file migration: [97_update_fleet_stored_procedures.sql](file:///d:/PM%20-%20PD%20Rev/project/csr-web/backend/database/migrations/97_update_fleet_stored_procedures.sql)
- **Hành động**:
  - Cập nhật các Stored Procedure của module quản lý xe (`usp_Fleet_Booking_Create`, `usp_Fleet_Booking_Update`, `usp_Fleet_Booking_GetDetail`, `usp_Fleet_Booking_List`, `usp_Fleet_Booking_UpdateStatus`, `usp_Fleet_Booking_GetCalendar`) sang cấu trúc Master-Detail mới.

### 📌 Migration 98: Điều chỉnh tự động duyệt đơn cho VIP ([98_fix_fleet_auto_approve_logic.sql](file:///d:/PM%20-%20PD%20Rev/project/csr-web/backend/database/migrations/98_fix_fleet_auto_approve_logic.sql))
- **Hành động**:
  - Cập nhật `usp_Fleet_Booking_Create` và `usp_Fleet_Booking_Update` để chỉ tự động phê duyệt (`Status = 'Team Admin đã duyệt'`) khi đơn đặt xe có độ ưu tiên là `'VIP'`.
  - Đối với các đơn thường (`Priority <> 'VIP'`) được chọn xe đề xuất, đơn vẫn giữ nguyên trạng thái khởi tạo là `'Chờ phản hồi'` để thực hiện quy trình phê duyệt các cấp thông thường.

### 📌 Migration 99: Đổi tên và phân quyền lấy Admin Email ([99_rename_and_update_fleet_get_teamadmin_emails.sql](file:///d:/PM%20-%20PD%20Rev/project/csr-web/backend/database/migrations/99_rename_and_update_fleet_get_teamadmin_emails.sql))
- **Hành động**:
  - Xóa Stored Procedure cũ `usp_Fleet_GetAdminEmails`.
  - Tạo mới Stored Procedure `usp_Fleet_GetTeamAdminEmails` để lấy danh sách email của người dùng có vai trò `TeamAdmin` (thay vì vai trò `Admin`), đảm bảo việc thông báo email điều phối xe được gửi chuẩn xác đến nhóm Quản trị viên đội xe (Team Admin).

---

## 2. Server Backend (Express API)

### 📌 fleet.js
- Cập nhật các API `POST /bookings`, `PUT /bookings/:id`, `PUT /bookings/:id/status` và `GET /bookings/:id` để truyền nhận trực tiếp các tham số chặng (bao gồm thông tin xe/tài xế/người đi cùng của chiều về) sang các Stored Procedure tương ứng.

---

## 3. Client Frontend (React Component)

### 📌 VehicleBookingNew.jsx
- Tái cấu trúc thành **Form đăng ký 3 bước** (Thông tin chung -> Chiều đi -> Chiều về).
- Cho phép người tạo đề xuất xe và tài xế cho **tất cả mọi loại đơn** (bất kể độ ưu tiên). Dữ liệu đề xuất sẽ được gửi lên Backend để lưu giữ.

### 📌 VehicleBookingDetail.jsx
- **Hiển thị xe đề xuất**: Thêm thẻ hiển thị nổi bật dạng màu xanh da trời **💡 Xe Đề Xuất Chiều Đi (Chờ duyệt)** và **💡 Xe Đề Xuất Chiều Về (Chờ duyệt)** khi đơn xe chưa được duyệt gán chính thức.
- **Tự động điền (Pre-populate)**: Khi Team Admin click mở Modal duyệt gán phương tiện, dropdown sẽ tự động nhận diện và chọn sẵn phương án xe & tài xế mà người dùng đã đề xuất trước đó, giúp việc điều xe nhanh chóng chỉ bằng 1 click.

- **Tắt Thông Báo Đơn Đặt Xe Mới**: Theo yêu cầu, đã comment out lời gọi hàm `notifyAdminNewBooking(newBooking, pool)` trong controller `POST /bookings` ở `fleet.js` để vô hiệu hóa hoàn toàn việc gửi email thông báo trống cho Admin khi có đơn đặt xe công tác mới được tạo.
- **Bổ sung MNV vào SharePoint Queue**: Thêm các cột dữ liệu `RequesterMNV` và `MNV` vào payload gửi lên các danh sách hàng đợi duyệt `Fleet_Supervisor_Approval_Queue` và `Fleet_TeamAdmin_Approval_Queue` trong [fleetTeamsApproval.js](file:///d:/PM%20-%20PD%20Rev/project/csr-web/backend/src/utils/fleetTeamsApproval.js), giúp luồng Power Automate nhận diện và hiển thị mã nhân viên của người tạo yêu cầu duyệt xe.

- **Sửa Lỗi Đồng Bộ Team Admin Queue**: Khắc phục lỗi Graph API 400 (`Field 'TeamAdminEmail' is not recognized`) khi đẩy đơn lên `Fleet_TeamAdmin_Approval_Queue`. Lý do vì cột lưu trữ email trên SharePoint List này được định nghĩa là `SupervisorEmail` thay vì `TeamAdminEmail`. Hệ thống đã được chuyển đổi payload sang `SupervisorEmail` để tương thích hoàn toàn.

- **Sửa Lỗi Hiển Thị Lịch Bận Của Xe**: Khắc phục lỗi tất cả các xe đều hiển thị "✓ Trống lịch" trong giao diện tạo mới đặt xe. Nguyên nhân do hàm `fetchVehicleSchedules` ở `VehicleBookingNew.jsx` gọi trực tiếp hàm `fetch` nguyên bản của trình duyệt tới `/api/fleet/bookings/calendar` mà không đính kèm JWT Token trong header. Đã đổi sang sử dụng API client helper `getVehicleCalendar` có sẵn để tự động đính kèm token xác thực.

### 📌 VehicleBookingList.jsx
- **Tái Cấu Trúc Bảng Đặt Xe**: 
  - Đổi tên cột **"Giờ đi"** thành **"Ngày đi"** (giữ nguyên định dạng `dd/MM/yyyy HH:mm`).
  - Bổ sung cột mới **"Ngày về"** (định dạng `dd/MM/yyyy HH:mm`).
  - Loại bỏ 3 cột **"Số khách"**, **"Xe phân công"**, **"Tài xế"** khỏi bảng danh sách.
  - Cập nhật `colSpan` giao diện loading/empty state tương ứng.

### 📌 Job Gửi Email Tự Động Cho Nhà Máy (`fleetNotification.js`)
- **Tự Động Thông Báo Ban Quản Lý Nhà Máy**: Đã bổ sung hàm `sendFactoryNotificationEmail` tự động gửi email cho Ban Quản lý / Nhân sự Nhà máy khi Team Admin phê duyệt & phân xe (`Status = 'Team Admin đã duyệt'`).
- **Điều Kiện Lọc Điểm Đến**: Chỉ gửi email nếu `Destination` khớp với một Nhà máy có cấu hình `NotificationEmails` trong `CSR_Locations` (như `VDC`, `VAC`, `VSN-DN`, `VSPY`,...); nếu điểm đến là Văn phòng hoặc địa điểm ngoài không phải nhà máy, hệ thống tự động bỏ qua.
- **Bố Cục Layout Chuẩn Mẫu**: Email được tạo với bảng màu cam `#e67e22` có tiêu đề `Phòng [Tên phòng] công tác tại [Tên nhà máy]` và chứa đầy đủ 10 dòng chi tiết (Đơn vị, Phòng, Nội dung đi công tác, Địa điểm, Số người đi, Danh sách đi công tác, Ghi chú, Phương tiện, Ngày đi `dd/MM/yyyy`, Ngày về `dd/MM/yyyy`).
- **Phân Bổ Người Nhận**:
  - **To**: Danh sách email thuộc địa điểm nhà máy điểm đến (`NotificationEmails`).
  - **Cc**: Email người tạo phiếu + Email người đi cùng (`AttendeesEmail`) + Email nhóm `TeamAdmin`.

---

## 4. Kết quả kiểm tra & Build
- Biên dịch Frontend bằng Vite: `npm run build` hoàn thành **thành công 100% không có lỗi**.
- Kiểm tra trực tiếp hàm `sendFactoryNotificationEmail` với dữ liệu thực tế: Đã xác nhận gửi thành công qua Microsoft Graph API với danh sách To/Cc và HTML layout chính xác.
- Tiến trình Node.js backend được reload qua PM2 và các migrations SQL Server đã chạy thành công.
