# Hướng dẫn cấu hình Microsoft Power Platform (Sử dụng SharePoint List - Standard License)

Giải pháp này sử dụng **SharePoint List** làm hàng đợi kết nối và **Microsoft Forms** công khai làm trang nhận phản hồi từ khách hàng. Toàn bộ tính năng đều sử dụng **Standard Connector (Miễn phí)** đi kèm tài khoản Microsoft 365 doanh nghiệp cơ bản.

---

## 1. Kiến trúc Giải pháp tổng thể

```
  [Internal CSR Web] 
         │ (Outbound Graph API - Miễn phí)
         ▼
  [SharePoint List: CSR_Feedback_Queue]
         │
         ▼ (Trigger Standard: When an item is created)
  [Power Automate Flow 1] ── Gửi Mail ──> [Khách hàng]
                                              │
                                              ▼ (Điền Form ẩm thực/tiêu chí ẩn danh)
                                        [Microsoft Forms]
                                              │
         ┌────────────────────────────────────┘
         ▼ (Trigger Standard: When a response is submitted)
  [Power Automate Flow 2] (Gom nhiều tiêu chí thành JSON)
         │
         ▼ (Ghi kết quả)
  [SharePoint List: CSR_Feedback_Results]
         ▲
         │ (Cron Job quét định kỳ - Graph API)
  [Internal CSR Web] ──> [SQL Server Nội bộ]
```

---

## 2. Chuẩn bị tài nguyên trên SharePoint (Tạo 2 SharePoint Lists)

Truy cập vào trang SharePoint của doanh nghiệp (SharePoint Site) và tạo 2 danh sách mới từ Blank List:

1.  **Danh sách `CSR_Feedback_Queue`** (Hàng đợi gửi thư mời):
    *   Tạo danh sách, đặt tên là `CSR_Feedback_Queue`.
    *   Thêm các cột (Columns):
        *   `ProjectId` (Single line of text)
        *   `Token` (Single line of text)
        *   `VisitorEmail` (Single line of text)
        *   `VisitorName` (Single line of text)
        *   `HostName` (Single line of text)
        *   `MeetingDate` (Single line of text)
        *   `FeedbackUrl` (Single line of text)
2.  **Danh sách `CSR_Feedback_Results`** (Lưu kết quả phản hồi của khách):
    *   Tạo danh sách, đặt tên là `CSR_Feedback_Results`.
    *   Thêm các cột:
        *   `Token` (Single line of text)
        *   `VisitorName` (Single line of text)
        *   `OverallRating` (Number)
        *   `AnswersJson` (Multiple lines of text) -- Cột quan trọng để lưu điểm số của nhiều tiêu chí dưới dạng JSON
        *   `Comments` (Multiple lines of text)
        *   `SubmittedAt` (Date and time)
        *   `ResponseId` (Single line of text)

---

## 3. Thiết kế Microsoft Forms (Nhiều tiêu chí và Họ tên)

1.  Truy cập [Microsoft Forms](https://forms.office.com) -> chọn **New Form** đặt tên là **Khảo sát chất lượng tiếp đón khách hàng**.
2.  Tạo danh sách các câu hỏi theo thứ tự sau:
    *   **Câu 1 (Text - Bắt buộc)**: Họ và tên của Quý khách.
    *   **Câu 2 (Text - Bắt buộc)**: Mã xác thực (Token). *(Chúng ta sẽ điền tự động câu hỏi này qua URL)*.
    *   **Câu 3 (Rating - Bắt buộc)**: Đánh giá chất lượng chung (Overall Rating) 1 - 5 sao.
    *   **Câu 4 (Rating - Bắt buộc)**: Đánh giá về chất lượng Đón tiếp & Thái độ phục vụ.
    *   **Câu 5 (Rating - Bắt buộc)**: Đánh giá về Chất lượng ẩm thực (Cơm trưa/tối).
    *   **Câu 6 (Rating - Bắt buộc)**: Đánh giá về Trang thiết bị & Phòng họp.
    *   **Câu 7 (Text)**: Ý kiến đóng góp hoặc đề xuất thêm.
3.  **Cấu hình**: Nhấp dấu 3 chấm góc phải -> **Settings** -> Chọn **Anyone can respond** để cho phép khách ngoài truy cập không cần login.
4.  **Điền tự động Token**: Lấy link khảo sát điền trước tham số Token ở câu hỏi số 2, ví dụ:
    `https://forms.office.com/r/xxxx?f2=Token_Value` (với `f2` tương ứng Câu hỏi số 2).

---

## 4. Thiết lập 2 Power Automate Flows (Standard)

### 4.1. Flow 1: Gửi Email Thư Mời
*   **Trigger**: **When an item is created** (SharePoint List `CSR_Feedback_Queue`).
*   **Action**: **Send an email (V2)** (Office 365 Outlook):
    *   **To**: Dynamic content `VisitorEmail`.
    *   **Subject**: `[Khảo sát] Đánh giá chất lượng tiếp đón - Đoàn khách ${VisitorName}`
    *   **Body (HTML)**: Nút bấm trỏ tới đường link Microsoft Forms đã điền trước token:
        `https://forms.office.com/r/xxxx?f2=@{triggerBody()?['Token']}`

---

### 4.2. Flow 2: Xử lý lưu phản hồi từ Forms vào SharePoint List
*   **Trigger**: **When a new response is submitted** (Microsoft Forms).
*   **Action**: **Get response details** (Microsoft Forms).
*   **Action**: **Create item** (SharePoint List `CSR_Feedback_Results`):
    *   **Dữ liệu ghi vào**:
        *   `Title`: `Response`
        *   `Token`: Câu trả lời của Câu 2 (Mã xác thực).
        *   `VisitorName`: Câu trả lời của Câu 1 (Họ tên khách hàng).
        *   `OverallRating`: Câu trả lời của Câu 3 (Đánh giá chung).
        *   `AnswersJson`: Dán chuỗi JSON định dạng dưới đây để **gom tất cả các câu trả lời tiêu chí cụ thể** thành một chuỗi JSON mảng thống nhất:
            ```json
            [
              {"parentId": 1, "name": "Thái độ đón tiếp & phục vụ", "rating": @{outputs('Get_response_details')?['body/r4']}, "comment": ""},
              {"parentId": 1, "name": "Chất lượng ẩm thực (cơm trưa/tối)", "rating": @{outputs('Get_response_details')?['body/r5']}, "comment": ""},
              {"parentId": 3, "name": "Trang thiết bị & Phòng họp", "rating": @{outputs('Get_response_details')?['body/r6']}, "comment": ""}
            ]
            ```
            *(Trong đó: `parentId` tương ứng với ID của nhóm tiêu chí mẹ trong bảng `CSR_FeedbackCriteriaParent` của bạn; `r4`, `r5`, `r6` là Dynamic content tương ứng của Câu hỏi 4, 5, 6 từ Forms).*
        *   `Comments`: Câu trả lời của Câu 7 (Ý kiến đóng góp).
        *   `SubmittedAt`: Dynamic content `Submission time`.
        *   `ResponseId`: Dynamic content `Response Id`.

---

## 5. Quy trình đồng bộ Feedback tại CSR Web nội bộ (Backend Node.js)

1.  **Ghi vào hàng đợi**: Backend dùng Graph API đẩy thư mời vào list `CSR_Feedback_Queue`.
2.  **Đồng bộ kết quả vào SQL Server**:
    *   Cron job backend chạy định kỳ mỗi 5 phút gọi Graph API để lấy các dòng kết quả từ list `CSR_Feedback_Results`.
    *   Với mỗi dòng:
        *   Đọc `Token` và so khớp với bảng `CSR_FeedbackInvitations` trong SQL Server.
        *   Nếu Token hợp lệ và chưa sử dụng, thực hiện lưu kết quả (gọi stored procedure `usp_SubmitFeedback`).
        *   Cập nhật trạng thái Token thành `Completed`.
        *   Gọi API xóa item đã xử lý trên SharePoint List để làm sạch danh sách.

---

## 6. Cấu hình luồng phê duyệt từ xa của BOD (Teams Approvals & SharePoint List - Standard)

Giải pháp này cho phép BOD đi công tác ngoài internet nội bộ vẫn có thể phê duyệt/từ chối đơn tiếp khách Brand một cách an toàn và tức thì thông qua ứng dụng **Microsoft Teams Approvals** trên điện thoại di động/máy tính (Standard License).

### 6.1. Sơ đồ kiến trúc hoạt động
```
 [CSR Web (Nội bộ)] ──(Graph API)──> [SharePoint List: CSR_BOD_Approval_Queue]
                                                    │
                                                    ▼ (Trigger: When an item is created)
                                           [Power Automate Flow]
                                                    │
                                                    ▼ (Start & Wait for Teams Approval)
                                            [BOD duyệt trên Teams]
                                                    │
                                                    ▼ (Ghi nhận kết quả)
 [CSR Web (Nội bộ)] <──(Quét 30s/lần)── [SharePoint List: CSR_BOD_Approval_Results]
```

### 6.2. Tạo 2 SharePoint Lists cho luồng duyệt của BOD
Truy cập SharePoint site của công ty và tạo 2 danh sách từ Blank List:

1.  **Danh sách `CSR_BOD_Approval_Queue`** (Hàng đợi gửi yêu cầu duyệt):
    *   Đặt tên: `CSR_BOD_Approval_Queue`
    *   Thêm các cột (Columns):
        *   `ProjectId` (Single line of text)
        *   `BOD_Email` (Single line of text)
        *   `Team` (Single line of text)
        *   `MeetingTopic` (Single line of text)
        *   `Destination` (Single line of text)
        *   `CustomerName` (Single line of text)
        *   `GuestReps` (Multiple lines of text)
        *   `MeetingDate` (Single line of text)
        *   `AgendaText` (Multiple lines of text)
2.  **Danh sách `CSR_BOD_Approval_Results`** (Lưu kết quả phê duyệt của BOD):
    *   Đặt tên: `CSR_BOD_Approval_Results`
    *   Thêm các cột:
        *   `ProjectId` (Single line of text)
        *   `ApprovalOutcome` (Single line of text) - Lưu giá trị `'Approve'` hoặc `'Reject'`
        *   `BOD_Comments` (Multiple lines of text) - Lưu ý kiến phê duyệt/từ chối của BOD

### 6.3. Thiết lập Power Automate Flow duyệt đơn BOD (Standard)
Tạo một Automated Cloud Flow mới trên Power Automate:

1.  **Trigger**: **When an item is created** (SharePoint List `CSR_BOD_Approval_Queue`).
2.  **Action 1**: **Start and wait for an approval** (Approvals Connector):
    *   **Approval Type**: `Approve/Reject - First to respond`
    *   **Title**: `[CSR Approval] Duyệt lịch tiếp khách Brand - ${CustomerName}` (Dùng Dynamic content `CustomerName`)
    *   **Assigned To**: `{BOD_Email}` (Chọn Dynamic content `BOD_Email` lấy từ SharePoint List hàng đợi)
    *   **Details**: Copy đoạn nội dung định dạng Markdown dưới đây vào phần chi tiết:
        ```markdown
        Hi bạn,
        Đăng ký lịch tiếp khách đã được gửi tới bạn duyệt.

        **Thông tin chi tiết:**
        *   **Team:** @{triggerBody()?['Team']}
        *   **Nội dung tiếp đón:** @{triggerBody()?['MeetingTopic']}
        *   **Địa điểm tiếp đón:** @{triggerBody()?['Destination']}
        *   **Khách hàng:** @{triggerBody()?['CustomerName']}
        *   **Thông tin khách hàng:** @{triggerBody()?['GuestReps']}
        *   **Ngày tiếp đón:** @{triggerBody()?['MeetingDate']}
        *   **Thông tin lịch trình:** @{triggerBody()?['AgendaText']}

        Trân trọng,
        ```
3.  **Action 2**: **Create item** (SharePoint List `CSR_BOD_Approval_Results`):
    *   **ProjectId**: `{ProjectId}` (Dynamic content từ Trigger)
    *   **ApprovalOutcome**: `{Outcome}` (Dynamic content từ kết quả Action 1)
    *   **BOD_Comments**: `{Responses Comments}` (Dynamic content bình luận của BOD từ Action 1)
4.  **Action 3**: **Delete item** (SharePoint List `CSR_BOD_Approval_Queue`):
    *   **Id**: `{Id}` (Dynamic content Id của item queue từ Trigger) để làm sạch hàng đợi.

### 6.4. Cơ chế tự động quét đồng bộ ở CRM nội bộ (30 giây/lần)
*   **Ghi hàng đợi duyệt**: Khi PRD phê duyệt đơn Brand thành công trên Web, backend tự động lấy thông tin chi tiết đơn, trích xuất lịch trình Agenda thành chuỗi text, và dùng Graph API chèn một dòng yêu cầu duyệt vào list `CSR_BOD_Approval_Queue` để kích hoạt flow trên Teams của BOD.
*   **Đồng bộ kết quả về SQL Server**: 
    *   Cron job của backend chạy ngầm mỗi 30 giây quét list `CSR_BOD_Approval_Results`.
    *   Nếu có phản hồi của BOD:
        *   Nếu là `'Approve'`: Gọi Stored Procedure `usp_ApproveSubmission` chuyển trạng thái thành `BOD đã duyệt`, đồng thời chạy tiếp các tác vụ sau duyệt (đặt lịch họp, gửi mail, sync xe ra vào cổng,...).
        *   Nếu là `'Reject'`: Gọi Stored Procedure `usp_RejectSubmission` chuyển trạng thái thành `BOD từ chối`.
        *   Xóa item kết quả trên SharePoint List `CSR_BOD_Approval_Results` để dọn dẹp bộ nhớ hàng đợi.
