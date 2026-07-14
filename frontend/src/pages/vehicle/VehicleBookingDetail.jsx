import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { getBookingDetail, updateBookingStatus, getVehicles, getDrivers } from '../../services/fleetApi';
import { formatDate } from '../../utils/helpers';

export default function VehicleBookingDetail({ bookingId, isOpen, onClose, onStatusUpdated, currentUser }) {
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Modals status
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Approval Form states
  const [vehiclesList, setVehiclesList] = useState([]);
  const [driversList, setDriversList] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [assignedNote, setAssignedNote] = useState('');

  // Rejection Form states
  const [rejectedReason, setRejectedReason] = useState('');

  // Cancel Form states
  const [cancelledReason, setCancelledReason] = useState('');

  useEffect(() => {
    if (isOpen && bookingId) {
      loadBookingDetails();
    }
  }, [isOpen, bookingId]);

  const loadBookingDetails = async () => {
    setLoading(true);
    try {
      const res = await getBookingDetail(bookingId);
      if (res.success) {
        setBooking(res.data);
      }
    } catch (err) {
      toast.error('Lỗi khi tải chi tiết yêu cầu đặt xe: ' + err.message);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const loadVehiclesAndDrivers = async () => {
    try {
      const [vRes, dRes] = await Promise.all([
        getVehicles({ isActive: true, status: 'Sẵn sàng' }),
        getDrivers({ isActive: true, status: 'Sẵn sàng' })
      ]);
      if (vRes.success) setVehiclesList(vRes.data);
      if (dRes.success) setDriversList(dRes.data);
    } catch (err) {
      toast.error('Lỗi tải danh mục xe/tài xế: ' + err.message);
    }
  };

  const handleOpenApproveModal = () => {
    loadVehiclesAndDrivers();
    setSelectedVehicleId('');
    setSelectedDriverId('');
    setAssignedNote('');
    setShowApproveModal(true);
  };

  const handleApprove = async () => {
    if (!selectedVehicleId) return toast.error('Vui lòng chọn xe phân công');

    setSubmitting(true);
    try {
      const res = await updateBookingStatus(bookingId, {
        newStatus: 'Đã duyệt',
        vehicleId: selectedVehicleId,
        driverId: selectedDriverId || null,
        assignedNote: assignedNote
      });

      if (res.success) {
        toast.success('Đã phê duyệt yêu cầu đặt xe thành công!');
        setShowApproveModal(false);
        loadBookingDetails();
        if (onStatusUpdated) onStatusUpdated();
      }
    } catch (err) {
      toast.error(err.message || 'Lỗi khi phê duyệt');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectedReason.trim()) return toast.error('Vui lòng nhập lý do từ chối');

    setSubmitting(true);
    try {
      const res = await updateBookingStatus(bookingId, {
        newStatus: 'Từ chối',
        rejectedReason: rejectedReason
      });

      if (res.success) {
        toast.success('Đã từ chối yêu cầu đặt xe.');
        setShowRejectModal(false);
        loadBookingDetails();
        if (onStatusUpdated) onStatusUpdated();
      }
    } catch (err) {
      toast.error(err.message || 'Lỗi khi từ chối');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    setSubmitting(true);
    try {
      const res = await updateBookingStatus(bookingId, {
        newStatus: 'Đã hủy',
        cancelledReason: cancelledReason
      });

      if (res.success) {
        toast.success('Đã hủy yêu cầu đặt xe.');
        setShowCancelModal(false);
        loadBookingDetails();
        if (onStatusUpdated) onStatusUpdated();
      }
    } catch (err) {
      toast.error(err.message || 'Lỗi khi hủy yêu cầu');
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async () => {
    if (!window.confirm('Xác nhận hoàn thành chuyến xe?')) return;
    try {
      const res = await updateBookingStatus(bookingId, {
        newStatus: 'Hoàn thành'
      });
      if (res.success) {
        toast.success('Đã hoàn thành chuyến xe.');
        loadBookingDetails();
        if (onStatusUpdated) onStatusUpdated();
      }
    } catch (err) {
      toast.error(err.message || 'Lỗi khi hoàn thành chuyến xe');
    }
  };

  if (!isOpen) return null;

  const role = currentUser?.role;
  const isApprover = ['Admin', 'BOD', 'PRD'].includes(role);
  const isCreator = currentUser?.mnv === booking?.RequesterMNV;

  const getStatusBadge = (status) => {
    const map = {
      'Đã duyệt': { bg: 'bg-green-100', text: 'text-green-700' },
      'Từ chối': { bg: 'bg-red-100', text: 'text-red-700' },
      'Đã hủy': { bg: 'bg-gray-200', text: 'text-gray-700' },
      'Chờ duyệt': { bg: 'bg-blue-100', text: 'text-blue-700' },
      'Hoàn thành': { bg: 'bg-purple-100', text: 'text-purple-700' },
    };
    const s = map[status] || { bg: 'bg-gray-100', text: 'text-gray-600' };
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${s.bg} ${s.text}`}>
        {status}
      </span>
    );
  };

  let parsedStops = [];
  if (booking?.Stops) {
    try {
      parsedStops = JSON.parse(booking.Stops);
    } catch (e) {
      parsedStops = [];
    }
  }

  return (
    <>
      {/* Drawer Overlay */}
      <div className="fixed inset-0 bg-black/40 z-[60] backdrop-blur-sm" onClick={onClose} />

      {/* Side Drawer */}
      <div className="fixed top-0 right-0 h-full w-full sm:w-[540px] bg-white z-[70] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-border flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-primary font-bold text-sm">Chi tiết yêu cầu xe</span>
              <span className="text-on-surface-variant opacity-40">|</span>
              <code className="text-xs bg-gray-100 px-2 py-0.5 rounded">{booking?.BookingCode}</code>
              {booking?.Status && getStatusBadge(booking.Status)}
            </div>
            <h3 className="font-bold text-lg leading-tight">Chuyến đi: {booking?.Destination}</h3>
          </div>
          <button className="material-symbols-outlined p-1.5 hover:bg-gray-100 rounded-full text-outline" onClick={onClose}>
            close
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {loading || !booking ? (
            <div className="flex justify-center items-center h-48 text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin mr-2">refresh</span> Đang tải thông tin...
            </div>
          ) : (
            <>
              {/* Lộ Trình */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-primary tracking-wider uppercase border-b border-border pb-1">📍 Chi Tiết Lộ Trình</h4>
                <div className="grid grid-cols-1 gap-2 text-sm">
                  <div>
                    <span className="text-xs text-on-surface-variant block">Điểm đón khách (Pickup):</span>
                    <span className="font-semibold">{booking.PickupLocation}</span>
                  </div>
                  {parsedStops.length > 0 && (
                    <div>
                      <span className="text-xs text-on-surface-variant block">Điểm dừng trung gian:</span>
                      <ul className="list-disc pl-5 font-medium space-y-0.5 mt-0.5">
                        {parsedStops.map((stop, i) => (
                          <li key={i}>{stop}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div>
                    <span className="text-xs text-on-surface-variant block">Điểm đến (Destination):</span>
                    <span className="font-semibold">{booking.Destination}</span>
                  </div>
                </div>
              </div>

              {/* Thông tin thời gian và nhân sự */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-primary tracking-wider uppercase border-b border-border pb-1">📅 Thời Gian & Nhân Sự</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-on-surface-variant block">Giờ khởi hành:</span>
                    <span className="font-semibold">{formatDate(booking.DepartureTime, 'dd/MM/yyyy HH:mm')}</span>
                  </div>
                  <div>
                    <span className="text-xs text-on-surface-variant block">Giờ về (dự kiến):</span>
                    <span className="font-semibold">{booking.ReturnTime ? formatDate(booking.ReturnTime, 'dd/MM/yyyy HH:mm') : 'Chưa đăng ký'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-on-surface-variant block">Người yêu cầu:</span>
                    <span className="font-semibold">{booking.RequesterName} ({booking.RequesterDept || 'Không rõ PB'})</span>
                  </div>
                  <div>
                    <span className="text-xs text-on-surface-variant block">Số hành khách:</span>
                    <span className="font-semibold">{booking.PassengerCount} người</span>
                  </div>
                  <div>
                    <span className="text-xs text-on-surface-variant block">Độ ưu tiên:</span>
                    <span className="font-semibold">{booking.Priority}</span>
                  </div>
                  <div>
                    <span className="text-xs text-on-surface-variant block">Ngày tạo yêu cầu:</span>
                    <span className="font-semibold">{formatDate(booking.CreatedAt, 'dd/MM/yyyy HH:mm')}</span>
                  </div>
                </div>
              </div>

              {/* Người tham gia đi cùng */}
              {(booking.Attendees || booking.AttendeesEmail) && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-primary tracking-wider uppercase border-b border-border pb-1">👥 Người Tham Gia Đi Cùng</h4>
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    {booking.Attendees && (
                      <div>
                        <span className="text-xs text-on-surface-variant block">Danh sách người đi cùng:</span>
                        <span className="font-semibold">{booking.Attendees}</span>
                      </div>
                    )}
                    {booking.AttendeesEmail && (
                      <div>
                        <span className="text-xs text-on-surface-variant block">Email:</span>
                        <span className="text-on-surface-variant break-all">{booking.AttendeesEmail}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Mục đích di chuyển */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-primary tracking-wider uppercase border-b border-border pb-1">🎯 Mục Đích Sử Dụng Xe</h4>
                <div className="p-3 bg-gray-50 rounded-xl text-sm italic">
                  "{booking.Purpose}"
                </div>
              </div>

              {/* Ghi chú thêm */}
              {booking.Notes && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-primary tracking-wider uppercase border-b border-border pb-1">📝 Ghi Chú Yêu Cầu</h4>
                  <p className="text-sm font-medium">{booking.Notes}</p>
                </div>
              )}

              {/* Thông tin phân công xe và tài xế (nếu đã duyệt) */}
              {booking.Status === 'Đã duyệt' && (
                <div className="p-4 bg-green-50/50 border border-green-200 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-green-800 tracking-wider uppercase">🚗 Xe & Tài Xế Phân Công</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-xs text-green-700 block">Xe phân phối:</span>
                      <span className="font-bold text-green-900">{booking.VehiclePlate} ({booking.VehicleBrand} {booking.VehicleModel})</span>
                    </div>
                    <div>
                      <span className="text-xs text-green-700 block">Tài xế lái xe:</span>
                      <span className="font-bold text-green-900">{booking.DriverName || 'Tự lái'} {booking.DriverPhone ? `(${booking.DriverPhone})` : ''}</span>
                    </div>
                  </div>
                  {booking.AssignedNote && (
                    <div className="text-xs text-green-800 border-t border-green-200/60 pt-2">
                      <span className="font-semibold block">Ghi chú điều phối:</span>
                      <span>{booking.AssignedNote}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Thông tin Từ chối/Hủy nếu có */}
              {booking.Status === 'Từ chối' && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                  <h4 className="text-xs font-bold text-red-800 tracking-wider uppercase mb-1">❌ Lý Do Từ Chối</h4>
                  <p className="text-sm text-red-900 font-semibold">{booking.RejectedReason || 'Không ghi rõ lý do.'}</p>
                  <p className="text-xs text-red-700 mt-2">Phê duyệt bởi: {booking.ApprovedBy} vào lúc {formatDate(booking.ApprovedAt, 'dd/MM/yyyy HH:mm')}</p>
                </div>
              )}

              {booking.Status === 'Đã hủy' && (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                  <h4 className="text-xs font-bold text-gray-800 tracking-wider uppercase mb-1">🛑 Lý Do Hủy Yêu Cầu</h4>
                  <p className="text-sm text-gray-900 font-semibold">{booking.CancelledReason || 'Người dùng tự hủy.'}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!loading && booking && (
          <div className="p-5 border-t border-border bg-gray-50 flex gap-2 justify-end">
            {/* Chờ duyệt + là Approver -> Duyệt / Từ chối */}
            {booking.Status === 'Chờ duyệt' && isApprover && (
              <>
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="btn btn-outline text-danger hover:bg-red-50 hover:border-red-300 flex-1 sm:flex-none"
                >
                  Từ chối
                </button>
                <button
                  onClick={handleOpenApproveModal}
                  className="btn btn-primary flex-1 sm:flex-none"
                >
                  Duyệt & Phân Xe
                </button>
              </>
            )}

            {/* Chờ duyệt + là Creator -> Hủy yêu cầu */}
            {booking.Status === 'Chờ duyệt' && isCreator && !isApprover && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="btn btn-outline text-danger hover:bg-red-50 hover:border-red-300 w-full"
              >
                Hủy yêu cầu
              </button>
            )}

            {/* Đã duyệt + là Approver -> Hoàn thành */}
            {booking.Status === 'Đã duyệt' && isApprover && (
              <button
                onClick={handleComplete}
                className="btn btn-primary w-full bg-purple-600 hover:bg-purple-700 border-none"
              >
                Hoàn Thành Chuyến Đi
              </button>
            )}
          </div>
        )}
      </div>

      {/* --- APPROVAL MODAL --- */}
      {showApproveModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowApproveModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 z-10">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-primary">
              <span className="material-symbols-outlined">directions_car</span>
              Duyệt & Phân Công Xe
            </h3>

            <div className="space-y-4">
              <div className="form-group">
                <label className="text-xs font-semibold">Chọn Xe Công Tác <span className="text-danger">*</span></label>
                <select
                  className="w-full text-sm p-2 border border-border rounded-md"
                  value={selectedVehicleId}
                  onChange={e => setSelectedVehicleId(e.target.value)}
                >
                  <option value="">-- Chọn xe sẵn sàng --</option>
                  {vehiclesList.map(v => (
                    <option key={v.Id} value={v.Id}>{v.PlateNumber} - {v.Brand} {v.Model} ({v.Seats} chỗ)</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="text-xs font-semibold">Chọn Tài Xế Phụ Trách</label>
                <select
                  className="w-full text-sm p-2 border border-border rounded-md"
                  value={selectedDriverId}
                  onChange={e => setSelectedDriverId(e.target.value)}
                >
                  <option value="">-- Tự lái / Không phân công --</option>
                  {driversList.map(d => (
                    <option key={d.Id} value={d.Id}>{d.FullName} ({d.Phone || 'Không có SĐT'}) - {d.LicenseClass || 'Không có bằng'}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="text-xs font-semibold">Ghi chú phân công cho tài xế/người đi</label>
                <textarea
                  rows="2"
                  className="w-full text-sm p-2 border border-border rounded-md"
                  placeholder="VD: Nhận chìa khóa xe tại tủ sảnh chính..."
                  value={assignedNote}
                  onChange={e => setAssignedNote(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setShowApproveModal(false)}
                disabled={submitting}
              >
                Hủy
              </button>
              <button
                className="btn btn-primary btn-sm min-w-[100px]"
                onClick={handleApprove}
                disabled={submitting}
              >
                {submitting ? 'Đang duyệt...' : 'Phê Duyệt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- REJECT MODAL --- */}
      {showRejectModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowRejectModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 z-10">
            <h3 className="font-bold text-lg mb-2 text-danger flex items-center gap-2">
              <span className="material-symbols-outlined">cancel</span>
              Từ Chối Yêu Cầu Đặt Xe
            </h3>
            <p className="text-sm text-on-surface-variant mb-4">Vui lòng cung cấp lý do từ chối để người đăng ký điều chỉnh lại.</p>

            <div className="form-group">
              <textarea
                rows="3"
                className="w-full text-sm p-2 border border-border rounded-md"
                placeholder="Nhập lý do từ chối cụ thể..."
                value={rejectedReason}
                onChange={e => setRejectedReason(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setShowRejectModal(false)}
                disabled={submitting}
              >
                Hủy
              </button>
              <button
                className="btn btn-danger btn-sm min-w-[100px]"
                onClick={handleReject}
                disabled={submitting}
              >
                {submitting ? 'Đang xử lý...' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CANCEL MODAL --- */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCancelModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 z-10">
            <h3 className="font-bold text-lg mb-2 text-danger flex items-center gap-2">
              <span className="material-symbols-outlined">delete</span>
              Hủy Yêu Cầu Đặt Xe
            </h3>
            <p className="text-sm text-on-surface-variant mb-4">Xác nhận hủy yêu cầu xe công tác? Hãy ghi rõ lý do hủy.</p>

            <div className="form-group">
              <textarea
                rows="3"
                className="w-full text-sm p-2 border border-border rounded-md"
                placeholder="Nhập lý do hủy chuyến..."
                value={cancelledReason}
                onChange={e => setCancelledReason(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setShowCancelModal(false)}
                disabled={submitting}
              >
                Hủy
              </button>
              <button
                className="btn btn-danger btn-sm min-w-[100px]"
                onClick={handleCancel}
                disabled={submitting}
              >
                {submitting ? 'Đang xử lý...' : 'Xác nhận Hủy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
