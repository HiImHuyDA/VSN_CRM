// src/data/staticConfig.js
// Chuyển đổi từ data/datalist.py Python

const taskData = [
  // VDC
  { Destination: "VDC", TaskName: "Bảng chào", DefaultAssignee: "VDC - Team hành chính Chị Hoa", DefaultAssigneeEmail: "nhansuvietduc@vietsuntx.com;tam.vo@vietsuntx.com;kieu.le@vietsuntx.com;tien.nguyen@vietsuntx.com", TaskDetail: "Chuẩn bị bảng chào mở sẵn phòng họp khi khách đến", DefaultSupervisor: "Ms.Hoa", DefaultSupervisorEmail: "hoa.le@vietsuncorp.com.vn;vsn.dn.qms@vietsuntx.com;quan.le@vietsuntx.com;thuyvan.mai@vietsuntx.com", Compulsory: "", LeadTime: 1 },
  { Destination: "VDC", TaskName: "Chuẩn bị cơm trưa", DefaultAssignee: "VDC - Team hành chính Chị Hoa", DefaultAssigneeEmail: "nhansuvietduc@vietsuntx.com;tam.vo@vietsuntx.com;kieu.le@vietsuntx.com;tien.nguyen@vietsuntx.com", TaskDetail: "", DefaultSupervisor: "Ms.Hoa", DefaultSupervisorEmail: "hoa.le@vietsuncorp.com.vn;", Compulsory: "", LeadTime: 1 },
  { Destination: "VDC", TaskName: "Chuẩn bị Mẫu theo nội dung họp", DefaultAssignee: "VDC - Anh Huy giám đốc nhà máy", DefaultAssigneeEmail: "huy.do@vietsuncorp.com.vn", TaskDetail: "Tổ chức chuẩn bị hàng hoá sẵn sàng cho khách kiểm", DefaultSupervisor: "", DefaultSupervisorEmail: "", Compulsory: "", LeadTime: 1 },
  { Destination: "VDC", TaskName: "Chuẩn bị hiện trường", DefaultAssignee: "VDC - Team Hành chính Chị Hoa", DefaultAssigneeEmail: "nhansuvietduc@vietsuntx.com;tam.vo@vietsuntx.com;kieu.le@vietsuntx.com;tien.nguyen@vietsuntx.com", TaskDetail: "Chuẩn bị hiện trường nhà máy đảm bảo khách viếng thăm", DefaultSupervisor: "Ms.Hoa", DefaultSupervisorEmail: "hoa.le@vietsuncorp.com.vn;vsn.dn.qms@vietsuntx.com;quan.le@vietsuntx.com;thuyvan.mai@vietsuntx.com", Compulsory: "", LeadTime: 1 },
  { Destination: "VDC", TaskName: "Trình bày profile VDC", DefaultAssignee: "", DefaultAssigneeEmail: "", TaskDetail: "Chuẩn bị file VDC profile", DefaultSupervisor: "", DefaultSupervisorEmail: "", Compulsory: "", LeadTime: 2 },
  { Destination: "VDC", TaskName: "Book nhà hàng ăn tối", DefaultAssignee: "VSN - Team hành chính Chị Mai", DefaultAssigneeEmail: "hanhchinh@vietsuntx.com", TaskDetail: "", DefaultSupervisor: "", DefaultSupervisorEmail: ";", Compulsory: "", LeadTime: 1 },
  { Destination: "VDC", TaskName: "Phòng họp", DefaultAssignee: "VDC - Team hành chính Chị Hoa", DefaultAssigneeEmail: "nhansuvietduc@vietsuntx.com;tam.vo@vietsuntx.com;kieu.le@vietsuntx.com;tien.nguyen@vietsuntx.com", TaskDetail: "", DefaultSupervisor: "Ms.Hoa", DefaultSupervisorEmail: "hoa.le@vietsuncorp.com.vn;", Compulsory: "", LeadTime: 1 },
  { Destination: "VDC", TaskName: "Chuẩn bị xe", DefaultAssignee: "VSN - Team hành chính Chị Mai", DefaultAssigneeEmail: "hanhchinh@vietsuntx.com", TaskDetail: "", DefaultSupervisor: "", DefaultSupervisorEmail: ";", Compulsory: "", LeadTime: 2 },
  { Destination: "VDC", TaskName: "Chuẩn bị nội dung họp/Sample", DefaultAssignee: "", DefaultAssigneeEmail: "", TaskDetail: "", DefaultSupervisor: "", DefaultSupervisorEmail: "", Compulsory: "", LeadTime: 5 },
  { Destination: "VDC", TaskName: "Chuẩn bị khác", DefaultAssignee: "Ms.Hoa", DefaultAssigneeEmail: "hoa.le@vietsuncorp.com.vn", TaskDetail: "", DefaultSupervisor: "", DefaultSupervisorEmail: "", Compulsory: "", LeadTime: 2 },
  // VSDN
  { Destination: "VSDN", TaskName: "Bảng chào", DefaultAssignee: "VDC - Team hành chính Chị Hoa", DefaultAssigneeEmail: "nhansuvietduc@vietsuntx.com;tam.vo@vietsuntx.com;kieu.le@vietsuntx.com", TaskDetail: "Chuẩn bị bảng chào mở sẵn phòng họp khi khách đến", DefaultSupervisor: "Ms.Hoa", DefaultSupervisorEmail: "hoa.le@vietsuncorp.com.vn;vsn.dn.qms@vietsuntx.com;quan.le@vietsuntx.com;thuyvan.mai@vietsuntx.com", Compulsory: "Y", LeadTime: 1 },
  { Destination: "VSDN", TaskName: "Chuẩn bị cơm trưa", DefaultAssignee: "VDC - Team hành chính Chị Hoa", DefaultAssigneeEmail: "nhansuvietduc@vietsuntx.com;tam.vo@vietsuntx.com;kieu.le@vietsuntx.com", TaskDetail: "", DefaultSupervisor: "Ms.Hoa", DefaultSupervisorEmail: "hoa.le@vietsuncorp.com.vn", Compulsory: "", LeadTime: 1 },
  { Destination: "VSDN", TaskName: "Chuẩn bị Mẫu theo nội dung họp", DefaultAssignee: "VDC - Anh Huy giám đốc nhà máy", DefaultAssigneeEmail: "huy.do@vietsuncorp.com.vn", TaskDetail: "Tổ chức chuẩn bị hàng hoá sẵn sàng cho khách kiểm", DefaultSupervisor: "", DefaultSupervisorEmail: "vsn.dn.qms@vietsuntx.com;quan.le@vietsuntx.com;thuyvan.mai@vietsuntx.com", Compulsory: "", LeadTime: 1 },
  { Destination: "VSDN", TaskName: "Chuẩn bị hiện trường", DefaultAssignee: "VDC - Team Hành chính Chị Hoa", DefaultAssigneeEmail: "nhansuvietduc@vietsuntx.com;tam.vo@vietsuntx.com;kieu.le@vietsuntx.com", TaskDetail: "Chuẩn bị hiện trường nhà máy đảm bảo khách viếng thăm", DefaultSupervisor: "Ms.Hoa", DefaultSupervisorEmail: "hoa.le@vietsuncorp.com.vn;vsn.dn.qms@vietsuntx.com;quan.le@vietsuntx.com;thuyvan.mai@vietsuntx.com", Compulsory: "Y", LeadTime: 1 },
  { Destination: "VSDN", TaskName: "Trình bày profile VSDN", DefaultAssignee: "", DefaultAssigneeEmail: "", TaskDetail: "Chuẩn bị file VSDN profile", DefaultSupervisor: "", DefaultSupervisorEmail: "", Compulsory: "", LeadTime: 2 },
  { Destination: "VSDN", TaskName: "Book nhà hàng ăn tối", DefaultAssignee: "VSN - Team hành chính Chị Mai", DefaultAssigneeEmail: "hanhchinh@vietsuntx.com", TaskDetail: "", DefaultSupervisor: "", DefaultSupervisorEmail: "", Compulsory: "", LeadTime: 1 },
  { Destination: "VSDN", TaskName: "Phòng họp", DefaultAssignee: "VDC - Team hành chính Chị Hoa", DefaultAssigneeEmail: "nhansuvietduc@vietsuntx.com;tam.vo@vietsuntx.com;kieu.le@vietsuntx.com", TaskDetail: "", DefaultSupervisor: "Ms.Hoa", DefaultSupervisorEmail: "hoa.le@vietsuncorp.com.vn", Compulsory: "Y", LeadTime: 1 },
  { Destination: "VSDN", TaskName: "Chuẩn bị xe", DefaultAssignee: "VSN - Team hành chính Chị Mai", DefaultAssigneeEmail: "hanhchinh@vietsuntx.com", TaskDetail: "", DefaultSupervisor: "", DefaultSupervisorEmail: "", Compulsory: "", LeadTime: 2 },
  { Destination: "VSDN", TaskName: "Chuẩn bị nội dung họp/Sample", DefaultAssignee: "", DefaultAssigneeEmail: "", TaskDetail: "", DefaultSupervisor: "", DefaultSupervisorEmail: "vsn.dn.qms@vietsuntx.com;quan.le@vietsuntx.com;thuyvan.mai@vietsuntx.com", Compulsory: "Y", LeadTime: 5 },
  // VAC
  { Destination: "VAC", TaskName: "Bảng chào", DefaultAssignee: "VDC - Team hành chính ", DefaultAssigneeEmail: "duyen.nhu@vietsuntx.com;trinh.bui@vietsuntx.com ", TaskDetail: "Chuẩn bị bảng chào mở sẵn phòng họp khi khách đến", DefaultSupervisor: "Ms.Hoa", DefaultSupervisorEmail: "hoa.le@vietsuncorp.com.vn;", Compulsory: "", LeadTime: 1 },
  { Destination: "VAC", TaskName: "Chuẩn bị cơm trưa", DefaultAssignee: "Ms. Duệ", DefaultAssigneeEmail: "due.tran@vietsuntx.com", TaskDetail: "", DefaultSupervisor: "Ms.Hoa", DefaultSupervisorEmail: "hoa.le@vietsuncorp.com.vn;", Compulsory: "", LeadTime: 1 },
  { Destination: "VAC", TaskName: "Chuẩn bị Mẫu theo nội dung họp", DefaultAssignee: "VDC - Anh Huy giám đốc nhà máy", DefaultAssigneeEmail: "huy.do@vietsuncorp.com.vn", TaskDetail: "Tổ chức chuẩn bị hàng hoá sẵn sàng cho khách kiểm", DefaultSupervisor: "", DefaultSupervisorEmail: "", Compulsory: "", LeadTime: 1 },
  { Destination: "VAC", TaskName: "Chuẩn bị hiện trường", DefaultAssignee: "Ms.Trinh ", DefaultAssigneeEmail: "trinh.bui@vietsuntx.com", TaskDetail: "Chuẩn bị hiện trường nhà máy đảm bảo khách viếng thăm", DefaultSupervisor: "Ms.Hoa", DefaultSupervisorEmail: "hoa.le@vietsuncorp.com.vn;", Compulsory: "", LeadTime: 1 },
  { Destination: "VAC", TaskName: "Trình bày profile VAC", DefaultAssignee: "", DefaultAssigneeEmail: "", TaskDetail: "Chuẩn bị file VAC profile", DefaultSupervisor: "", DefaultSupervisorEmail: "", Compulsory: "", LeadTime: 2 },
  { Destination: "VAC", TaskName: "Book nhà hàng ăn tối", DefaultAssignee: "VSN - Team hành chính Chị Mai", DefaultAssigneeEmail: "hanhchinh@vietsuntx.com", TaskDetail: "", DefaultSupervisor: "", DefaultSupervisorEmail: ";", Compulsory: "", LeadTime: 1 },
  { Destination: "VAC", TaskName: "Phòng họp", DefaultAssignee: "Ms. Duệ", DefaultAssigneeEmail: "due.tran@vietsuntx.com", TaskDetail: "", DefaultSupervisor: "Ms.Hoa", DefaultSupervisorEmail: "hoa.le@vietsuncorp.com.vn;", Compulsory: "", LeadTime: 1 },
  { Destination: "VAC", TaskName: "Chuẩn bị xe", DefaultAssignee: "VSN - Team hành chính Chị Mai", DefaultAssigneeEmail: "hanhchinh@vietsuntx.com", TaskDetail: "", DefaultSupervisor: "", DefaultSupervisorEmail: ";", Compulsory: "", LeadTime: 2 },
  { Destination: "VAC", TaskName: "Chuẩn bị nội dung họp/Sample", DefaultAssignee: "", DefaultAssigneeEmail: "", TaskDetail: "", DefaultSupervisor: "", DefaultSupervisorEmail: "", Compulsory: "", LeadTime: 5 },
  { Destination: "VAC", TaskName: "Chuẩn bị khác", DefaultAssignee: "Ms.Hoa", DefaultAssigneeEmail: "hoa.le@vietsuncorp.com.vn", TaskDetail: "", DefaultSupervisor: "", DefaultSupervisorEmail: "", Compulsory: "", LeadTime: 2 },
  // VSN-NT
  { Destination: "VSN-NT", TaskName: "Chuẩn bị hiện trường", DefaultAssignee: "Anh Thảo - Hành Chính VSNT", DefaultAssigneeEmail: "thao.nguyen@vietsuntx.com", TaskDetail: "Chuẩn bị hiện trường nhà máy đảm bảo khách viếng thăm", DefaultSupervisor: "Ms.Phương", DefaultSupervisorEmail: "phuong.tran@vietsuntx.com;", Compulsory: "", LeadTime: 1 },
  { Destination: "VSN-NT", TaskName: "Chuẩn bị xe (từ sân bay)", DefaultAssignee: "Anh Thảo - Hành Chính VSNT", DefaultAssigneeEmail: "thao.nguyen@vietsuntx.com", TaskDetail: "", DefaultSupervisor: "Ms.Phương", DefaultSupervisorEmail: "phuong.tran@vietsuntx.com;", Compulsory: "", LeadTime: 1 },
  { Destination: "VSN-NT", TaskName: "Book vé máy bay", DefaultAssignee: "Chị Mai - Hành chính Vietsun", DefaultAssigneeEmail: "hanhchinh@vietsuntx.com", TaskDetail: "", DefaultSupervisor: "", DefaultSupervisorEmail: ";", Compulsory: "", LeadTime: 14 },
  { Destination: "VSN-NT", TaskName: "Chuẩn bị xe (Từ VSN đi VSN-NT)", DefaultAssignee: "Chị Mai - Hành chính Vietsun", DefaultAssigneeEmail: "hanhchinh@vietsuntx.com", TaskDetail: "", DefaultSupervisor: "", DefaultSupervisorEmail: ";", Compulsory: "", LeadTime: 2 },
  { Destination: "VSN-NT", TaskName: "Chuẩn bị cơm trưa", DefaultAssignee: "Anh Thảo - Hành Chính VSNT", DefaultAssigneeEmail: "thao.nguyen@vietsuntx.com", TaskDetail: "", DefaultSupervisor: "Ms.Phương", DefaultSupervisorEmail: "phuong.tran@vietsuntx.com;", Compulsory: "", LeadTime: 1 },
  { Destination: "VSN-NT", TaskName: "Phòng họp", DefaultAssignee: "Anh Thảo - Hành Chính VSNT", DefaultAssigneeEmail: "thao.nguyen@vietsuntx.com", TaskDetail: "", DefaultSupervisor: "Ms.Phương", DefaultSupervisorEmail: "phuong.tran@vietsuntx.com;", Compulsory: "", LeadTime: 1 },
  { Destination: "VSN-NT", TaskName: "Chuẩn bị Mẫu theo nội dung họp", DefaultAssignee: "Giám đốc VSNT", DefaultAssigneeEmail: "long.tu@vietsuncorp.com.vn", TaskDetail: "Tổ chức chuẩn bị hàng hoá sẵn sàng cho khách kiểm", DefaultSupervisor: "Mr. Quang", DefaultSupervisorEmail: "quang.le@vietsuncorp.com.vn", Compulsory: "", LeadTime: 1 },
  { Destination: "VSN-NT", TaskName: "Bảng chào", DefaultAssignee: "Anh Thảo - Hành Chính VSNT", DefaultAssigneeEmail: "thao.nguyen@vietsuntx.com", TaskDetail: "Chuẩn bị bảng chào mở sẵn phòng họp khi khách đến", DefaultSupervisor: "Ms.Phương", DefaultSupervisorEmail: "phuong.tran@vietsuntx.com;", Compulsory: "", LeadTime: 2 },
  { Destination: "VSN-NT", TaskName: "Trình bày profile VSN-NT", DefaultAssignee: "", DefaultAssigneeEmail: "", TaskDetail: "Chuẩn bị file VSN-NT profile", DefaultSupervisor: "", DefaultSupervisorEmail: "", Compulsory: "", LeadTime: 2 },
  { Destination: "VSN-NT", TaskName: "Chuẩn bị nội dung họp/Sample", DefaultAssignee: "Giám đốc VSNT", DefaultAssigneeEmail: "long.tu@vietsuncorp.com.vn", TaskDetail: "", DefaultSupervisor: "", DefaultSupervisorEmail: "", Compulsory: "", LeadTime: 5 },
  { Destination: "VSN-NT", TaskName: "Book nhà hàng ăn tối", DefaultAssignee: "Anh Thảo - Hành Chính VSNT", DefaultAssigneeEmail: "thao.nguyen@vietsuntx.com", TaskDetail: "", DefaultSupervisor: "Ms.Phương", DefaultSupervisorEmail: "phuong.tran@vietsuntx.com;", Compulsory: "", LeadTime: 1 },
  { Destination: "VSN-NT", TaskName: "Chuẩn bị khác", DefaultAssignee: "Ms.Phương", DefaultAssigneeEmail: "phuong.tran@vietsuntx.com", TaskDetail: "", DefaultSupervisor: "Giám đốc VSNT", DefaultSupervisorEmail: "long.tu@vietsuncorp.com.vn;", Compulsory: "", LeadTime: 2 },
  // VSN OFFICE
  { Destination: "VSN OFFICE", TaskName: "Bảng chào", DefaultAssignee: "Ms. Thuý Quỳnh", DefaultAssigneeEmail: "thuyquynh.le@vietsuncorp.com.vn", TaskDetail: "Làm bảng chào, chiếu tivi + phòng họp ngày khách đến", DefaultSupervisor: "", DefaultSupervisorEmail: "", Compulsory: "", LeadTime: 2 },
  { Destination: "VSN OFFICE", TaskName: "Chuẩn bị nội dung họp/Sample", DefaultAssignee: "", DefaultAssigneeEmail: "", TaskDetail: "", DefaultSupervisor: "Ms. Thuý Quỳnh", DefaultSupervisorEmail: "thuyquynh.le@vietsuncorp.com.vn", Compulsory: "", LeadTime: 5 },
  { Destination: "VSN OFFICE", TaskName: "Book Phòng Họp", DefaultAssignee: "", DefaultAssigneeEmail: "", TaskDetail: "", DefaultSupervisor: "", DefaultSupervisorEmail: "", Compulsory: "", LeadTime: 2 },
  { Destination: "VSN OFFICE", TaskName: "Chuẩn bị phòng họp", DefaultAssignee: "Chị Mai - Hành chính Vietsun", DefaultAssigneeEmail: "hanhchinh@vietsuntx.com", TaskDetail: "Chuẩn bị nước, trà, và cà phê", DefaultSupervisor: "", DefaultSupervisorEmail: "", Compulsory: "", LeadTime: 2 },
  { Destination: "VSN OFFICE", TaskName: "Chuẩn bị cơm trưa", DefaultAssignee: "Chị Mai - Hành chính Vietsun", DefaultAssigneeEmail: "hanhchinh@vietsuntx.com", TaskDetail: "", DefaultSupervisor: "", DefaultSupervisorEmail: "", Compulsory: "", LeadTime: 2 },
  { Destination: "VSN OFFICE", TaskName: "Chuẩn bị xe", DefaultAssignee: "Chị Mai - Hành chính Vietsun", DefaultAssigneeEmail: "hanhchinh@vietsuntx.com", TaskDetail: "", DefaultSupervisor: "", DefaultSupervisorEmail: "", Compulsory: "", LeadTime: 2 },
  { Destination: "VSN OFFICE", TaskName: "Book nhà hàng ăn tối", DefaultAssignee: "Chị Mai - Hành chính Vietsun", DefaultAssigneeEmail: "hanhchinh@vietsuntx.com", TaskDetail: "", DefaultSupervisor: "", DefaultSupervisorEmail: "", Compulsory: "", LeadTime: 1 },
  { Destination: "VSN OFFICE", TaskName: "Trình bày profile VSN", DefaultAssignee: "Ms. Thuý Quỳnh", DefaultAssigneeEmail: "thuyquynh.le@vietsuncorp.com.vn", TaskDetail: "VSN Profile Presentation + Office Tour", DefaultSupervisor: "Ms. Quỳnh", DefaultSupervisorEmail: "quynh.nguyen@vietsuncorp.com.vn", Compulsory: "", LeadTime: 2 },
  { Destination: "VSN OFFICE", TaskName: "Chuẩn bị khác", DefaultAssignee: "Chị Mai - Hành chính Vietsun", DefaultAssigneeEmail: "hanhchinh@vietsuntx.com", TaskDetail: "", DefaultSupervisor: "", DefaultSupervisorEmail: "", Compulsory: "", LeadTime: 2 },
];

const customerNames = [
  "ASICS", "ACTIVE", "AWG", "AJUNGILAK", "ARCTERYX",
  "BARBOUR", "CANIFA", "DECATHLON", "EDDIE BAUER", "FJALLRAVEN", "HACKETT",
  "HAGLOFS", "HENRI LLOYD", "MAMMUT", "NORRONA", "ODLO", "REISS",
  "ROHAN", "ROSSIGNOL", "TALBOTS", "TALA", "WITT", "FRILUFTS", "POC",
  "PEAK PERFORMANCE", "NEW BRAND"
];

const partnerNames = [
  "Thuế HCM", "Thuế Khánh Hoà", "Thuế Đắk Lắk", "Thuế Đồng Nai",
  "Hải quan HCM", "Hải quan Đồng Nai", "Hải Quan Khánh Hoà",
  "CA Phòng Cháy chữa cháy HCM"
];

const destinationList = ["VSN OFFICE", "VAC", "VDC", "VSDN", "VSN-NT", "VSPY", "Khác"];

const lunchList = [
  "Ăn theo phần ăn nhân viên", "Phở Gà + chả giò", "Phở Bò + chả giò",
  "Phở Tái + chả giò", "Bún Bò + chả giò", "Bún Chả + chả giò",
  "Chả Nem + chả giò", "Mì Quảng Cá + chả giò", "Mì Quảng Gà + chả giò",
  "Mì Quảng Sườn + chả giò", "Hủ Tiếu Xương + chả giò", "Hủ Tiếu Thịt Heo + chả giò",
  "Bánh Canh Cua + chả giò", "Cơm tấm thịt ba rọi + chả giò", "Cơm tấm sườn + chả giò",
  "Cơm Việt: Chả giò, cá kho, rau xào/luộc, canh",
  "Cơm Việt: Chả giò, sườn kho, rau xào/luộc, canh",
  "Cơm gà + gỏi gà", "Chay: Bún Thái, chả giò", "Chay: Hủ tiếu, chả giò",
  "Chay: Bún riêu, cả giò", "Chay: cơm nấm kho, chả giò, rau xào/luộc, canh",
  "Ăn ngoài với khách"
];

const dinnerList = [
  "Âu-Shri-72-74 Nguyễn Thị Minh Khai , Q1",
  "Âu-Sol-115 Lý Tự Trọng, Bến Thành Q 1",
  "Âu-Elgaucho-66 Lê Lợi , Bến Nghé Quận 1",
  "Âu-Elgaucho-77 Xuân Thuỷ , Thảo Điền , Q2",
  "Âu-D1 Conceps-Tầng 52, Bitexco Financial Tower, 36 Hồ Tùng Mậu, Phường Bến Nghé, Quận 1",
  "Âu-OPERA HYATT-Số 2 Công Trường Lam Sơn",
  "Âu-La Haye Kitchen & Bar - Sal-Đường số 5, KĐT Sala, TP. Thủ Đức",
  "Chay-Hum-34 Võ Văn Tần Quận 3",
  "Chay-Chay Garden Vegetarian Restaurant & Coffee-52 Võ Văn Tần , F6, Quận 3",
  "Chay-Tâm Vị-25 Tú Xương",
  "Chay-Be An-99 Nguyễn Huệ, P.Bến Nghé, Quận 1, TP. HCM/ trần cao vân",
  "Nhật-Sushi Hokaido -40-42 Đông Du, Bến Nghé , Q1",
  "Nhật-Yen Sushi-30 Trường Sơn Tân Bình",
  "Việt-Nhà hàng Ngon-160 Pateur , Bến Nghé , Q1",
  "Việt-Cục Gạch -9-10 Đặng Tất , Phường Tân Đinh, Q1",
  "Việt-Dimtutac-55 Đông Du, Bến Nghé , Quận 1",
  "Việt-Làng nướng Nam Bộ -14A Dương Đức Hiền , Tây Thạnh , Q Tân Phú ",
  "Việt-Cơm Niêu Sài Gòn-27 Tú Xương, Quận 3",
  "Việt-Yeebo-76 Nguyễn Văn Trỗi",
  "Việt-Tib-187 Hai bà trưng, P6- Quận 3",
  "Việt-Nhà hàng Mặn Mòi-34, Võ Văn Tần, P. Võ Thị Sáu, Q3, Tp. HCM",
  "Khác"
];

const meetingRoom = [
  "Chọn phòng họp...", "Activity Room", "Nha Trang Meeting Room",
  "Phu Quoc Meeting Room", "Sai Gon Meeting Room", "Showroom Meeting Room"
];

const meetingRoomEmails = {
  "Activity Room": "activity@vietsuncorp.com.vn",
  "Nha Trang Meeting Room": "NhaTrang@vietsuncorp.com.vn",
  "Phu Quoc Meeting Room": "phuquoc@vietsuncorp.com.vn",
  "Sai Gon Meeting Room": "saigon@vietsuncorp.com.vn",
  "Showroom Meeting Room": "showroom@vietsuncorp.com.vn"
};

module.exports = {
  taskData,
  customerNames,
  partnerNames,
  destinationList,
  lunchList,
  dinnerList,
  meetingRoom,
  meetingRoomEmails,
};
