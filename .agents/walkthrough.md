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

## 3. Sửa Lỗi Lịch Tiếp Khách Cho Đơn Bản Ghi Chỉnh Sửa (RecordType = 2)

### 3.1. Database Migration: [71_fix_project_version_calendar_complete.sql](file:///d:/PM%20-%20PD%20Rev/project/csr-web/backend/database/migrations/71_fix_project_version_calendar_complete.sql)
*   **usp_GetGuestCalendar**: 
    *   Sử dụng subquery/CTE `LatestProjects` lọc phiên bản mới nhất của mỗi đơn hàng (`rn = 1` từ `Version DESC`) thay vì lọc cứng điều kiện `RecordType = 1`.
    *   **Bộ lọc Loại khách hàng**: Tích hợp bộ lọc nhiều lựa chọn `ComboboxMultiple` trên giao diện [GuestCalendar.jsx](file:///d:/PM%20-%20PD%20Rev/project/csr-web/frontend/src/pages/GuestCalendar.jsx) cho phép lọc các loại khách hàng (Brand, Partner, Nhà cung cấp, Khách vãng lai, Ứng viên phỏng vấn) đồng bộ với lịch và bảng thống kê.
*   **usp_Submission_GetDetail**: Cho phép tự động cập nhật Hoàn thành (`StatusId = 7`) đối với cả đơn đã chỉnh sửa (`RecordType IN (1, 2)`).
*   **usp_Submission_List**: Cho phép tự động cập nhật Hoàn thành hàng loạt đối với cả đơn đã chỉnh sửa (`RecordType IN (1, 2)`).

---

## 4. Sửa Lỗi Thống Kê Tổng Quan (Dashboard) Cho Đơn Không Có Task & Lọc Trạng Thái

### 4.1. Database Migration: [72_fix_dashboard_get_stats_version_taskless.sql](file:///d:/PM%20-%20PD%20Rev/project/csr-web/backend/database/migrations/72_fix_dashboard_get_stats_version_taskless.sql)
*   **usp_Dashboard_GetStats**:
    *   Sử dụng bảng tạm `#LatestProjects` để lấy phiên bản mới nhất của mỗi đơn tiếp đón (hỗ trợ các đơn đã chỉnh sửa).
    *   Tạo bảng tạm `#DateDest` gộp ngày đi và địa điểm từ cả 2 nguồn: `CSR_Tasks` (đối với đơn có task) và `AgendaJsonData` (đối với đơn không có task).
    *   Thay thế toàn bộ liên kết `INNER JOIN CSR_Tasks` bằng việc kết nối qua `#DateDest`, từ đó hiển thị và thống kê chính xác các đơn không có task (như Ứng viên phỏng vấn).
    *   Cập nhật tất cả các điều kiện lọc trạng thái của đơn tiếp đón hiển thị trên màn hình Tổng quan thành: **Chờ phản hồi (8), PRD đã duyệt (4), BOD đã duyệt (5) và Hoàn thành (7)**.

---

## 5. Kiểm tra & Tối ưu hóa các Cron Job Tự động

### 5.1. Job tự động gửi mail thông báo khách tới thăm
*   **Cơ chế hoạt động**:
    *   **Khách hàng Brand**: Khi được duyệt, email được gửi tức thời qua `sendApprovalEmail`.
    *   **Khách đặc biệt (Vãng lai, Ra vào, Partner, Phỏng vấn, Supplier)**: Email được lên lịch trì hoãn (`scheduleApprovalEmail`) lưu vào bảng `CSR_ScheduledEmails` và gửi tự động lúc 16:00 chiều của ngày trước ngày đón tiếp thông qua cron job `startScheduledEmailScheduler` chạy mỗi phút.
*   **Gửi cho danh sách địa điểm**: Cả hai luồng gửi tức thời và gửi chậm đều chung hàm xử lý `sendApprovalEmail`. Hàm này tự động quét tất cả địa điểm trong lịch trình (`uniqueDestinations`), tra cứu email liên hệ trong bảng `CSR_Locations` (`SELECT NotificationEmails FROM CSR_Locations WHERE Name = @DestName AND StatusId = 1`) và thêm vào danh sách gửi CC.

### 5.2. Job gửi form đánh giá & Đồng bộ kết quả (CSR Feedback System)
*   **Gửi thư mời tự động**: Cron job `startFeedbackScheduler` chạy lúc 08:30 sáng hàng ngày quét các đơn Brand hoàn thành ngày hôm trước, sinh mã băm token an toàn 64 ký tự và lưu vào `CSR_FeedbackInvitations` đồng thời đẩy sang hàng đợi SharePoint List `CSR_Feedback_Queue` để Power Automate gửi mail.
*   **Đồng bộ kết quả**: Cron job chạy mỗi 5 phút một lần tự động đọc kết quả đánh giá mới từ SharePoint List `CSR_Feedback_Results` đồng bộ về cơ sở dữ liệu local qua stored procedure `usp_SubmitFeedback`, sau đó xóa item đã xử lý trên SharePoint List để tránh xử lý lặp lại.

### 5.3. Job gửi email chiến dịch chào mừng cho khách hàng Brand
*   **Sửa lỗi nghiêm trọng (Bug Fix)**: 
    *   Phát hiện các câu truy vấn SQL trong `campaignScheduler.js` sử dụng cột lỗi `IsActive = 1` (cho bảng `CSR_Tasks`, `CSR_ConfigLists`) và cột `p.Status` (cho bảng `CSR_Projects`).
    *   Đã thực hiện cập nhật toàn diện sang các cột chính xác theo DB schema: `StatusId = 1` và `p.StatusId IN (5, 7)`.
*   **Cơ chế hoạt động**: Chạy định kỳ lúc 08:00 sáng hàng ngày, tự động quét tìm các đơn tiếp đón Brand có ngày bắt đầu tiếp đón cách đúng 7 ngày, so khớp với danh sách template chiến dịch chào mừng (`CSR_EmailCampaignTemplates`) và thực hiện gửi mail chào đón kèm thay thế placeholder tự động qua Microsoft Graph API.

---

## 6. Tái Cấu Trúc Menu Theo Nhóm & Phân Quyền Động

Hệ thống menu đã được cấu trúc lại hoàn toàn dựa trên mô hình động lưu trữ trong cơ sở dữ liệu với 2 bảng liên kết: `CSR_Menus` và `CSR_RolePermissions`.

### 6.1. Cấu trúc Menu mới trong Sidebar
*   **Quản Lý Tiếp Khách** (Menu chính `guest`): Chứa toàn bộ các chức năng nghiệp vụ tiếp đón khách và các chức năng cấu hình danh mục liên quan (DS Công việc, DS Địa điểm, DS Khách hàng, Email Marketing, Nhà hàng, Phòng họp) nằm trong tiểu mục **Cấu hình** con.
*   **Quản Lý Xe** (Menu chính `vehicle`): Trực quan hóa và chứa trang placeholder **Quản Lý Xe** (`/vehicle`).
*   **Cấu hình hệ thống** (Menu chính `system-config` - Chỉ Admin): Chứa các chức năng quản trị hệ thống cốt lõi: DS Tài khoản, Lịch sử hệ thống và Phân quyền Menu.

### 6.2. Trang quản trị Phân Quyền Menu nâng cao (Menu Permissions Config)
*   **Cố định Tiêu đề cột & Cuộn thân bảng (Sticky Header & Scrollable Body)**:
    *   Bọc bảng trong một wrapper `overflow-y-auto max-h-[calc(100vh-220px)]` kèm lớp scrollbar tùy biến (`custom-scrollbar`) giúp giao diện gọn gàng và không làm tràn trang.
    *   Thiết lập thuộc tính `sticky top-0 z-10 bg-surface-container-lowest` cho các thẻ tiêu đề `th` để khi cuộn danh sách menu dài xuống dưới, tiêu đề các vai trò (`BOD`, `PRD`, `User`) vẫn được cố định ở trên cùng giúp dễ quan sát.
*   **Mặc định toàn quyền cho Admin**:
    *   Cập nhật cơ chế ở Database (Migration 74 - `usp_GetMyMenu`): Khi Role của tài khoản là `Admin`, hệ thống sẽ tự động trả về toàn bộ danh sách menu đang hoạt động mà không cần đối chiếu hay kiểm tra bảng `CSR_RolePermissions`.
    *   **Loại bỏ cột cấu hình Admin trên giao diện**: Ẩn/loại bỏ hoàn toàn cột `Admin` trong bảng ma trận phân quyền, chỉ giữ lại các cột cần phân quyền gồm `BOD`, `PRD`, `User`. Điều này vừa giảm dư thừa dữ liệu vừa ngăn ngừa lỗi Admin tự khóa mình khỏi các chức năng quan trọng.
*   **Thiết kế cao cấp (Premium Checkbox UI)**: Thay thế checkbox mặc định của trình duyệt bằng custom checkbox được bo góc nhẹ, viền xám tinh tế, có hiệu ứng chuyển động mượt mà (smooth hover & focus transition), chuyển sang màu xanh lá thương hiệu (`bg-primary`) kèm dấu tích SVG rõ nét và thu nhỏ/phóng to động (`scale-105`) khi được kích hoạt.
*   **Tính năng Thu gọn & Mở rộng toàn bộ (Collapse/Expand All)**:
    *   Hỗ trợ nút bấm **Mở rộng tất cả** và **Thu gọn tất cả** ở góc trên thanh công cụ để người quản trị thao tác nhanh.
    *   Mỗi dòng nhóm menu chính trong bảng (ví dụ: *Quản Lý Tiếp Khách*, *Cấu hình*, *Quản Lý Xe*) đều có icon mũi tên `expand_more` / `chevron_right` bên cạnh để đóng/mở thủ công, ẩn hoặc hiển thị các menu con một cách trực quan.
*   **Lan truyền phân quyền tự động (Cascading Permissions)**:
    *   **Loang xuống (Descendants Cascade)**: Khi tích chọn hoặc bỏ tích phân quyền một Nhóm menu lớn cho một Role, hệ thống sẽ tự động bật hoặc tắt quyền của toàn bộ các menu con trực thuộc bên dưới Role đó và tự động cập nhật xuống cơ sở dữ liệu.
    *   **Kéo lên (Ancestors Cascade)**: Khi Admin tích chọn một menu con bất kỳ cho một Role, hệ thống sẽ tự động tích chọn cả nhóm menu cha tương ứng của nó để đảm bảo hiển thị đúng cấu trúc cây ở Sidebar, tránh lỗi thiếu nhóm.

### 6.3. Tối ưu hóa phông chữ Sidebar
    *   Mỗi dòng nhóm menu chính trong bảng (ví dụ: *Quản Lý Tiếp Khách*, *Cấu hình*, *Quản Lý Xe*) đều có icon mũi tên `expand_more` / `chevron_right` bên cạnh để đóng/mở thủ công, ẩn hoặc hiển thị các menu con một cách trực quan.
*   **Lan truyền phân quyền tự động (Cascading Permissions)**:
    *   **Loang xuống (Descendants Cascade)**: Khi tích chọn hoặc bỏ tích phân quyền một Nhóm menu lớn cho một Role, hệ thống sẽ tự động bật hoặc tắt quyền của toàn bộ các menu con trực thuộc bên dưới Role đó và tự động cập nhật xuống cơ sở dữ liệu.
    *   **Kéo lên (Ancestors Cascade)**: Khi Admin tích chọn một menu con bất kỳ cho một Role, hệ thống sẽ tự động tích chọn cả nhóm menu cha tương ứng của nó để đảm bảo hiển thị đúng cấu trúc cây ở Sidebar, tránh lỗi thiếu nhóm.

### 6.3. Tối ưu hóa phông chữ Sidebar
*   **Kích thước văn bản**: Đã đồng bộ kích thước chữ của mục tiêu nhóm con **Cấu hình** (bên trong nhóm Quản Lý Tiếp Khách) từ cỡ chữ nhỏ `text-xs` lên cỡ chữ chuẩn `text-sm` (`font-semibold text-sm uppercase tracking-wider`) để đồng bộ tuyệt đối về mặt thẩm mỹ với các menu chính khác.

---

## 7. Kết quả Kiểm thử & Biên dịch (Build Status)
*   **Frontend compilation**: Biên dịch và build thành công 100% bằng Vite/Rolldown (`vite build`) chỉ trong **12.63 giây** mà không gặp bất kỳ lỗi nào.
*   **Backend integration**: Các API động kiểm tra quyền (`/api/menus/my-menu`, `/api/menus/permissions-matrix`) chạy trơn tru với stored procedures mới.
*   **PM2 process status**: Đã khởi động lại toàn bộ service thành công.
*   **Kiểm thử Campaign**: Chạy lệnh test `node scripts/tests/run_campaign_check.js` thành công và không còn bất kỳ lỗi truy vấn SQL nào.
*   **Kết quả dữ liệu**: Đơn số `6` (Brand) và đơn số `1` (Ứng viên phỏng vấn) hiển thị chính xác trên cả Lịch tiếp đón và Tổng quan (Dashboard).

