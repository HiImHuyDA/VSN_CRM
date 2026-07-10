# Hướng dẫn Sử dụng Hệ thống Quản lý Tiếp Đón Khách Hàng (CSR Web User Guide)

Tài liệu này hướng dẫn người dùng các vai trò (Người yêu cầu, Bộ phận PRD, Ban Giám đốc BOD và Quản trị viên) thực hiện các chức năng chính trên hệ thống tiếp đón khách hàng CSR.

---

## 1. Phân Quyền Người Dùng & Vai Trò

Hệ thống được chia thành 4 nhóm quyền chính:
*   **Người yêu cầu (Submitter)**:
    *   Khai báo và tạo đơn tiếp đón mới (đoàn tiếp đón Brand, Supplier hoặc Partner).
    *   Xem trạng thái đơn do mình tạo, sửa đổi thông tin hoặc hủy đơn khi có thay đổi lịch trình.
*   **Bộ phận PRD (PRD User)**:
    *   Thực hiện thẩm định, kiểm tra và phê duyệt Bước 1 đối với các đơn tiếp đón.
    *   Phân công công việc (Tasks) chi tiết cho từng ngày tiếp đón (Xe cộ, phòng họp, bữa ăn, quà tặng...).
*   **Ban Giám đốc (BOD User)**:
    *   Thực hiện phê duyệt Bước 2 (Phê duyệt cuối cùng) đối với các đơn tiếp khách lớn (đặc biệt là khách Brand).
    *   Duyệt trực tiếp trên Web hoặc duyệt nhanh thông qua liên kết thông báo gửi về Microsoft Teams.
*   **Quản trị viên (Admin)**:
    *   Quản lý danh sách tài khoản, phân quyền.
    *   Cấu hình danh mục dùng chung (danh sách nhà hàng tối, cửa hàng quà tặng, địa điểm, phòng họp, mẫu công việc...).
    *   Theo dõi lịch sử tác động hệ thống (Audit Logs).

---

## 2. Hướng dẫn các Chức năng Chính

### 2.1. Đăng ký Đơn tiếp đón mới (Dành cho Submitter)
1.  Truy cập menu **Tạo Đơn Mới** từ thanh công cụ bên trái.
2.  **Chọn Chế độ Khai báo**:
    *   *Tạo Đơn Tiếp Đón Khách (Brand)*: Dành cho đón tiếp các khách hàng đối tác thương hiệu lớn, đòi hỏi đón tiếp chuẩn chỉ.
    *   *Khai Báo Khách Ra Vào (Supplier/Partner)*: Quy trình giản lược dành cho nhà cung cấp hoặc đối tác ra vào làm việc thông thường.
3.  **Điền Tab 1: Thông tin chung (General Info)**:
    *   *Lưu ý bắt buộc đối với đơn khách Brand*:
        *   Tên khách hàng, chủ đề đón tiếp.
        *   Phải khai báo ít nhất 1 đại diện khách hàng (gồm Họ tên, chức vụ, email, lưu ý ăn uống).
        *   Phải chọn danh sách nhân sự nội bộ (VSN Attendees) tham gia đón tiếp.
        *   Bắt buộc đính kèm tệp tin lịch trình tiếp tiếp (Agenda File) định dạng Word/PDF.
    *   Hệ thống sẽ chặn không cho chuyển sang Tab 2 hoặc bấm Submit nếu thiếu bất kỳ thông tin bắt buộc nào ở trên.
4.  **Điền Tab 2: Lịch trình chi tiết (Agenda details)**:
    *   Khai báo lịch trình theo từng ngày, từng mốc thời gian, địa điểm đón tiếp (Ví dụ: 09:00 - 10:30 đón khách tại Văn phòng, 11:30 - 13:00 ăn trưa...).
5.  Nhấn **Gửi Đơn** để hoàn tất. Trạng thái đơn lúc này sẽ là `Chờ phản hồi` (Chờ PRD duyệt).

### 2.2. Quy trình Phê duyệt & Phân công Công việc (Dành cho PRD)
1.  **Phê duyệt đơn**:
    *   Khi có đơn tiếp đón mới, PRD mở đơn tại menu **Danh sách đơn**, xem thông tin chi tiết đoàn khách và Agenda.
    *   Nhấn **Phê duyệt** để chuyển trạng thái sang `PRD đã duyệt` (đối với khách Brand, hệ thống sẽ tự động kích hoạt thông báo gửi sang Teams cho BOD).
    *   Nếu thông tin chưa khớp, nhấn **Từ chối** và nhập lý do từ chối.
2.  **Phân công công việc (Task Management)**:
    *   Tại tab **Công việc** của Drawer chi tiết đơn, hệ thống tự động sinh ra danh sách công việc mẫu dựa trên Agenda đã khai báo.
    *   PRD thực hiện phân công người chịu trách nhiệm (Assignee) cho từng task.
    *   *Cấu hình Bữa ăn (Meal Task)*:
        *   *Cơm trưa*: Có thể chọn món trong danh sách thực đơn cơm trưa. Nếu ăn trưa ngoài với khách, tick vào checkbox **"Ăn ngoài với khách"** -> dropdown sẽ tự động chuyển sang danh sách nhà hàng ăn tối.
        *   *Nhà hàng tối*: Hệ thống tự động phân tích chức vụ của đoàn khách để hiển thị danh sách **"Gợi ý hàng đầu"** (khớp Level CEO/Director và ẩm thực mong muốn của khách).
        *   Khi chọn một nhà hàng tối, hệ thống hiển thị bảng thông tin chi tiết (Cấp độ Level, Ẩm thực, Không gian, Giá ước tính, Đánh giá/Phản hồi) ngay bên dưới để tham khảo.
    *   PRD cập nhật trạng thái các task sang `Hoàn thành` sau khi đã chuẩn bị xong.

### 2.3. Phê duyệt nhanh từ Microsoft Teams (Dành cho BOD)
1.  Khi đơn tiếp khách được PRD duyệt, BOD sẽ nhận được một thẻ thông báo phê duyệt (Adaptive Card) trong kênh Microsoft Teams của BOD.
2.  Thẻ hiển thị tóm tắt: Mã đơn tiếp khách, Người yêu cầu, Tên khách hàng và Chủ đề.
3.  BOD có thể chọn các hành động:
    *   **Phê duyệt / Từ chối**: Khi click nút, trình duyệt sẽ tự động mở trang chi tiết đơn trên Web. Nếu tài khoản đã đăng nhập có quyền BOD, hệ thống sẽ tự động hiển thị Modal Duyệt/Từ chối để BOD ký duyệt nhanh chỉ trong 1 click.
    *   **Xem chi tiết đơn**: Mở trang web để xem đầy đủ lịch trình chi tiết và danh sách khách trước khi duyệt.

### 2.4. Theo dõi và Hủy đơn tiếp đón
*   **Hủy đơn**: Người yêu cầu có thể chọn **Hủy đơn** đối với đơn tiếp khách của mình nếu lịch trình bị hủy bỏ. Khi hủy, hệ thống yêu cầu nhập rõ lý do hủy.
*   **Xem Lý do hủy**: Đối với các đơn đã hủy, người dùng có thể mở Drawer chi tiết đơn và xem nội dung lý do hủy được hiển thị rõ ràng ngay bên dưới Badge trạng thái `Đã hủy`.

### 2.5. Báo cáo & Xuất dữ liệu Excel
*   Vào menu **Báo cáo & Thống kê** (Dành cho Admin, PRD, BOD) để theo dõi biểu đồ phân tích chi phí tiếp đón thực tế theo bộ phận, theo tháng.
*   Hỗ trợ xuất báo cáo Excel toàn bộ lịch sử đón tiếp để phục vụ đối chiếu chi phí.
