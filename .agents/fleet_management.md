Fleet Management & Smart Vehicle Dispatch - Implementation Plan
Phase	Module	Chức năng	Công nghệ	Phụ thuộc	Ưu tiên	Thời gian
1	Master Data	Quản lý xe, tài xế, địa điểm, loại xe, sức chứa	React, Express, SQL Server	Hiện có	⭐⭐⭐⭐⭐	Đã có / Hoàn thiện
1	Booking	Đăng ký xe, nhiều điểm dừng, mức ưu tiên, mục đích, thời gian mong muốn	React, Express	Master Data	⭐⭐⭐⭐⭐	5 ngày
1	Approval	Quy trình phê duyệt nhiều cấp	Workflow hiện có	Booking	⭐⭐⭐⭐⭐	3 ngày
2	Route Engine	Tính quãng đường, ETA, Polyline bằng OSRM/Valhalla	OSRM + OSM	Booking	⭐⭐⭐⭐⭐	7 ngày
2	Location Repository	Lưu tọa độ các địa điểm thường dùng, geofence	SQL Server	Route Engine	⭐⭐⭐⭐	3 ngày
2	Dispatch Rule Engine	Rule Engine (ghế, ưu tiên, bảo dưỡng, tài xế)	Node.js	Booking	⭐⭐⭐⭐⭐	7 ngày
3	Ride Pooling	Gộp chuyến theo thời gian ±15 phút, cùng hướng, còn ghế	Node.js	Dispatch Engine	⭐⭐⭐⭐⭐	10 ngày
3	Assignment Engine	Chấm điểm xe và đề xuất xe phù hợp	Node.js	Ride Pooling	⭐⭐⭐⭐⭐	8 ngày
3	Vehicle Schedule	Lịch xe dạng Calendar/Gantt	React	Assignment	⭐⭐⭐⭐	5 ngày
4	Driver Mobile	App/PWA cho tài xế nhận chuyến	React/Capacitor	Assignment	⭐⭐⭐⭐	15 ngày
4	GPS Tracking	Gửi GPS định kỳ về server	HTML5 Geolocation / Capacitor	Driver App	⭐⭐⭐⭐⭐	7 ngày
4	Realtime Tracking	Socket.IO cập nhật vị trí xe trực tiếp	Socket.IO	GPS	⭐⭐⭐⭐⭐	5 ngày
5	Geofence	Tự động xác định đến/rời điểm đón	Node.js	GPS	⭐⭐⭐⭐	5 ngày
5	Timeline	Nhật ký toàn bộ chuyến xe	SQL Server	GPS	⭐⭐⭐⭐	4 ngày
5	Auto Status	Tự cập nhật trạng thái chuyến	Rule Engine	Timeline	⭐⭐⭐⭐	4 ngày
6	Analytics	Dashboard xe, tài xế, KPI, chi phí	React + SQL	Timeline	⭐⭐⭐⭐⭐	10 ngày
6	Forecast	Dự đoán ETA theo dữ liệu lịch sử	SQL + Python (scikit-learn)	Analytics	⭐⭐⭐	10 ngày
6	Optimization	OR-Tools tối ưu lịch và phân xe	OR-Tools	Assignment	⭐⭐⭐⭐	15 ngày
________________________________________
Chi tiết từng Module
Phase 1 – Booking Management
Mục tiêu
Chuẩn hóa dữ liệu đầu vào.
Deliverables
•	Quản lý địa điểm 
•	Quản lý xe 
•	Quản lý tài xế 
•	Đăng ký xe 
•	Workflow phê duyệt 
•	Phân loại mức ưu tiên 
________________________________________
Phase 2 – Smart Route
Mục tiêu
CRM bắt đầu biết tính toán.
Có thể:
•	Quãng đường 
•	ETA 
•	Giờ đến 
•	Giờ về 
•	Tổng km 
Không cần Google Maps.
________________________________________
Phase 3 – Smart Dispatch
Đây là "bộ não" của hệ thống.
Rule Engine
Ví dụ
Nếu

Xe đang bảo dưỡng

↓

Loại

Nếu

Ghế không đủ

↓

Loại

Nếu

Lệch thời gian >15 phút

↓

Không gộp
________________________________________
Ride Pooling
Ví dụ
Booking	Giờ	Điểm đi	Điểm đến
A	8:00	VSIP	TSN
B	8:08	VSIP	TSN
C	8:11	VSIP	TSN
↓
CRM
↓
1 chuyến.
________________________________________
Assignment
CRM sẽ chấm điểm
Distance

+

Empty Seat

+

Priority

+

Same Direction

+

Driver Workload

+

Vehicle Availability
↓
Xe có điểm cao nhất.
________________________________________
Phase 4 – GPS
Sau khi phân xe.
Tài xế nhận
↓
Bắt đầu chuyến
↓
Gửi GPS
↓
CRM hiển thị.
________________________________________
Phase 5 – Automation
CRM sẽ tự động:
✔ Đến nơi
✔ Đón khách
✔ Rời điểm đón
✔ Hoàn thành
không cần tài xế bấm.
________________________________________
Phase 6 – Analytics
Dashboard
Ví dụ
Đăng ký

548
↓
Sau khi gộp

390 chuyến
↓
Tiết kiệm

158 chuyến
↓
Tiết kiệm

2.300 km
↓
Nhiên liệu

-18%
________________________________________
Database bổ sung
Table	Mục đích
VehicleLocation	GPS realtime
VehicleTrip	Thông tin chuyến
TripStop	Các điểm dừng
RouteHistory	Lưu polyline/lịch sử tuyến
VehicleSchedule	Lịch xe
RidePooling	Nhóm các booking
AssignmentScore	Lưu điểm chấm khi phân xe
DriverShift	Ca làm việc
Geofence	Khu vực địa lý
ETAHistory	ETA dự đoán và thực tế
VehicleTelemetry (tùy chọn)	Tốc độ, hướng, độ chính xác GPS
________________________________________
Kiến trúc Logic
Booking
    │
    ▼
Approval
    │
    ▼
Route Engine
    │
    ▼
Rule Engine
    │
    ├─────────────┐
    ▼             ▼
Ride Pooling   Assignment Score
    │             │
    └──────┬──────┘
           ▼
Vehicle Schedule
           │
           ▼
Dispatch
           │
           ▼
Driver App
           │
           ▼
GPS Tracking
           │
           ▼
Timeline
           │
           ▼
Analytics
Mức độ ưu tiên triển khai
Nếu nguồn lực có hạn, mình sẽ ưu tiên theo thứ tự sau để mang lại giá trị sớm nhất:
Thứ tự	Hạng mục	Giá trị mang lại
1	Booking + Approval	Chuẩn hóa quy trình đăng ký xe
2	Route Engine (OSRM)	Tự động tính quãng đường và ETA
3	Dispatch Rule Engine	Giảm thời gian điều phối thủ công
4	Ride Pooling (±15 phút)	Giảm số chuyến và chi phí vận hành
5	Assignment Engine	Đề xuất xe tối ưu theo nhiều tiêu chí
6	Vehicle Schedule	Trực quan hóa lịch xe, tránh trùng lịch
7	Driver App + GPS Tracking	Theo dõi xe theo thời gian thực
8	Dashboard & Analytics	Đo lường hiệu quả và tối ưu liên tục
9	OR-Tools Optimization	Tối ưu điều phối khi quy mô lớn

Chức năng	Công nghệ	Chi phí
Bản đồ hiển thị	Leaflet + OpenStreetMap	Miễn phí
Tính đường, quãng đường, ETA	OSRM (hoặc Valhalla)	Miễn phí
Geocoding địa chỉ ↔ tọa độ	Nominatim (có thể tự host nếu cần)	Miễn phí
GPS thời gian thực	Socket.IO + HTML5 Geolocation / Capacitor	Miễn phí
Gộp chuyến	Thuật toán tự xây dựng trong Node.js	Miễn phí
Phân xe	OR-Tools hoặc heuristic tự xây dựng	Miễn phí
Dự đoán ETA	scikit-learn (Random Forest/XGBoost) hoặc thống kê lịch sử	Miễn phí
Dashboard	React + SQL Server	Miễn phí

Epic 1 — Vehicle Booking
Design and implement Vehicle Booking Module.

Features

- Create Booking
- Edit Booking
- Cancel Booking
- Approve Booking
- Reject Booking
- Booking History

Booking Information

- Employee
- Department
- Pickup Location
- Destination
- Multiple Stops
- Passenger Count
- Vehicle Type
- Priority
- Purpose
- Expected Departure Time
- Required Arrival Time
- Estimated Distance
- Estimated Duration
- Status

Generate

- SQL Tables
- Stored Procedures
- REST APIs
- React Pages
- Validation
________________________________________
Epic 2 — Route Engine
Implement Route Engine.

Use OpenStreetMap + OSRM.

Requirements

Calculate

- Distance
- Estimated Duration
- Polyline
- Route Summary

Cache result in SQL Server.

If the same route is requested again within 30 days,
use cached result.

Design database and APIs.
________________________________________
Epic 3 — Ride Pooling
Đây là module mình thấy "đáng tiền" nhất.
Implement Ride Pooling Engine.

Business Rules

Bookings can be merged only if

Departure Time Difference <=15 minutes

Pickup Distance <=1 km

Destination Direction Similarity >=80%

Vehicle Capacity is enough

Estimated Arrival Delay <=10 minutes

Generate

Database

Business Logic

Merge Algorithm

REST APIs

Frontend suggestion screen

Explain algorithm complexity.
________________________________________
Epic 4 — Assignment Engine
Implement Vehicle Assignment Engine.

Each available vehicle receives a score.

Scoring

Distance to Pickup 30%

Booking Priority 20%

Available Seats 10%

Route Similarity 20%

Current Schedule 10%

Driver Workload 5%

Vehicle Maintenance 5%

Vehicle with highest score wins.

Generate clean architecture.

Make every scoring rule configurable.
________________________________________
Epic 5 — Schedule Engine
Implement Vehicle Scheduling Module.

Requirements

Vehicle Calendar

Driver Calendar

Conflict Detection

Auto Schedule

Idle Time Calculation

Travel Time Calculation

Generate Gantt-like frontend.
________________________________________
Epic 6 — GPS Tracking
Implement GPS Tracking.

Driver mobile sends

Latitude

Longitude

Heading

Speed

Accuracy

Timestamp

every 10 seconds.

Store only latest location in VehicleLocation.

Store history separately.

Frontend

Live Map

Auto Refresh

Vehicle Status

Speed

ETA

Online Offline Detection.
________________________________________
Epic 7 — Geofence
Implement Geofence Module.

Business Rules

Vehicle enters Pickup Zone

Booking Status

Arrived

Vehicle leaves Pickup Zone

Passenger Picked Up

Vehicle enters Destination Zone

Completed

Zone Radius configurable.
________________________________________
Epic 8 — Analytics
Implement Fleet Dashboard.

KPIs

Vehicle Utilization

Driver Utilization

Total Trips

Merged Trips

Average ETA

Average Delay

Distance per Vehicle

Fuel Saving Estimation

Monthly Trend

Generate SQL Views if needed.
________________________________________
Epic 9 — AI Learning
Implement ETA Learning Module.

Use historical trips.

Calculate

Average Speed

Peak Hour

Off Peak

Holiday

Predict ETA

Do not use paid AI.

Use Python Scikit-learn.

Generate training pipeline.
________________________________________
Epic 10 — Optimization
Implement Dispatch Optimization.

Use Google OR-Tools.

Optimize

Vehicle Assignment

Trip Sequence

Idle Time

Travel Distance

Working Hours

Generate explainable optimization model.

Before writing code: 1. Analyze current architecture. 2. Identify affected modules. 3. Explain database changes. 4. Explain API changes. 5. Explain frontend changes. 6. Explain migration plan. 7. Explain backward compatibility. After analysis, generate production-ready code only. Do not simplify implementation. Do not omit validation. Do not generate pseudo code. Generate complete files.

You are the Lead Software Architect of this CRM project.

Your primary goal is to produce maintainable enterprise-grade code.

Always follow these principles:

- Preserve existing architecture and coding conventions.
- Prefer modular, loosely coupled components.
- Follow SOLID principles.
- Avoid duplicate logic.
- Keep business rules inside the Service layer.
- Keep Controllers thin.
- Store configuration values in configuration tables instead of hardcoding.
- Every database change must include migration scripts and rollback scripts.
- Every new feature must consider performance, security, logging, auditing, and future extensibility.
- Explain design decisions before generating code.
- If requirements are ambiguous, identify assumptions explicitly instead of inventing business rules.
