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

---

## 8. Đồng Bộ Hóa Layout Header H1 & Cố Định Header Cột Bảng (Sticky Table Header)

Nhằm tối ưu hóa trải nghiệm người dùng và tạo ra sự thống nhất hoàn hảo về mặt thẩm mỹ giữa các màn hình, các cải tiến layout và cuộn bảng đã được triển khai đồng loạt.

### 8.1. Đồng bộ hóa phông chữ & Thụt lề của Page Headers (H1)
*   **Lấy "Danh sách đơn" làm chuẩn**: Đã loại bỏ các lớp padding thụt lề không đồng đều (như `.page-container` hay `p-6` dư thừa ở các trang con) để các trang đều sử dụng chung một cấu trúc layout chuẩn trực tiếp dưới thẻ main chính: `<div className="w-full">`.
*   **Thống nhất phông chữ và kích thước**: Chuyển đổi toàn bộ thẻ tựa đề trang con về thẻ `<h1>` thống nhất với bộ lớp CSS của "Danh sách đơn": `text-2xl font-bold text-on-surface mb-1` bọc trong một container tiêu đề có cấu trúc flex thống nhất:
    ```jsx
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-end mb-4">
      <div>
        <h1 className="text-2xl font-bold text-on-surface mb-1">[Tên Tựa Đề Trang]</h1>
      </div>
      ...
    </div>
    ```

### 8.2. Cố định Header Cột & Thiết lập vùng cuộn Table Body độc lập
Đã bọc toàn bộ thẻ `<table>` của 11 màn hình sau vào container cuộn độc lập `overflow-y-auto custom-scrollbar max-h-[calc(100vh-340px)]`, đồng thời gán lớp `sticky top-0 z-10 bg-white` (hoặc màu nền phù hợp) cho tất cả các thẻ `<th>` tiêu đề cột để giữ cố định khi cuộn dữ liệu:
1.  **Danh sách đơn** ([SubmissionList.jsx](file:///d:/PM%20-%20PD%20Rev/project/csr-web/frontend/src/pages/SubmissionList.jsx))
2.  **Quản lý công việc** ([TaskManagement.jsx](file:///d:/PM%20-%20PD%20Rev/project/csr-web/frontend/src/pages/TaskManagement.jsx)) - Cuộn cho cả 2 chế độ Kanban & Table.
3.  **Quản lý phản hồi** ([FeedbackManagement.jsx](file:///d:/PM%20-%20PD%20Rev/project/csr-web/frontend/src/pages/FeedbackManagement.jsx)) - Áp dụng cho cả tab thư mời và kết quả đánh giá.
4.  **DS Công việc** ([TaskConfigPage.jsx](file:///d:/PM%20-%20PD%20Rev/project/csr-web/frontend/src/pages/config/TaskConfigPage.jsx))
5.  **DS Địa điểm** ([LocationConfig.jsx](file:///d:/PM%20-%20PD%20Rev/project/csr-web/frontend/src/pages/config/LocationConfig.jsx))
6.  **DS khách hàng** ([CustomerConfig.jsx](file:///d:/PM%20-%20PD%20Rev/project/csr-web/frontend/src/pages/config/CustomerConfig.jsx))
7.  **Email Marketing** ([EmailCampaignConfig.jsx](file:///d:/PM%20-%20PD%20Rev/project/csr-web/frontend/src/pages/config/EmailCampaignConfig.jsx))
8.  **Nhà hàng và thực đơn** ([RestaurantConfig.jsx](file:///d:/PM%20-%20PD%20Rev/project/csr-web/frontend/src/pages/config/RestaurantConfig.jsx))
9.  **Phòng họp** ([MeetingRoomConfig.jsx](file:///d:/PM%20-%20PD%20Rev/project/csr-web/frontend/src/pages/config/MeetingRoomConfig.jsx))
10. **DS tài khoản** ([UserConfig.jsx](file:///d:/PM%20-%20PD%20Rev/project/csr-web/frontend/src/pages/config/UserConfig.jsx))
11. **Lịch sử hệ thống** ([AuditLogs.jsx](file:///d:/PM%20-%20PD%20Rev/project/csr-web/frontend/src/pages/config/AuditLogs.jsx))

---

## 9. Di Chuyển Quản Lý Icon Menu Từ Database Sang Frontend

Để tối ưu hóa cấu trúc dữ liệu, giảm thiểu truy vấn không cần thiết và tăng tính chủ động cho mã nguồn giao diện, cột `Icon` đã được loại bỏ khỏi database và chuyển sang quản lý tĩnh ở frontend.

### 9.1. Thiết lập Mapping Icon ở Frontend
*   Tạo file mới [menuIcons.js](file:///d:/PM%20-%20PD%20Rev/project/csr-web/frontend/src/utils/menuIcons.js) lưu trữ bản đồ ánh xạ tĩnh giữa `MenuKey` và Emoji Icon tương ứng:
    ```javascript
    export const MENU_ICONS = {
      'guest': '💼',
      'guest.dashboard': '🏠',
      'guest.submissions': '📋',
      ...
    };
    ```
*   Cung cấp hàm tiện ích `getMenuIcon(menuKey)` để trả về Emoji Icon (hoặc Icon mặc định `📄` nếu không tìm thấy key).

### 9.2. Cập nhật Components hiển thị Menu
*   **Sidebar**: Nhập hàm `getMenuIcon` từ thư mục `utils` và thay thế việc đọc trực tiếp `item.Icon` từ API bằng `getMenuIcon(item.MenuKey)`.
*   **Phân Quyền Menu (MenuPermissionsConfig)**: Cập nhật tương tự, hiển thị Icon động dựa trên `getMenuIcon(m.MenuKey)`.

### 9.3. Database Migrations (Loại bỏ cột `Icon`)
*   Đã chạy thành công file migration [76_remove_menu_icons.sql](file:///d:/PM%20-%20PD%20Rev/project/csr-web/backend/database/migrations/76_remove_menu_icons.sql):
    1.  Cập nhật Stored Procedure `usp_GetMyMenu` để không truy vấn cột `Icon`.
    2.  Cập nhật Stored Procedure `usp_GetMenuPermissionsMatrix` để không truy vấn cột `Icon`.
    3.  Thực hiện lệnh `ALTER TABLE [dbo].[CSR_Menus] DROP COLUMN [Icon];` để xóa hoàn toàn cột `Icon` khỏi schema bảng trong SQL Server.

---

## 10. Xử Lý Luồng Gửi Email Phê Duyệt & Reply Threading (Outlook Conversation)

Để các email cập nhật (Chỉnh sửa đơn, Hủy đơn) tự động gộp vào cuộc hội thoại (thread) của email phê duyệt ban đầu trong Outlook, cơ chế liên kết MIME Headers đã được thiết lập.

### 10.1. Database Migration: [77_add_approval_email_message_id.sql](file:///d:/PM%20-%20PD%20Rev/project/csr-web/backend/database/migrations/77_add_approval_email_message_id.sql)
*   Thêm cột `ApprovalEmailMessageId NVARCHAR(500) NULL` vào bảng `CSR_Projects`.
*   Tạo Stored Procedure `usp_SaveApprovalEmailMessageId` để lưu trữ Message-ID theo `ParentId` (mã đơn gốc).
*   Tạo Stored Procedure `usp_GetApprovalEmailMessageId` để truy xuất Message-ID phục vụ luồng gửi email trả lời.

### 10.2. Luồng Xử Lý Backend ([approvalNotification.js](file:///d:/PM%20-%20PD%20Rev/project/csr-web/backend/src/utils/approvalNotification.js))
*   **Lưu Message-ID sau khi gửi**: Sau khi gọi `/sendMail` gửi email phê duyệt gốc thành công, hệ thống trì hoãn 1.5 giây để Microsoft Graph cập nhật thư vào thư mục Sent Items, sau đó gọi `GET /users/{sender}/messages` tìm kiếm email theo tiêu đề để lấy thuộc tính `internetMessageId` và lưu vào database.
*   **Liên kết email con**: Khi gửi email cập nhật/hủy đơn, hệ thống đọc `ApprovalEmailMessageId` từ database và thêm các headers sau vào payload gửi thư của Microsoft Graph API:
    ```json
    "internetMessageHeaders": [
      { "name": "In-Reply-To", "value": "<Message-ID>" },
      { "name": "References", "value": "<Message-ID>" }
    ]
    ```
    Điều này ép buộc Outlook và các trình nhận thư gộp tất cả email cập nhật và hủy đơn vào chung một luồng (thread) hội thoại duy nhất với email phê duyệt gốc.

---

## 11. Phân Hệ Quản Lý Xe Công Tác (Fleet Management - Phase 1 MVP)

Triển khai thành công Phân hệ Quản Lý Xe công tác giai đoạn 1, cung cấp đầy đủ quy trình từ cấu hình đội ngũ đến đăng ký lịch trình, phê duyệt và xuất dữ liệu.

### 11.1. Cấu trúc Cơ sở dữ liệu ([78_fleet_management_phase1.sql](file:///d:/PM%20-%20PD%20Rev/project/csr-web/backend/database/migrations/78_fleet_management_phase1.sql))
*   **Các bảng mới**:
    *   `Fleet_VehicleTypes`: Danh mục loại xe (Sedan 4 chỗ, SUV 7 chỗ, Bus 16 chỗ...).
    *   `Fleet_Vehicles`: Quản lý danh sách xe (Biển số xe, Hãng, Dòng xe, Số ghế, Màu sắc, Nhiên liệu, Trạng thái hoạt động/bảo dưỡng).
    *   `Fleet_Drivers`: Danh sách tài xế (Họ tên, SĐT, Bằng lái xe, Trạng thái làm việc).
    *   `Fleet_Bookings`: Đăng ký yêu cầu đặt xe (Mã đặt xe tự động `VE-YYYY-XXXX`, điểm đón, điểm đến, các điểm dừng trung gian, thời gian đi/về, số khách, mục đích, ghi chú, xe và tài xế được phân công).
*   **Stored Procedures**:
    *   `usp_Fleet_Vehicle_Save`, `usp_Fleet_Driver_Save`, `usp_Fleet_VehicleType_Save`: Xử lý thêm mới/chỉnh sửa thông tin danh mục.
    *   `usp_Fleet_Booking_Create`: Tạo mới yêu cầu, tự động sinh mã số và gửi email.
    *   `usp_Fleet_Booking_List`: Truy vấn danh sách có phân trang và bộ lọc chuyên sâu (Từ khóa, Trạng thái, Khoảng ngày).
    *   `usp_Fleet_Booking_UpdateStatus`: Phê duyệt (gán xe & tài xế), Từ chối (lưu lý do), Hủy đơn hoặc Hoàn thành chuyến đi.
    *   `usp_Fleet_Booking_Export`: Lấy dữ liệu không phân trang phục vụ xuất báo cáo.

### 11.2. API Routes và Email Notifications ([fleet.js](file:///d:/PM%20-%20PD%20Rev/project/csr-web/backend/src/routes/fleet.js) & [fleetNotification.js](file:///d:/PM%20-%20PD%20Rev/project/csr-web/backend/src/utils/fleetNotification.js))
*   **API Router**: Đăng ký tại `/api/fleet`, cung cấp đầy đủ endpoints CRUD cho Xe, Tài xế, Danh mục loại xe, Đăng ký đặt xe, Phê duyệt trạng thái và Xuất file Excel.
*   **Email Yêu Cầu Mới**: Khi người dùng gửi yêu cầu xe, hệ thống tự động tìm danh sách Admin (`usp_Fleet_GetAdminEmails`) và gửi email thông báo kèm CC người đặt.
*   **Email Kết Quả Phê Duyệt**: Khi Admin phê duyệt/từ chối, hệ thống gửi thư báo kết quả cho người đặt kèm thông tin biển số xe, tên tài xế và số điện thoại liên lạc.

### 11.3. Giao diện Giao dịch & Cấu hình ở Frontend
*   **Danh Sách Đặt Xe ([VehicleBookingList.jsx](file:///d:/PM%20-%20PD%20Rev/project/csr-web/frontend/src/pages/vehicle/VehicleBookingList.jsx))**:
    *   Giao diện hiển thị dạng bảng thông tin chuẩn đẹp, cuộn độc lập cho table body và cố định tiêu đề cột (`sticky top-0 z-10 bg-surface-container`).
    *   Bộ lọc tìm kiếm đa năng và chức năng xuất Excel trực quan.
*   **Tạo Yêu Cầu Xe ([VehicleBookingNew.jsx](file:///d:/PM%20-%20PD%20Rev/project/csr-web/frontend/src/pages/vehicle/VehicleBookingNew.jsx))**: Form nhập đầy đủ dữ liệu, hỗ trợ nút **Thêm điểm dừng trung gian** động dọc lộ trình.
*   **Chi Tiết & Phê Duyệt ([VehicleBookingDetail.jsx](file:///d:/PM%20-%20PD%20Rev/project/csr-web/frontend/src/pages/vehicle/VehicleBookingDetail.jsx))**: Giao diện Slide-over Side Drawer cao cấp, tích hợp panel gán xe/tài xế từ danh sách xe sẵn sàng hoạt động tại thời điểm duyệt.
*   **Danh Mục Cấu Hình ([VehicleConfig.jsx](file:///d:/PM%20-%20PD%20Rev/project/csr-web/frontend/src/pages/vehicle/VehicleConfig.jsx))**: Quản lý 3 tab dữ liệu (Xe, Tài xế, Loại xe) kèm panel soạn thảo nhanh bên phải.
*   **Tích hợp Route & Menu ([79_fleet_menu_items.sql](file:///d:/PM%20-%20PD%20Rev/project/csr-web/backend/database/migrations/79_fleet_menu_items.sql) & [App.jsx](file:///d:/PM%20-%20PD%20Rev/project/csr-web/frontend/src/App.jsx))**: Ánh xạ menu con `/vehicle` (Danh Sách Đặt Xe), `/vehicle/new` (Tạo Yêu Cầu Xe), `/vehicle/config` (Cấu Hình Xe & Tài Xế) phân quyền role chuẩn xác ở sidebar.

### 11.4. Các Cải Tiến UI/UX & Tính Năng Nâng Cao (Session 2)
*   **Sửa Lỗi Highlight Nhầm Ở Sidebar ([Sidebar.jsx](file:///d:/PM%20-%20PD%20Rev/project/csr-web/frontend/src/components/layout/Sidebar.jsx))**:
    *   Thiết lập thuộc tính `end={true}` cho tất cả `NavLink` để ngăn chặn việc highlight trùng lặp khi truy cập vào đường dẫn con (Ví dụ: Vào `/vehicle/new` không còn bị highlight nhầm `/vehicle` nữa).
    *   **Thụt lề cây thư mục rõ ràng**: Tính toán `paddingLeft` động theo độ sâu (`depth * 16px`) của menu để phân cấp rõ ràng giữa nhóm menu cha (ví dụ: *Quản lý xe*, *Quản lý tiếp khách*) và các chức năng con bên trong khi mở rộng tất cả.
*   **Địa Điểm Đón/Đến Thông Minh với Bản Đồ ([VehicleBookingNew.jsx](file:///d:/PM%20-%20PD%20Rev/project/csr-web/frontend/src/pages/vehicle/VehicleBookingNew.jsx))**:
    *   Tích hợp bộ tìm kiếm và gợi ý địa điểm địa chỉ theo thời gian thực sử dụng API Nominatim (OpenStreetMap) miễn phí.
    *   Khi ô nhập trống, tự động hiển thị danh sách địa điểm hệ thống (bao gồm các nhà máy, văn phòng từ database `/api/system-config/locations`).
*   **Dropdown Loại Phương Tiện & Đặt Xe VIP Tức Thì**:
    *   Cho phép chọn hình thức di chuyển (Xe công ty, Máy bay, Tàu hỏa, Xe khách, Xe thuê ngoài, Tự túc) tương ứng với module tiếp khách.
    *   Khi chọn độ ưu tiên **VIP** & loại **Xe công ty**: Giao diện hiển thị thêm 2 ô Combobox chọn nhanh Xe và Tài xế sẵn sàng. Khi gửi yêu cầu, chuyến đi VIP sẽ tự động lưu thông tin điều phối và chuyển sang trạng thái `Đã duyệt` lập tức, đồng thời gửi email thông báo kết quả.
*   **Danh Sách Người Đi Cùng Phía VSN**:
    *   Chạy file migration `80_add_fleet_booking_attendees.sql` để thêm cột `Attendees` và `AttendeesEmail` vào bảng `Fleet_Bookings`.
    *   Tích hợp bộ tìm kiếm và thêm nhân viên thông minh (`AutocompleteInput`) tương tự như bên Quản lý tiếp khách để tự động điền danh sách tên và email người tham gia đi cùng.
    *   Cập nhật email thông báo và chi tiết Slide Drawer để hiển thị rõ ràng thông tin người đi cùng.
*   **Đồng nhất Font và Kích thước Chữ**:
    *   Loại bỏ các class CSS inline đè kích thước font ở `VehicleBookingNew.jsx`. Giờ đây, các thẻ `input`, `select`, `textarea` kế thừa trực tiếp từ hệ thống class toàn cục `.form-group` của `index.css` (font Inter, kích thước 13.5px, padding 8px 12px), đảm bảo đồng bộ hoàn hảo với màn hình tạo yêu cầu tiếp khách.
*   **Bản đồ thu nhỏ Leaflet & Định vị thông minh**:
    *   Tự động tải tài nguyên CSS & JS của Leaflet từ CDN khi component mount.
    *   Thêm biểu tượng 📍 bản đồ cạnh các ô nhập liệu (Điểm đón, các Điểm dừng dọc đường, Điểm đến chính).
    *   Khi nhấn vào biểu tượng bản đồ, một Modal chứa bản đồ thu nhỏ tương tác sẽ mở ra. Người dùng có thể tìm kiếm địa điểm trên thanh tìm kiếm của bản đồ hoặc click/kéo thả Marker (cắm mốc tọa độ) trực tiếp.
    *   Hệ thống tự động thực hiện reverse-geocoding (lấy tên địa chỉ thực tế từ tọa độ GPS qua API Nominatim) và điền ngược lại vào ô nhập liệu khi người dùng xác nhận vị trí.
*   **Gợi ý địa chỉ & Đồng nhất Giao diện Combobox**:
    *   Áp dụng tính năng tự động gợi ý địa chỉ khi gõ cho cả **các điểm dừng dọc đường (stops)**.
    *   Thay thế dropdown thô sơ bằng lớp CSS `.autocomplete-dropdown` và `.autocomplete-item` đồng bộ với ô tìm kiếm người tham gia. Giao diện mượt mà và chuyển động nhẹ nhàng khi xổ xuống.
*   **Hỗ trợ Tiếng Việt & Độc lập Phiên làm việc (Session) của Dropdown**:
    *   Thêm tham số `&accept-language=vi` vào tất cả các yêu cầu tìm kiếm địa điểm và giải mã tọa độ ngược của Nominatim để trả về kết quả địa chỉ hoàn toàn bằng **Tiếng Việt**.
    *   Tự động đóng tất cả các combobox gợi ý cũ khi mở bản đồ, hoặc khi chuyển sang focus vào ô nhập liệu khác (ví dụ: đang gõ điểm đón mà click điểm đến thì tắt gợi ý điểm đón). Loại bỏ hoàn toàn tình trạng đè giao diện.
*   **Gợi ý Tìm kiếm ngay trên Bản đồ**:
    *   Bổ sung thanh gợi ý tìm kiếm địa chỉ ngay trong popup Modal bản đồ. Khi người dùng nhập địa chỉ tìm kiếm trên bản đồ, một danh sách kết quả autocomplete xổ xuống phía dưới để chọn nhanh, tự động zoom và định vị marker.
*   **Đồng bộ Checkbox theo Rule hệ thống ([rules/checkbox.md](file:///d:/PM%20-%20PD%20Rev/project/csr-web/.agents/rules/checkbox.md))**:
    *   Loại bỏ toàn bộ thẻ `<input type="checkbox">` truyền thống tại trang cấu hình xe ([VehicleConfig.jsx](file:///d:/PM%20-%20PD%20Rev/project/csr-web/frontend/src/pages/vehicle/VehicleConfig.jsx)).
    *   Thay thế bằng việc sử dụng component Radix UI chuẩn hóa (`Checkbox`, `FieldGroup`, `Field`, `FieldLabel`) để đảm bảo đồng bộ hóa hoàn toàn thiết kế hệ thống.
*   **Xử lý lỗi Giới hạn Tải 429 (Too Many Requests)**:
    *   **Tăng Debounce lên 500ms**: Tăng độ trễ phản hồi khi gõ từ 300ms lên 500ms để giảm tần suất gọi API tới máy chủ Nominatim công cộng của OpenStreetMap.
    *   **Giới hạn ký tự tối thiểu**: Chỉ thực hiện gọi API bản đồ khi người dùng gõ từ 3 ký tự trở lên. Nếu dưới 3 ký tự, chỉ hiển thị kết quả lọc từ danh sách địa điểm hệ thống nội bộ.
    *   **Bộ nhớ đệm gợi ý (Cache)**: Tích hợp `suggestionCache` (sử dụng `useRef`) để lưu trữ tất cả các từ khóa đã tìm kiếm thành công. Khi người dùng gõ lại từ khóa cũ, danh sách kết quả được trả về ngay lập tức từ bộ nhớ cache mà không cần gửi request qua mạng.
    *   **Graceful Fallback**: Bắt lỗi Http Status 429 và các lỗi kết nối mạng để tự động chuyển sang hiển thị danh sách địa điểm hệ thống nội bộ, tránh gây treo/lỗi ứng dụng cho người dùng cuối.
*   **Triển khai Hybrid Enterprise Location Cache (Session 3)**:
    *   **Bảng Cơ sở dữ liệu ([81_create_location_master.sql](file:///d:/PM%20-%20PD%20Rev/project/csr-web/backend/database/migrations/81_create_location_master.sql))**: Tạo bảng `LocationMaster` với chỉ mục (Index) hiệu năng cao, tự động đồng bộ tất cả địa điểm hệ thống từ bảng `CSR_Locations` vào làm dữ liệu nền tảng ban đầu.
    *   **Backend Endpoints ([fleet.js](file:///d:/PM%20-%20PD%20Rev/project/csr-web/backend/src/routes/fleet.js))**:
        *   `GET /api/fleet/geocode/suggest`: Tự động tìm kiếm trong bảng `LocationMaster` trước. Nếu không đủ kết quả, gọi tiếp **Google Places Autocomplete API** (nếu cấu hình key) hoặc **Nominatim API** (làm fallback) và trả về kết quả đồng nhất cho Client.
        *   `GET /api/fleet/geocode/resolve`: Giải mã tọa độ Lat/Lng dựa trên địa chỉ hoặc `placeId` từ **Google Place Details / Geocoding APIs** (hoặc **Nominatim**). Khi giải mã thành công, tự động chèn dữ liệu (Insert) vào bảng `LocationMaster` dưới dạng bộ nhớ đệm (Cache) vĩnh viễn.
    *   **Frontend Integration ([VehicleBookingNew.jsx](file:///d:/PM%20-%20PD%20Rev/project/csr-web/frontend/src/pages/vehicle/VehicleBookingNew.jsx))**:
        *   Cập nhật hàm `searchAddress` gọi API `/api/fleet/geocode/suggest` để hiển thị địa chỉ Tiếng Việt chuẩn hóa.
        *   Tích hợp hàm `resolveAddress` gọi API `/api/fleet/geocode/resolve` để tự động kích hoạt tiến trình giải mã & lưu cache ở SQL Server trong nền (Background) ngay khi người dùng chọn một gợi ý trên form.
        *   Cập nhật các luồng tìm kiếm và định vị Marker trên bản đồ trong Modal để sử dụng API phân giải tọa độ từ Backend, bảo mật hoàn toàn Google Maps API Key khỏi Client.

