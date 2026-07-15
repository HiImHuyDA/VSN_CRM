# 📋 AI Handoff Context — Nâng Cấp Hệ Thống Fleet & Phê Duyệt Đa Cấp

> File này dùng để bàn giao ngữ cảnh khi chuyển từ AI model này sang AI model khác.
> AI model mới: Hãy đọc kỹ toàn bộ file này trước khi xử lý tiếp, không hỏi lại những gì đã được trả lời ở đây.

---

## 1. Kết Quả Thực Hiện (Accomplishments)
- **Thiết kế Cấu hình xe & Tài xế**: Đã chuyển đổi `VehicleConfig.jsx` từ giao diện 3 cột grid sang giao diện bảng full-width kèm side panel trượt chỉnh sửa chỉ xuất hiện khi cần thiết, đồng bộ phong cách với LocationConfig.
- **Duyệt xe Đa cấp qua Teams**: Thiết lập luồng gửi duyệt 2 cấp qua SharePoint list tích hợp Teams:
  - Cấp 1: Gửi yêu cầu duyệt đến email Giám sát lookup trực tiếp từ danh mục nhân sự.
  - Cấp 2: Sau khi Giám sát duyệt, tự động chuyển tiếp tới Teams của Team Admin để duyệt cuối và phân công xe/tài xế.
- **Tích hợp PRD Approvals trên Teams**: Đơn Brand mới tạo sẽ tự động đẩy yêu cầu phê duyệt cho PRD trên Teams qua SharePoint queue.
- **Chỉnh sửa / Hủy đăng ký xe**: Cho phép chỉnh sửa/hủy đăng ký xe ở các trạng thái chưa hoàn thành (`Chờ phản hồi`, `Giám sát từ chối`, `Team Admin từ chối`, `Team Admin đã duyệt`). Khi sửa đơn, trạng thái tự động reset về `Chờ phản hồi` để Giám sát duyệt lại từ đầu.
- **Database Schema**: Chạy thành công migration SQL:
  - Thêm cột `ManagerEmail` vào `CSR_Employees`.
  - Thêm cột `Module` (CSR, Fleet, All) vào `CSR_Statuses`.
  - Seed các trạng thái mới (Id từ 11 đến 14) tương ứng với các bước duyệt của Giám sát và Team Admin.

## 2. Ngữ Cảnh & Nguyên Nhân (Context & Root Causes)
- **Nguyên nhân thay đổi**: User muốn cải tiến UI của Cấu hình xe để hiển thị bảng dữ liệu rộng rãi hơn, đồng thời tự động hóa quy trình duyệt đăng ký xe qua Teams 2 cấp để giảm bớt thao tác thủ công, hỗ trợ tính năng sửa/hủy đơn linh hoạt.
- **Giải pháp lựa chọn**: Tạo riêng file `fleetTeamsApproval.js` và cập nhật `bodApprovalSync.js` để chạy các job nền quét định kỳ mỗi 30s từ các bảng SharePoint queue, đảm bảo hiệu năng và không chặn các tiến trình khác của hệ thống.

## 3. Trạng Thái Hiện Tại (Current Status)
- [x] Chạy migration SQL 86 nâng cấp DB.
- [x] Redesign layout giao diện màn hình Cấu hình xe & Tài xế.
- [x] Tích hợp luồng duyệt PRD trên Teams.
- [x] Tích hợp luồng duyệt đa cấp Fleet (Giám sát -> Team Admin) trên Teams & Email thông báo.
- [x] Thêm tính năng sửa / hủy đơn xe trên FE và BE.
- [x] Thêm phân quyền Team Admin cho cấu hình Menu Permissions.
- [x] Verify build & compile kiểm tra lỗi cú pháp (Tất cả OK).

## 4. Danh Sách Files Liên Quan
| Đường dẫn File | Mô tả | Trạng thái |
|---|---|---|
| [86_fleet_multi_level_approval.sql](file:///d:/PM%20-%20PD%20Rev/project/csr-web/backend/database/migrations/86_fleet_multi_level_approval.sql) | Script Migration cập nhật cấu trúc database & SP | Đã chạy |
| [fleetTeamsApproval.js](file:///d:/PM%20-%20PD%20Rev/project/csr-web/backend/src/utils/fleetTeamsApproval.js) | Module tích hợp phê duyệt đa cấp và gửi email Fleet qua Teams | Hoàn thành |
| [bodApprovalSync.js](file:///d:/PM%20-%20PD%20Rev/project/csr-web/backend/src/utils/bodApprovalSync.js) | Cập nhật tích hợp phê duyệt PRD | Hoàn thành |
| [submissions.js](file:///d:/PM%20-%20PD%20Rev/project/csr-web/backend/src/routes/submissions.js) | Router tiếp đón - trigger gửi duyệt PRD | Hoàn thành |
| [fleet.js](file:///d:/PM%20-%20PD%20Rev/project/csr-web/backend/src/routes/fleet.js) | Router đặt xe - cập nhật các trạng thái mới & logic sửa đơn | Hoàn thành |
| [app.js](file:///d:/PM%20-%20PD%20Rev/project/csr-web/backend/src/app.js) | Đăng ký khởi chạy các job sync nền của PRD và Fleet | Hoàn thành |
| [VehicleConfig.jsx](file:///d:/PM%20-%20PD%20Rev/project/csr-web/frontend/src/pages/vehicle/VehicleConfig.jsx) | UI Cấu hình xe - chuyển đổi layout trượt | Hoàn thành |
| [VehicleBookingNew.jsx](file:///d:/PM%20-%20PD%20Rev/project/csr-web/frontend/src/pages/vehicle/VehicleBookingNew.jsx) | Form tạo mới / chỉnh sửa đơn đăng ký xe | Hoàn thành |
| [VehicleBookingDetail.jsx](file:///d:/PM%20-%20PD%20Rev/project/csr-web/frontend/src/pages/vehicle/VehicleBookingDetail.jsx) | Drawer xem chi tiết và thực hiện duyệt đơn | Hoàn thành |
| [MenuPermissionsConfig.jsx](file:///d:/PM%20-%20PD%20Rev/project/csr-web/frontend/src/pages/config/MenuPermissionsConfig.jsx) | Bổ sung role TeamAdmin vào ma trận menu phân quyền | Hoàn thành |

## 5. Hướng Dẫn Test & Xác Minh (Verification Details)
- **Kiểm tra build frontend**:
  ```bash
  cd frontend
  npm run build
  ```
- **Kiểm tra nghiệp vụ**:
  1. Tạo đơn đặt xe mới từ giao diện: Trạng thái ban đầu sẽ là `Chờ phản hồi`.
  2. Kiểm tra SharePoint list `Fleet_Supervisor_Approval_Queue` nhận hàng đợi và email thông báo được gửi tới Giám sát.
  3. Khi Giám sát duyệt (ghi kết quả vào `Fleet_Supervisor_Approval_Results`), trạng thái cập nhật thành `Giám sát đã duyệt` và tiếp tục đẩy yêu cầu tới `Fleet_TeamAdmin_Approval_Queue`.
  4. Team Admin thực hiện phân xe và tài xế qua drawer chi tiết trên web hoặc Teams (qua `Fleet_TeamAdmin_Approval_Results`). Đơn chuyển thành `Team Admin đã duyệt` và gửi email thông tin xe & tài xế về cho người đặt.
  5. Bấm nút "Chỉnh sửa" tại đơn xe thuộc các trạng thái cho phép để lưu thay đổi và đưa trạng thái về `Chờ phản hồi`.

---
*Cập nhật lần cuối: 15/07/2026 — bởi: Gemini 3.5 Flash*
