# Quy tắc Ghi nhận Kết Quả Phiên Làm Việc (Session Handoff Rules)

Welcome, Agent! Để đảm bảo duy trì tính liên tục và chuyển giao ngữ cảnh chính xác tuyệt đối giữa các phiên làm việc (khi đổi model AI hoặc bắt đầu phiên mới), bạn **BẮT BUỘC** phải tuân thủ quy tắc sau mà không có ngoại lệ:

---

## 📌 Quy tắc Cốt lõi
Sau mỗi khi hoàn thành một yêu cầu lớn hoặc kết thúc phiên làm việc với User, Agent **PHẢI** tự động tạo hoặc cập nhật tài liệu bàn giao tại đường dẫn:
`d:\PM - PD Rev\project\csr-web\.agents\walkthrough.md` hoặc tạo một file handoff md mới theo mẫu dưới đây.

---

## 📋 Mẫu Báo cáo Bàn giao (Handoff Template)

Mỗi tài liệu bàn giao phải có các phần sau:

```markdown
# 📋 AI Handoff Context — [Tên Nghiệp Vụ / Task]

> File này dùng để bàn giao ngữ cảnh khi chuyển từ AI model này sang AI model khác.
> AI model mới: Hãy đọc kỹ toàn bộ file này trước khi xử lý tiếp, không hỏi lại những gì đã được trả lời ở đây.

---

## 1. Kết Quả Thực Hiện (Accomplishments)
- [Liệt kê chi tiết các tính năng, màn hình đã code xong]
- [Liệt kê các migration database đã chạy]

## 2. Ngữ Cảnh & Nguyên Nhân (Context & Root Causes)
- **Nguyên nhân thay đổi**: [Giải thích lý do kỹ thuật hoặc nghiệp vụ tại sao cần sửa đổi code, ví dụ: "Email không thread được do thiếu MIME Headers chứ không phải do subject RE:"]
- **Giải pháp lựa chọn**: [Lý do lựa chọn cách giải quyết này thay vì các giải pháp khác]

## 3. Trạng Thái Hiện Tại (Current Status)
- [x] Các phần đã hoàn thành 100%
- [/] Các phần đang dở dang
- [ ] Các phần chưa bắt đầu

## 4. Danh Sách Files Liên Quan
| Đường dẫn File | Mô tả | Trạng thái |
|---|---|---|
| | | |

## 5. Hướng Dẫn Test & Xác Minh (Verification Details)
- [Liệt kê câu lệnh chạy test case]
- [Hướng dẫn các bước test tay trên UI]

---
*Cập nhật lần cuối: [Ngày/Giờ] — bởi: [Tên AI Model]*
```

---

## ⚠️ Lưu ý Quan Trọng
- **Không viết inline query**: Nhắc nhở model tiếp theo luôn luôn dùng Stored Procedures cho mọi thao tác database.
- **Giữ sạch sẽ**: Mọi tài liệu bàn giao md phải nằm hoàn toàn trong thư mục `.agents/` theo đúng rule hệ thống.
- **Không hỏi lại**: AI model mới bắt buộc phải đọc file này trước khi tiếp tục công việc.
