// src/routes/fleet.js
// Fleet Management — Thin Controller (all DB ops via Stored Procedures)
const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const axios = require('axios');
const authenticateToken = require('../middleware/auth');
const authorizeRoles = require('../middleware/authorize');
const { getCsrPool, sql } = require('../config/database');
const {
    notifyAdminNewBooking,
    notifyRequesterApproved,
    notifyRequesterRejected,
} = require('../utils/fleetNotification');
const {
    sendSupervisorApprovalToQueue,
    sendTeamAdminApprovalToQueue
} = require('../utils/fleetTeamsApproval');

// Toan bo endpoint yeu cau dang nhap
router.use(authenticateToken);

// ── Helper ──────────────────────────────────────────────────────
const APPROVAL_ROLES = ['Admin', 'BOD', 'PRD', 'TeamAdmin'];

function isApprover(role) {
    return APPROVAL_ROLES.includes(role);
}

// ── VEHICLE TYPES ────────────────────────────────────────────────

/**
 * GET /api/fleet/vehicle-types
 * Lay danh sach loai xe
 */
router.get('/vehicle-types', async (req, res, next) => {
    try {
        const pool = await getCsrPool();
        const result = await pool.request().execute('usp_Fleet_VehicleType_List');
        res.json({ success: true, data: result.recordset });
    } catch (err) { next(err); }
});

/**
 * POST /api/fleet/vehicle-types
 * Them / cap nhat loai xe (chi Admin)
 */
router.post('/vehicle-types', authorizeRoles('Admin'), async (req, res, next) => {
    try {
        const { id = 0, typeName, description, isActive = true } = req.body;
        if (!typeName?.trim()) {
            return res.status(400).json({ success: false, error: 'Tên loại xe không được để trống' });
        }
        const pool = await getCsrPool();
        const result = await pool.request()
            .input('Id',          sql.Int,           id)
            .input('TypeName',    sql.NVarChar(100), typeName.trim())
            .input('Description', sql.NVarChar(500), description || null)
            .input('IsActive',    sql.Bit,           isActive ? 1 : 0)
            .execute('usp_Fleet_VehicleType_Save');
        res.json({ success: true, data: result.recordset[0] });
    } catch (err) { next(err); }
});

// ── VEHICLES ─────────────────────────────────────────────────────

/**
 * GET /api/fleet/vehicles
 * Lay danh sach xe, co the loc theo isActive, status
 */
router.get('/vehicles', async (req, res, next) => {
    try {
        const { isActive, status } = req.query;
        const pool = await getCsrPool();
        const result = await pool.request()
            .input('IsActive', sql.Bit,          isActive !== undefined ? (isActive === 'true' ? 1 : 0) : null)
            .input('Status',   sql.NVarChar(50), status || null)
            .execute('usp_Fleet_Vehicle_List');
        res.json({ success: true, data: result.recordset });
    } catch (err) { next(err); }
});

/**
 * POST /api/fleet/vehicles
 * Them / cap nhat xe (chi Admin)
 */
router.post('/vehicles', authorizeRoles('Admin', 'PRD'), async (req, res, next) => {
    try {
        const {
            id = 0, plateNumber, brand, model, typeId,
            seats = 4, color, fuelType, status, notes, isActive = true,
        } = req.body;

        if (!plateNumber?.trim()) return res.status(400).json({ success: false, error: 'Biển số xe không được để trống' });
        if (!brand?.trim())       return res.status(400).json({ success: false, error: 'Hãng xe không được để trống' });

        const pool = await getCsrPool();
        const result = await pool.request()
            .input('Id',          sql.Int,            id)
            .input('PlateNumber', sql.NVarChar(20),   plateNumber.trim().toUpperCase())
            .input('Brand',       sql.NVarChar(100),  brand.trim())
            .input('Model',       sql.NVarChar(100),  model || null)
            .input('TypeId',      sql.Int,            typeId || null)
            .input('Seats',       sql.Int,            Number(seats) || 4)
            .input('Color',       sql.NVarChar(50),   color || null)
            .input('FuelType',    sql.NVarChar(50),   fuelType || 'Xăng')
            .input('Status',      sql.NVarChar(50),   status || 'Sẵn sàng')
            .input('Notes',       sql.NVarChar(1000), notes || null)
            .input('IsActive',    sql.Bit,            isActive ? 1 : 0)
            .execute('usp_Fleet_Vehicle_Save');

        res.json({ success: true, data: result.recordset[0] });
    } catch (err) { next(err); }
});

/**
 * POST /api/fleet/vehicles/batch
 * Batch import vehicles from Excel (chi Admin / PRD)
 */
router.post('/vehicles/batch', authorizeRoles('Admin', 'PRD'), async (req, res, next) => {
    try {
        const { rows } = req.body;
        if (!Array.isArray(rows) || rows.length === 0) {
            return res.status(400).json({ success: false, error: 'Không có dữ liệu' });
        }

        const pool = await getCsrPool();
        let inserted = 0;
        const errors = [];

        for (const row of rows) {
            const plateNumber = String(row.plateNumber || '').trim().toUpperCase();
            const brand = String(row.brand || '').trim();
            if (!plateNumber || !brand) continue;

            try {
                // Chuẩn hoá IsActive
                const activeRaw = String(row.isActive || '').trim();
                let isActiveVal = 1;
                if (activeRaw === 'Ngưng hoạt động' || activeRaw === 'Dừng' || activeRaw === '0' || activeRaw === 'false' || activeRaw === 'Khóa') {
                    isActiveVal = 0;
                }

                await pool.request()
                    .input('PlateNumber', sql.NVarChar(20),   plateNumber)
                    .input('Brand',       sql.NVarChar(100),  brand)
                    .input('Model',       sql.NVarChar(100),  row.model || null)
                    .input('TypeName',    sql.NVarChar(100),  row.typeName || null)
                    .input('Seats',       sql.Int,            Number(row.seats) || 4)
                    .input('Color',       sql.NVarChar(50),   row.color || null)
                    .input('FuelType',    sql.NVarChar(50),   row.fuelType || 'Xăng')
                    .input('Status',      sql.NVarChar(50),   row.status || 'Sẵn sàng')
                    .input('Notes',       sql.NVarChar(1000), row.notes || null)
                    .input('IsActive',    sql.Bit,            isActiveVal)
                    .execute('usp_Fleet_Vehicle_UpsertByPlate');
                inserted++;
            } catch (e) {
                errors.push(`Xe "${plateNumber}": ${e.message}`);
            }
        }

        res.json({ success: true, message: `Đã xử lý ${inserted}/${rows.length} xe`, errors });
    } catch (err) { next(err); }
});

// ── DRIVERS ──────────────────────────────────────────────────────

/**
 * GET /api/fleet/drivers
 */
router.get('/drivers', async (req, res, next) => {
    try {
        const { isActive, status } = req.query;
        const pool = await getCsrPool();
        const result = await pool.request()
            .input('IsActive', sql.Bit,          isActive !== undefined ? (isActive === 'true' ? 1 : 0) : null)
            .input('Status',   sql.NVarChar(50), status || null)
            .execute('usp_Fleet_Driver_List');
        res.json({ success: true, data: result.recordset });
    } catch (err) { next(err); }
});

/**
 * POST /api/fleet/drivers
 * Them / cap nhat tai xe (chi Admin / PRD)
 */
router.post('/drivers', authorizeRoles('Admin', 'PRD'), async (req, res, next) => {
    try {
        const {
            id = 0, fullName, phone, licenseNumber, licenseClass,
            status, notes, isActive = true,
        } = req.body;

        if (!fullName?.trim()) return res.status(400).json({ success: false, error: 'Họ tên tài xế không được để trống' });

        const pool = await getCsrPool();
        const result = await pool.request()
            .input('Id',            sql.Int,            id)
            .input('FullName',      sql.NVarChar(200),  fullName.trim())
            .input('Phone',         sql.NVarChar(20),   phone || null)
            .input('LicenseNumber', sql.NVarChar(50),   licenseNumber || null)
            .input('LicenseClass',  sql.NVarChar(10),   licenseClass || null)
            .input('Status',        sql.NVarChar(50),   status || 'Sẵn sàng')
            .input('Notes',         sql.NVarChar(1000), notes || null)
            .input('IsActive',      sql.Bit,            isActive ? 1 : 0)
            .execute('usp_Fleet_Driver_Save');

        res.json({ success: true, data: result.recordset[0] });
    } catch (err) { next(err); }
});

/**
 * POST /api/fleet/drivers/batch
 * Batch import drivers from Excel (chi Admin / PRD)
 */
router.post('/drivers/batch', authorizeRoles('Admin', 'PRD'), async (req, res, next) => {
    try {
        const { rows } = req.body;
        if (!Array.isArray(rows) || rows.length === 0) {
            return res.status(400).json({ success: false, error: 'Không có dữ liệu' });
        }

        const pool = await getCsrPool();
        let inserted = 0;
        const errors = [];

        for (const row of rows) {
            const fullName = String(row.fullName || '').trim();
            if (!fullName) continue;

            try {
                // Chuẩn hoá IsActive
                const activeRaw = String(row.isActive || '').trim();
                let isActiveVal = 1;
                if (activeRaw === 'Ngưng hoạt động' || activeRaw === 'Dừng' || activeRaw === '0' || activeRaw === 'false' || activeRaw === 'Nghỉ') {
                    isActiveVal = 0;
                }

                await pool.request()
                    .input('FullName',      sql.NVarChar(200),  fullName)
                    .input('Phone',         sql.NVarChar(20),   row.phone ? String(row.phone).trim() : null)
                    .input('LicenseNumber', sql.NVarChar(50),   row.licenseNumber ? String(row.licenseNumber).trim() : null)
                    .input('LicenseClass',  sql.NVarChar(10),   row.licenseClass || null)
                    .input('Status',        sql.NVarChar(50),   row.status || 'Sẵn sàng')
                    .input('Notes',         sql.NVarChar(1000), row.notes || null)
                    .input('IsActive',      sql.Bit,            isActiveVal)
                    .execute('usp_Fleet_Driver_Upsert');
                inserted++;
            } catch (e) {
                errors.push(`Tài xế "${fullName}": ${e.message}`);
            }
        }

        res.json({ success: true, message: `Đã xử lý ${inserted}/${rows.length} tài xế`, errors });
    } catch (err) { next(err); }
});

// ── BOOKINGS ─────────────────────────────────────────────────────

/**
 * GET /api/fleet/bookings
 * Danh sach dat xe (co phan trang + bo loc)
 * User thuong chi thay booking cua minh, Admin/PRD/BOD thay tat ca
 */
router.get('/bookings', async (req, res, next) => {
    try {
        const {
            search = '', status = '', dateFrom = '', dateTo = '',
            page = 1, pageSize = 20,
        } = req.query;

        const { role, mnv } = req.user;
        // User thuong chi thay don cua chinh minh
        const requesterMNV = isApprover(role) ? null : (mnv || null);

        const pool = await getCsrPool();
        const result = await pool.request()
            .input('SearchText',   sql.NVarChar(200), search || null)
            .input('Status',       sql.NVarChar(50),  status || null)
            .input('RequesterMNV', sql.NVarChar(50),  requesterMNV)
            .input('DateFrom',     sql.Date,          dateFrom ? new Date(dateFrom) : null)
            .input('DateTo',       sql.Date,          dateTo   ? new Date(dateTo)   : null)
            .input('PageNumber',   sql.Int,           Number(page) || 1)
            .input('PageSize',     sql.Int,           Number(pageSize) || 20)
            .execute('usp_Fleet_Booking_List');

        const totalCount = result.recordsets[0]?.[0]?.TotalCount || 0;
        const items      = result.recordsets[1] || [];
        res.json({ success: true, data: items, totalCount, page: Number(page), pageSize: Number(pageSize) });
    } catch (err) { next(err); }
});

/**
 * POST /api/fleet/bookings
 * Tao booking moi — bat ky user nao co quyen truy cap menu vehicle deu tao duoc
 */
router.post('/bookings', async (req, res, next) => {
    try {
        const {
            pickupLocation, destination, stops,
            departureTime, returnTime,
            purpose, passengerCount = 1, priority = 'Bình thường', notes,
            vehicleId, driverId, attendees, attendeesEmail, vehicleType,
        } = req.body;

        // Validation
        const errs = [];
        if (!pickupLocation?.trim()) errs.push('Điểm đón không được để trống');
        if (!destination?.trim())    errs.push('Điểm đến không được để trống');
        if (!departureTime)          errs.push('Thời gian khởi hành không được để trống');
        if (!purpose?.trim())        errs.push('Mục đích không được để trống');
        if (passengerCount < 1)      errs.push('Số hành khách phải >= 1');
        if (errs.length > 0) return res.status(400).json({ success: false, errors: errs });

        const pool = await getCsrPool();

        // Lay thong tin user hien tai
        let requesterName  = req.user.fullName || req.user.mnv || 'Unknown';
        let requesterEmail = req.user.email || null;
        let requesterDept  = req.user.department || null;

        if (req.user.mnv) {
            try {
                const empRes = await pool.request()
                    .query(`SELECT FullName, Email, Department FROM CSR_Employees WHERE MNV = '${req.user.mnv}' AND IsActive = 1`);
                if (empRes.recordset.length > 0) {
                    const emp = empRes.recordset[0];
                    requesterName  = emp.FullName  || requesterName;
                    requesterEmail = emp.Email     || requesterEmail;
                    requesterDept  = emp.Department || requesterDept;
                }
            } catch { /* fallback sang thong tin tu token */ }
        }

        const result = await pool.request()
            .input('RequesterMNV',   sql.NVarChar(50),    req.user.mnv || null)
            .input('RequesterName',  sql.NVarChar(200),   requesterName)
            .input('RequesterEmail', sql.NVarChar(200),   requesterEmail)
            .input('RequesterDept',  sql.NVarChar(200),   requesterDept)
            .input('PickupLocation', sql.NVarChar(500),   pickupLocation.trim())
            .input('Destination',    sql.NVarChar(500),   destination.trim())
            .input('Stops',          sql.NVarChar(sql.MAX), stops ? JSON.stringify(stops) : null)
            .input('DepartureTime',  sql.DateTime,        new Date(departureTime))
            .input('ReturnTime',     sql.DateTime,        returnTime ? new Date(returnTime) : null)
            .input('Purpose',        sql.NVarChar(1000),  purpose.trim())
            .input('PassengerCount', sql.Int,             Number(passengerCount))
            .input('Priority',       sql.NVarChar(20),    priority)
            .input('Notes',          sql.NVarChar(1000),  notes || null)
            .input('VehicleId',      sql.Int,             vehicleId || null)
            .input('DriverId',       sql.Int,             driverId || null)
            .input('Attendees',      sql.NVarChar(sql.MAX), attendees || null)
            .input('AttendeesEmail', sql.NVarChar(sql.MAX), attendeesEmail || null)
            .input('VehicleType',    sql.NVarChar(100),   vehicleType || 'Xe công ty')
            .execute('usp_Fleet_Booking_Create');

        const newBooking = result.recordset[0];

        // Neu da duyet ngay khi tao (danh cho VIP)
        const isAutoApproved = newBooking.Status === 'Team Admin đã duyệt';

        if (isAutoApproved) {
            // Gui email cho nguoi dat (da duyet)
            notifyRequesterApproved({
                ...newBooking,
                ApprovedBy: requesterName,
            }, pool).catch(err => console.error('[Fleet] Auto Approval email error:', err.message));
        } else {
            // Kích hoạt gửi Teams approval cho Giám sát
            sendSupervisorApprovalToQueue({
                ...newBooking,
                Id: newBooking.Id,
                BookingCode: newBooking.BookingCode,
                RequesterName:  requesterName,
                RequesterEmail: requesterEmail,
                RequesterDept:  requesterDept,
                PickupLocation: pickupLocation,
                Destination:    destination,
                DepartureTime:  departureTime,
                ReturnTime:     returnTime,
                Purpose:        purpose,
                PassengerCount: passengerCount,
                Priority:       priority,
                Notes:          notes,
                Attendees:      attendees,
                AttendeesEmail: attendeesEmail
            }, pool).catch(err => console.error('[Fleet Teams] Queue error:', err.message));
        }

        res.status(201).json({ success: true, data: newBooking });
    } catch (err) { next(err); }
});

/**
 * PUT /api/fleet/bookings/:id
 * Chỉnh sửa booking
 * Chỉ cho phép khi trạng thái thuộc: Chờ phản hồi, Giám sát từ chối, Team Admin từ chối, Team Admin đã duyệt, Đã duyệt.
 */
router.put('/bookings/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const {
            pickupLocation, destination, stops, departureTime, returnTime,
            purpose, passengerCount, priority, notes, attendees, attendeesEmail, vehicleType
        } = req.body;

        if (isNaN(Number(id))) return res.status(400).json({ success: false, error: 'ID không hợp lệ' });

        const pool = await getCsrPool();

        // 1. Lấy chi tiết booking hiện tại để kiểm tra quyền và trạng thái
        const detailRes = await pool.request()
            .input('Id', sql.Int, Number(id))
            .execute('usp_Fleet_Booking_GetDetail');
        const booking = detailRes.recordset[0];
        if (!booking) return res.status(404).json({ success: false, error: 'Không tìm thấy booking' });

        // Quyền: chỉ người tạo hoặc admin mới được sửa
        if (!isApprover(req.user.role) && booking.RequesterMNV !== req.user.mnv) {
            return res.status(403).json({ success: false, error: 'Bạn không có quyền sửa booking này' });
        }

        // Trạng thái: chỉ các trạng thái cho phép
        const ALLOWED_EDIT_STATUSES = [
            'Chờ phản hồi', 'Giám sát từ chối', 'Team Admin từ chối', 'Team Admin đã duyệt', 'Đã duyệt', 'Chờ duyệt'
        ];
        if (!ALLOWED_EDIT_STATUSES.includes(booking.Status)) {
            return res.status(400).json({ success: false, error: `Không thể chỉnh sửa đơn ở trạng thái hiện tại: ${booking.Status}` });
        }

        // 2. Cập nhật booking
        await pool.request()
            .input('Id',              sql.Int,             Number(id))
            .input('PickupLocation',  sql.NVarChar(500),   pickupLocation.trim())
            .input('Destination',     sql.NVarChar(500),   destination.trim())
            .input('Stops',           sql.NVarChar(sql.MAX), stops ? JSON.stringify(stops) : null)
            .input('DepartureTime',   sql.DateTime,        new Date(departureTime))
            .input('ReturnTime',      sql.DateTime,        returnTime ? new Date(returnTime) : null)
            .input('Purpose',         sql.NVarChar(1000),  purpose.trim())
            .input('PassengerCount',  sql.Int,             Number(passengerCount))
            .input('Priority',        sql.NVarChar(20),    priority)
            .input('Notes',           sql.NVarChar(1000),  notes || null)
            .input('Attendees',       sql.NVarChar(sql.MAX), attendees || null)
            .input('AttendeesEmail',  sql.NVarChar(sql.MAX), attendeesEmail || null)
            .input('VehicleType',     sql.NVarChar(100),   vehicleType || 'Xe công ty')
            .execute('usp_Fleet_Booking_Update');

        // 3. Trạng thái sau update được reset về 'Chờ phản hồi' trong SP, ta gửi lại email / queue Teams cho giám sát
        const updatedBookingRes = await pool.request()
            .input('Id', sql.Int, Number(id))
            .execute('usp_Fleet_Booking_GetDetail');
        const updatedBooking = updatedBookingRes.recordset[0];

        sendSupervisorApprovalToQueue({
            ...updatedBooking,
            Id: updatedBooking.Id,
            BookingCode: updatedBooking.BookingCode,
            RequesterName:  updatedBooking.RequesterName,
            RequesterEmail: updatedBooking.RequesterEmail,
            RequesterDept:  updatedBooking.RequesterDept,
            PickupLocation: updatedBooking.PickupLocation,
            Destination:    updatedBooking.Destination,
            DepartureTime:  updatedBooking.DepartureTime,
            ReturnTime:     updatedBooking.ReturnTime,
            Purpose:        updatedBooking.Purpose,
            PassengerCount: updatedBooking.PassengerCount,
            Priority:       updatedBooking.Priority,
            Notes:          updatedBooking.Notes,
            Attendees:      updatedBooking.Attendees,
            AttendeesEmail: updatedBooking.AttendeesEmail
        }, pool).catch(err => console.error('[Fleet Teams] Queue error after edit:', err.message));

        res.json({ success: true, message: 'Cập nhật và gửi lại yêu cầu duyệt thành công', data: updatedBooking });
    } catch (err) { next(err); }
});

/**
 * GET /api/fleet/bookings/:id
 * Chi tiet booking
 */
router.get('/bookings/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        if (isNaN(Number(id))) return res.status(400).json({ success: false, error: 'ID không hợp lệ' });

        const pool = await getCsrPool();
        const result = await pool.request()
            .input('Id', sql.Int, Number(id))
            .execute('usp_Fleet_Booking_GetDetail');

        const booking = result.recordset[0];
        if (!booking) return res.status(404).json({ success: false, error: 'Không tìm thấy booking' });

        // User thuong chi xem duoc don cua minh
        if (!isApprover(req.user.role) && booking.RequesterMNV !== req.user.mnv) {
            return res.status(403).json({ success: false, error: 'Bạn không có quyền xem booking này' });
        }

        res.json({ success: true, data: booking });
    } catch (err) { next(err); }
});

/**
 * PUT /api/fleet/bookings/:id/status
 * Cap nhat trang thai booking
 * - Nguoi tao: chi duoc HUY (khi dang Cho duyet)
 * - Admin/BOD/PRD: Duyet, Tu choi, Hoan thanh
 */
router.put('/bookings/:id/status', async (req, res, next) => {
    try {
        const { id } = req.params;
        const {
            newStatus, vehicleId, driverId, assignedNote,
            rejectedReason, cancelledReason,
        } = req.body;

        if (isNaN(Number(id))) return res.status(400).json({ success: false, error: 'ID không hợp lệ' });
        if (!newStatus)        return res.status(400).json({ success: false, error: 'Trạng thái mới không được để trống' });

        const VALID_STATUSES = [
            'Đã duyệt', 'Từ chối', 'Đã hủy', 'Hoàn thành',
            'Giám sát đã duyệt', 'Giám sát từ chối',
            'Team Admin đã duyệt', 'Team Admin từ chối'
        ];
        if (!VALID_STATUSES.includes(newStatus)) {
            return res.status(400).json({ success: false, error: `Trạng thái không hợp lệ: ${newStatus}` });
        }

        // Phan quyen:
        // - "Giám sát đã duyệt", "Giám sát từ chối", "Team Admin đã duyệt", "Team Admin từ chối", "Hoàn thành" -> phai la approver
        // - "Đã hủy" -> approver hoac chinh nguoi dat
        const requiresApprover = [
            'Đã duyệt', 'Từ chối', 'Hoàn thành',
            'Giám sát đã duyệt', 'Giám sát từ chối',
            'Team Admin đã duyệt', 'Team Admin từ chối'
        ].includes(newStatus);
        if (requiresApprover && !isApprover(req.user.role)) {
            return res.status(403).json({ success: false, error: 'Bạn không có quyền thực hiện hành động này' });
        }

        // Neu duyet: bat buoc phai chon xe
        const isApproving = newStatus === 'Đã duyệt' || newStatus === 'Team Admin đã duyệt';
        if (isApproving && !vehicleId) {
            return res.status(400).json({ success: false, error: 'Vui lòng chọn xe để phân công khi duyệt' });
        }

        const pool = await getCsrPool();
        const result = await pool.request()
            .input('Id',              sql.Int,            Number(id))
            .input('NewStatus',       sql.NVarChar(50),   newStatus)
            .input('ActorName',       sql.NVarChar(200),  req.user.fullName || req.user.mnv || null)
            .input('VehicleId',       sql.Int,            vehicleId || null)
            .input('DriverId',        sql.Int,            driverId || null)
            .input('AssignedNote',    sql.NVarChar(1000), assignedNote || null)
            .input('RejectedReason',  sql.NVarChar(1000), rejectedReason || null)
            .input('CancelledReason', sql.NVarChar(1000), cancelledReason || null)
            .execute('usp_Fleet_Booking_UpdateStatus');

        const updatedBooking = result.recordset[0];

        // Gui email thong bao (non-blocking)
        if (newStatus === 'Team Admin đã duyệt' && updatedBooking) {
            const { buildAllocationEmailHtml, sendFleetMail } = require('../utils/fleetTeamsApproval');
            const subject = `Điều phối phương tiện đi công tác cho ${updatedBooking.RequesterName}`;
            const emailHtml = buildAllocationEmailHtml(updatedBooking);
            sendFleetMail([updatedBooking.RequesterEmail.trim()], [], subject, emailHtml)
                .catch(err => console.error('[Fleet] Dispatch allocation email error:', err.message));
        } else if (newStatus === 'Đã duyệt' && updatedBooking) {
            notifyRequesterApproved({ ...updatedBooking, ApprovedBy: req.user.fullName || req.user.mnv }, pool)
                .catch(err => console.error('[Fleet] Approval email error:', err.message));
        } else if ((newStatus === 'Từ chối' || newStatus === 'Giám sát từ chối' || newStatus === 'Team Admin từ chối') && updatedBooking) {
            notifyRequesterRejected(updatedBooking)
                .catch(err => console.error('[Fleet] Rejection email error:', err.message));
        }

        res.json({ success: true, data: updatedBooking });
    } catch (err) { next(err); }
});

// ── EXPORT ───────────────────────────────────────────────────────

/**
 * GET /api/fleet/export/bookings
 * Xuat danh sach booking ra file Excel
 */
router.get('/export/bookings', async (req, res, next) => {
    try {
        const { status = '', dateFrom = '', dateTo = '' } = req.query;
        const { role, mnv } = req.user;
        const requesterMNV = isApprover(role) ? null : (mnv || null);

        const pool = await getCsrPool();
        const result = await pool.request()
            .input('Status',       sql.NVarChar(50), status || null)
            .input('RequesterMNV', sql.NVarChar(50), requesterMNV)
            .input('DateFrom',     sql.Date,         dateFrom ? new Date(dateFrom) : null)
            .input('DateTo',       sql.Date,         dateTo   ? new Date(dateTo)   : null)
            .execute('usp_Fleet_Booking_Export');

        const rows = result.recordset || [];

        // Tao file Excel bang ExcelJS
        const workbook  = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Danh sách đặt xe');

        // Header style
        const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1677FF' } };
        const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };

        if (rows.length > 0) {
            const headers = Object.keys(rows[0]);
            worksheet.addRow(headers);
            const headerRow = worksheet.getRow(1);
            headerRow.eachCell(cell => {
                cell.fill = headerFill;
                cell.font = headerFont;
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                cell.border = {
                    top: { style: 'thin' }, left: { style: 'thin' },
                    bottom: { style: 'thin' }, right: { style: 'thin' },
                };
            });
            headerRow.height = 32;

            // Data rows
            rows.forEach((row, idx) => {
                const dataRow = worksheet.addRow(Object.values(row));
                dataRow.eachCell(cell => {
                    cell.border = {
                        top: { style: 'thin' }, left: { style: 'thin' },
                        bottom: { style: 'thin' }, right: { style: 'thin' },
                    };
                    cell.alignment = { vertical: 'middle', wrapText: true };
                    if (idx % 2 === 1) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
                    }
                });
            });

            // Auto column width
            worksheet.columns.forEach(col => {
                let maxLen = 0;
                col.eachCell({ includeEmpty: true }, cell => {
                    const len = cell.value ? String(cell.value).length : 0;
                    maxLen = Math.max(maxLen, len);
                });
                col.width = Math.min(Math.max(maxLen + 4, 12), 40);
            });
        } else {
            worksheet.addRow(['Không có dữ liệu']);
        }

        const dateStr = new Date().toISOString().slice(0, 10);
        const filename = `DatXe_${dateStr}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) { next(err); }
});

/**
 * GET /api/fleet/geocode/suggest
 * Dynamic suggestions: checks database cache first, otherwise calls Google Places Autocomplete API or Nominatim API.
 */
router.get('/geocode/suggest', async (req, res, next) => {
    try {
        const { q = '' } = req.query;
        const trimmed = q.trim();
        if (!trimmed) {
            return res.json({ success: true, data: [] });
        }

        const pool = await getCsrPool();
        const searchPattern = `%${trimmed}%`;

        // Step 1: Check database cache LocationMaster
        const cachedRes = await pool.request()
            .input('SearchText', sql.NVarChar(500), searchPattern)
            .query('SELECT DisplayName, Latitude, Longitude, Source FROM LocationMaster WHERE AddressQuery LIKE @SearchText');

        const cachedList = cachedRes.recordset || [];
        const result = cachedList.map(item => ({
            label: item.DisplayName,
            value: item.DisplayName,
            lat: item.Latitude,
            lon: item.Longitude,
            source: item.Source,
        }));

        // If we have 5 or more cached results, return them immediately
        if (result.length >= 5) {
            return res.json({ success: true, data: result.slice(0, 5) });
        }

        // Step 2: Query API
        const apiKey = process.env.USE_GOOGLE_MAPS === 'true' ? process.env.GOOGLE_MAPS_API_KEY : null;
        if (apiKey) {
            try {
                const googleUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(trimmed)}&key=${apiKey}&components=country:vn&language=vi`;
                const gRes = await axios.get(googleUrl);
                
                console.log('[Geocode Suggest] Google Places API Status:', gRes.data.status, gRes.data.error_message || '');

                if (gRes.data && Array.isArray(gRes.data.predictions) && gRes.data.predictions.length > 0) {
                    const gPredictions = gRes.data.predictions.map(pred => ({
                        label: pred.description,
                        value: pred.description,
                        placeId: pred.place_id,
                        source: 'GoogleSuggestions',
                    }));
                    // Combine and de-duplicate by label
                    const combined = [...result];
                    gPredictions.forEach(gp => {
                        if (!combined.some(c => c.label.toLowerCase() === gp.label.toLowerCase())) {
                            combined.push(gp);
                        }
                    });
                    return res.json({ success: true, data: combined.slice(0, 5) });
                } else if (gRes.data && gRes.data.status && gRes.data.status !== 'OK' && gRes.data.status !== 'ZERO_RESULTS') {
                    console.warn(`[Geocode Suggest] Google API warning status: ${gRes.data.status}`, gRes.data.error_message || '');
                }
            } catch (googleErr) {
                console.error('[Geocode Suggest] Google Places API request failed:', googleErr.message);
            }
        }

        // Fallback: Nominatim API
        try {
            const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmed)}&limit=5&countrycodes=vn&accept-language=vi`;
            const nRes = await axios.get(nomUrl, {
                headers: { 'User-Agent': 'CSR-Web-Enterprise-App/1.0' }
            });
            console.log('[Geocode Suggest] Nominatim Response count:', nRes.data?.length);

            if (nRes.data && Array.isArray(nRes.data)) {
                const nSuggestions = nRes.data.map(item => ({
                    label: item.display_name,
                    value: item.display_name,
                    lat: parseFloat(item.lat),
                    lon: parseFloat(item.lon),
                    source: 'Nominatim',
                }));
                const combined = [...result];
                nSuggestions.forEach(ns => {
                    if (!combined.some(c => c.label.toLowerCase() === ns.label.toLowerCase())) {
                        combined.push(ns);
                    }
                });
                return res.json({ success: true, data: combined.slice(0, 5) });
            }
        } catch (nomErr) {
            console.error('[Geocode Suggest] Nominatim fallback failed:', nomErr.message);
        }

        res.json({ success: true, data: result.slice(0, 5) });
    } catch (err) { next(err); }
});

/**
 * GET /api/fleet/geocode/resolve
 * Resolves a selected address or placeId to latitude & longitude coordinates.
 * Saves the resolved coordinate into LocationMaster to cache it!
 */
router.get('/geocode/resolve', async (req, res, next) => {
    try {
        const { placeId = '', address = '' } = req.query;
        const trimmedAddr = address.trim();

        if (!placeId && !trimmedAddr) {
            return res.status(400).json({ success: false, error: 'Vui lòng cung cấp placeId hoặc address' });
        }

        const pool = await getCsrPool();
        const cacheKey = trimmedAddr ? trimmedAddr.toLowerCase() : '';

        // Step 1: Check cache in database by AddressQuery
        if (cacheKey) {
            const cachedRes = await pool.request()
                .input('Query', sql.NVarChar(500), cacheKey)
                .query('SELECT DisplayName, Latitude, Longitude FROM LocationMaster WHERE AddressQuery = @Query');
            
            if (cachedRes.recordset && cachedRes.recordset.length > 0) {
                const cached = cachedRes.recordset[0];
                return res.json({
                    success: true,
                    data: {
                        address: cached.DisplayName,
                        lat: cached.Latitude,
                        lon: cached.Longitude,
                        source: 'Cache'
                    }
                });
            }
        }

        // Step 2: Resolve coordinate from external APIs
        const apiKey = process.env.USE_GOOGLE_MAPS === 'true' ? process.env.GOOGLE_MAPS_API_KEY : null;
        let resolvedAddress = trimmedAddr;
        let lat = null;
        let lon = null;
        let sourceUsed = 'Google';

        if (apiKey) {
            if (placeId) {
                // Call Google Place Details API
                const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,formatted_address&key=${apiKey}&language=vi`;
                const dRes = await axios.get(detailUrl);
                if (dRes.data && dRes.data.result) {
                    const result = dRes.data.result;
                    resolvedAddress = result.formatted_address || resolvedAddress;
                    if (result.geometry && result.geometry.location) {
                        lat = result.geometry.location.lat;
                        lon = result.geometry.location.lng;
                    }
                }
            } else if (trimmedAddr) {
                // Call Google Geocoding API
                const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(trimmedAddr)}&key=${apiKey}&components=country:vn&language=vi`;
                const gRes = await axios.get(geocodeUrl);
                if (gRes.data && gRes.data.results && gRes.data.results.length > 0) {
                    const result = gRes.data.results[0];
                    resolvedAddress = result.formatted_address || resolvedAddress;
                    if (result.geometry && result.geometry.location) {
                        lat = result.geometry.location.lat;
                        lon = result.geometry.location.lng;
                    }
                }
            }
        }

        // Fallback: If Google is not available or resolution failed, use Nominatim
        if (lat === null || lon === null) {
            try {
                sourceUsed = 'Nominatim';
                const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmedAddr)}&limit=1&countrycodes=vn&accept-language=vi`;
                const nRes = await axios.get(nomUrl, {
                    headers: { 'User-Agent': 'CSR-Web-Enterprise-App/1.0' }
                });
                if (nRes.data && nRes.data.length > 0) {
                    resolvedAddress = nRes.data[0].display_name || resolvedAddress;
                    lat = parseFloat(nRes.data[0].lat);
                    lon = parseFloat(nRes.data[0].lon);
                }
            } catch (nomErr) {
                console.error('[Geocode Resolve] Nominatim resolution failed:', nomErr.message);
            }
        }

        // Step 3: Cache result in LocationMaster database if resolved successfully
        if (lat !== null && lon !== null) {
            const queryToSave = cacheKey || resolvedAddress.trim().toLowerCase();
            try {
                // Check once again to avoid PK duplication
                const doubleCheck = await pool.request()
                    .input('Query', sql.NVarChar(500), queryToSave)
                    .query('SELECT Id FROM LocationMaster WHERE AddressQuery = @Query');
                
                if (doubleCheck.recordset.length === 0) {
                    await pool.request()
                        .input('AddressQuery', sql.NVarChar(500), queryToSave)
                        .input('DisplayName',  sql.NVarChar(500), resolvedAddress)
                        .input('Latitude',     sql.Decimal(12, 9), lat)
                        .input('Longitude',    sql.Decimal(12, 9), lon)
                        .input('Source',       sql.NVarChar(50),  sourceUsed)
                        .query(`INSERT INTO LocationMaster (AddressQuery, DisplayName, Latitude, Longitude, Source)
                                VALUES (@AddressQuery, @DisplayName, @Latitude, @Longitude, @Source)`);
                }
            } catch (dbErr) {
                console.error('[Geocode Resolve] Saving cache failed:', dbErr.message);
            }

            return res.json({
                success: true,
                data: {
                    address: resolvedAddress,
                    lat,
                    lon,
                    source: sourceUsed
                }
            });
        }

        res.status(404).json({ success: false, error: 'Không thể giải mã tọa độ của địa điểm này' });
    } catch (err) { next(err); }
});

module.exports = router;
