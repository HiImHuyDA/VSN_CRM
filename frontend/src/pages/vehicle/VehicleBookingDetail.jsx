import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getBookingDetail, updateBookingStatus, getVehicles, getDrivers, getBookingHistory } from '../../services/fleetApi';
import { formatDate } from '../../utils/helpers';

export default function VehicleBookingDetail({ bookingId, isOpen, onClose, onStatusUpdated, currentUser }) {
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('info'); // 'info', 'route', 'approval', 'history'
  const [historyList, setHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

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
      loadHistoryLogs();
      setActiveTab('info');
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

  const loadHistoryLogs = async () => {
    setLoadingHistory(true);
    try {
      const res = await getBookingHistory(bookingId);
      if (res.success) {
        setHistoryList(res.data || []);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoadingHistory(false);
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

  const handleSupervisorApprove = async () => {
    if (!window.confirm('Xác nhận phê duyệt yêu cầu đi công tác này?')) return;
    setSubmitting(true);
    try {
      const res = await updateBookingStatus(bookingId, {
        newStatus: 'Giám sát đã duyệt'
      });
      if (res.success) {
        toast.success('Đã phê duyệt yêu cầu đi công tác.');
        loadBookingDetails();
        loadHistoryLogs();
        if (onStatusUpdated) onStatusUpdated();
      }
    } catch (err) {
      toast.error(err.message || 'Lỗi khi phê duyệt');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedVehicleId) return toast.error('Vui lòng chọn xe phân công');

    setSubmitting(true);
    try {
      const res = await updateBookingStatus(bookingId, {
        newStatus: 'Team Admin đã duyệt',
        vehicleId: selectedVehicleId,
        driverId: selectedDriverId || null,
        assignedNote: assignedNote
      });

      if (res.success) {
        toast.success('Đã điều phối phương tiện thành công!');
        setShowApproveModal(false);
        loadBookingDetails();
        loadHistoryLogs();
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
      const nextStatus = booking.Status === 'Giám sát đã duyệt' ? 'Team Admin từ chối' : 'Giám sát từ chối';
      const res = await updateBookingStatus(bookingId, {
        newStatus: nextStatus,
        rejectedReason: rejectedReason
      });

      if (res.success) {
        toast.success('Đã từ chối yêu cầu đặt xe.');
        setShowRejectModal(false);
        loadBookingDetails();
        loadHistoryLogs();
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
        loadHistoryLogs();
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
        loadHistoryLogs();
        if (onStatusUpdated) onStatusUpdated();
      }
    } catch (err) {
      toast.error(err.message || 'Lỗi khi hoàn thành chuyến xe');
    }
  };

  if (!isOpen) return null;

  const role = currentUser?.role;
  const canEdit = !!booking?.permissions?.canEdit;
  const canCancel = !!booking?.permissions?.canCancel;
  const canApproveSupervisor = !!booking?.permissions?.canApproveSupervisor;
  const canApproveTeamAdmin = !!booking?.permissions?.canApproveTeamAdmin;


  const getStatusBadge = (status) => {
    const map = {
      'Chờ phản hồi': { bg: 'bg-blue-100', text: 'text-blue-700' },
      'Giám sát đã duyệt': { bg: 'bg-amber-100', text: 'text-amber-700' },
      'Giám sát từ chối': { bg: 'bg-red-100', text: 'text-red-700' },
      'Team Admin đã duyệt': { bg: 'bg-green-100', text: 'text-green-700' },
      'Team Admin từ chối': { bg: 'bg-red-100', text: 'text-red-700' },
      'Đã duyệt': { bg: 'bg-green-100', text: 'text-green-700' },
      'Từ chối': { bg: 'bg-red-100', text: 'text-red-700' },
      'Đã hủy': { bg: 'bg-gray-200', text: 'text-gray-700' },
      'Hoàn thành': { bg: 'bg-purple-100', text: 'text-purple-700' },
      'Chờ duyệt': { bg: 'bg-blue-100', text: 'text-blue-700' },
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

  // Phân tích thông tin phê duyệt từ lịch sử hoặc thông tin trên booking
  const getApprovalDetails = () => {
    let supervisor = { status: 'pending', name: '', email: '', comment: '', date: null };
    let teamAdmin = { status: 'pending', name: '', email: '', comment: '', date: null };

    const sortedLogs = [...historyList].sort((a, b) => new Date(a.CreatedAt) - new Date(b.CreatedAt));

    sortedLogs.forEach(log => {
      let parsed = {};
      try {
        if (log.Details) parsed = JSON.parse(log.Details);
      } catch (e) {}

      if (log.Action === 'Giám sát đã duyệt') {
        supervisor = {
          status: 'approved',
          name: parsed.actorName || log.CreatorName || 'Giám sát trực tiếp',
          email: parsed.actorEmail || '',
          comment: parsed.comment || 'Đã duyệt yêu cầu',
          date: log.CreatedAt
        };
      } else if (log.Action === 'Giám sát từ chối') {
        supervisor = {
          status: 'rejected',
          name: parsed.actorName || log.CreatorName || 'Giám sát trực tiếp',
          email: parsed.actorEmail || '',
          comment: parsed.comment || log.Details || '',
          date: log.CreatedAt
        };
      } else if (log.Action === 'Team Admin đã duyệt' || log.Action === 'Đã duyệt') {
        supervisor.status = 'approved';
        teamAdmin = {
          status: 'approved',
          name: parsed.actorName || log.CreatorName || booking?.ApprovedBy || 'Team Admin',
          email: parsed.actorEmail || '',
          comment: parsed.comment || booking?.AssignedNote || '',
          date: log.CreatedAt || booking?.ApprovedAt
        };
      } else if (log.Action === 'Team Admin từ chối' || log.Action === 'Từ chối') {
        teamAdmin = {
          status: 'rejected',
          name: parsed.actorName || log.CreatorName || 'Team Admin',
          email: parsed.actorEmail || '',
          comment: parsed.comment || booking?.RejectedReason || '',
          date: log.CreatedAt
        };
      }
    });

    if (historyList.length === 0 && booking) {
      const status = booking.Status;
      if (['Giám sát đã duyệt', 'Team Admin đã duyệt', 'Đã duyệt', 'Hoàn thành'].includes(status)) {
        supervisor = {
          status: 'approved',
          name: 'Giám sát trực tiếp',
          email: '',
          comment: 'Đã duyệt qua Teams',
          date: booking.UpdatedAt
        };
      } else if (status === 'Giám sát từ chối') {
        supervisor = {
          status: 'rejected',
          name: 'Giám sát trực tiếp',
          email: '',
          comment: booking.RejectedReason || 'Từ chối yêu cầu',
          date: booking.UpdatedAt
        };
      }

      if (['Team Admin đã duyệt', 'Đã duyệt', 'Hoàn thành'].includes(status)) {
        teamAdmin = {
          status: 'approved',
          name: booking.ApprovedBy || 'Team Admin',
          email: '',
          comment: booking.AssignedNote || 'Đã phân xe & tài xế',
          date: booking.ApprovedAt || booking.UpdatedAt
        };
      } else if (status === 'Team Admin từ chối' || status === 'Từ chối') {
        teamAdmin = {
          status: 'rejected',
          name: booking.ApprovedBy || 'Team Admin',
          email: '',
          comment: booking.RejectedReason || 'Từ chối phân xe',
          date: booking.ApprovedAt || booking.UpdatedAt
        };
      }
    }

    return { supervisor, teamAdmin };
  };

  const { supervisor, teamAdmin } = getApprovalDetails();

  const TAB = (key, label) => (
    <button
      className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
        activeTab === key
          ? 'border-primary text-primary'
          : 'border-transparent text-on-surface-variant hover:text-primary'
      }`}
      onClick={() => setActiveTab(key)}
    >
      {label}
    </button>
  );

  return ReactDOM.createPortal(
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

        {/* Tabs Bar */}
        <div className="flex border-b border-outline-variant bg-surface px-2 overflow-x-auto">
          {TAB('info', 'Thông tin')}
          {TAB('route', 'Lộ trình')}
          {TAB('approval', 'Phê duyệt')}
          {TAB('history', `Lịch sử (${historyList.length})`)}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading || !booking ? (
            <div className="flex justify-center items-center h-48 text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin mr-2">refresh</span> Đang tải thông tin...
            </div>
          ) : (
            <>
              {/* TAB 1: THÔNG TIN */}
              {activeTab === 'info' && (
                <div className="space-y-6">
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
                        <span className="text-xs text-on-surface-variant block">Loại phương tiện:</span>
                        <span className="font-semibold">{booking.VehicleType || 'Xe công ty'}</span>
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
                  {['Đã duyệt', 'Team Admin đã duyệt', 'Hoàn thành'].includes(booking.Status) && (
                    <div className="p-4 bg-green-50/50 border border-green-200 rounded-xl space-y-3">
                      <h4 className="text-xs font-bold text-green-800 tracking-wider uppercase">🚗 Xe & Tài Xế Phân Công</h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-xs text-green-700 block">Xe phân phối:</span>
                          <span className="font-bold text-green-900">{booking.VehiclePlate || 'Chưa rõ'} ({booking.VehicleBrand || 'Xe công tác'})</span>
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
                  {['Từ chối', 'Giám sát từ chối', 'Team Admin từ chối'].includes(booking.Status) && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                      <h4 className="text-xs font-bold text-red-800 tracking-wider uppercase mb-1">❌ Lý Do Từ Chối</h4>
                      <p className="text-sm text-red-900 font-semibold">{booking.RejectedReason || 'Không ghi rõ lý do.'}</p>
                      {booking.ApprovedBy && (
                        <p className="text-xs text-red-700 mt-2">Từ chối bởi: {booking.ApprovedBy} {booking.ApprovedAt ? `vào lúc ${formatDate(booking.ApprovedAt, 'dd/MM/yyyy HH:mm')}` : ''}</p>
                      )}
                    </div>
                  )}

                  {booking.Status === 'Đã hủy' && (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                      <h4 className="text-xs font-bold text-gray-800 tracking-wider uppercase mb-1">🛑 Lý Do Hủy Yêu Cầu</h4>
                      <p className="text-sm text-gray-900 font-semibold">{booking.CancelledReason || 'Người dùng tự hủy.'}</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: LỘ TRÌNH */}
              {activeTab === 'route' && (
                <div className="space-y-6">
                  <h4 className="text-xs font-bold text-primary tracking-wider uppercase border-b border-border pb-1">📍 Chi Tiết Lộ Trình</h4>
                  <div className="relative pl-6 space-y-6 border-l-2 border-primary/20 ml-3 py-2">
                    {/* Điểm đón */}
                    <div className="relative">
                      <span className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-success flex items-center justify-center border-2 border-white shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                      </span>
                      <div className="text-sm">
                        <span className="text-xs text-on-surface-variant block font-semibold uppercase tracking-wider">Điểm đón khách (Pickup):</span>
                        <span className="font-semibold text-on-surface text-base">{booking.PickupLocation}</span>
                      </div>
                    </div>

                    {/* Các điểm dừng */}
                    {parsedStops.map((stop, index) => (
                      <div key={index} className="relative">
                        <span className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center border-2 border-white shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                        </span>
                        <div className="text-sm">
                          <span className="text-xs text-on-surface-variant block font-semibold uppercase tracking-wider">Điểm dừng {index + 1}:</span>
                          <span className="font-medium text-on-surface">{stop}</span>
                        </div>
                      </div>
                    ))}

                    {/* Điểm đến */}
                    <div className="relative">
                      <span className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center border-2 border-white shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                      </span>
                      <div className="text-sm">
                        <span className="text-xs text-on-surface-variant block font-semibold uppercase tracking-wider">Điểm đến cuối (Destination):</span>
                        <span className="font-bold text-on-surface text-base">{booking.Destination}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: PHÊ DUYỆT */}
              {activeTab === 'approval' && (
                <div className="space-y-6">
                  {/* Cấp 1: Giám sát */}
                  <div className="p-4 rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm space-y-3">
                    <div className="flex justify-between items-center border-b border-outline-variant/60 pb-2">
                      <span className="font-bold text-sm text-primary">CẤP 1: GIÁM SÁT DUYỆT</span>
                      {supervisor.status === 'approved' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-success-container text-success border border-success/20">
                          Đã duyệt
                        </span>
                      )}
                      {supervisor.status === 'rejected' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-error-container text-error border border-error/20">
                          Từ chối
                        </span>
                      )}
                      {supervisor.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Chờ duyệt
                        </span>
                      )}
                    </div>
                    <div className="text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-on-surface-variant">Người duyệt:</span>
                        <span className="font-semibold text-on-surface">{supervisor.name || 'Giám sát trực tiếp (Quản lý)'}</span>
                      </div>
                      {supervisor.email && (
                        <div className="flex justify-between">
                          <span className="text-on-surface-variant">Email:</span>
                          <span className="font-medium text-on-surface">{supervisor.email}</span>
                        </div>
                      )}
                      {supervisor.date && (
                        <div className="flex justify-between">
                          <span className="text-on-surface-variant">Thời gian:</span>
                          <span className="font-medium text-on-surface">{formatDate(supervisor.date, 'dd/MM/yyyy HH:mm')}</span>
                        </div>
                      )}
                      {(supervisor.comment || supervisor.status === 'rejected') && (
                        <div className="mt-2 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                          <span className="text-xs text-on-surface-variant font-semibold block mb-0.5">Ý kiến/Lý do:</span>
                          <span className="text-sm font-medium italic">"{supervisor.comment || 'Không có ý kiến'}"</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Cấp 2: Team Admin */}
                  <div className="p-4 rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm space-y-3">
                    <div className="flex justify-between items-center border-b border-outline-variant/60 pb-2">
                      <span className="font-bold text-sm text-primary">CẤP 2: TEAM ADMIN DUYỆT & XẾP XE</span>
                      {teamAdmin.status === 'approved' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-success-container text-success border border-success/20">
                          Đã duyệt
                        </span>
                      )}
                      {teamAdmin.status === 'rejected' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-error-container text-error border border-error/20">
                          Từ chối
                        </span>
                      )}
                      {teamAdmin.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Chờ duyệt
                        </span>
                      )}
                    </div>
                    <div className="text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-on-surface-variant">Người duyệt:</span>
                        <span className="font-semibold text-on-surface">{teamAdmin.name || 'Ban điều phối (Team Admin)'}</span>
                      </div>
                      {teamAdmin.email && (
                        <div className="flex justify-between">
                          <span className="text-on-surface-variant">Email:</span>
                          <span className="font-medium text-on-surface">{teamAdmin.email}</span>
                        </div>
                      )}
                      {teamAdmin.date && (
                        <div className="flex justify-between">
                          <span className="text-on-surface-variant">Thời gian:</span>
                          <span className="font-medium text-on-surface">{formatDate(teamAdmin.date, 'dd/MM/yyyy HH:mm')}</span>
                        </div>
                      )}
                      {(teamAdmin.comment || teamAdmin.status === 'rejected') && (
                        <div className="mt-2 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                          <span className="text-xs text-on-surface-variant font-semibold block mb-0.5">Ghi chú phân xe/Ý kiến:</span>
                          <span className="text-sm font-medium italic">"{teamAdmin.comment || 'Không có ghi chú'}"</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: LỊCH SỬ */}
              {activeTab === 'history' && (
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-primary mb-3">Lịch sử hoạt động của đơn</h4>
                  {loadingHistory ? (
                    <div className="text-center py-6 text-on-surface-variant text-sm">Đang tải lịch sử...</div>
                  ) : historyList.length === 0 ? (
                    <p className="text-sm text-on-surface-variant">Không có lịch sử ghi nhận nào.</p>
                  ) : (
                    <div className="space-y-3">
                      {historyList.map((log) => {
                        let parsed = {};
                        try {
                          if (log.Details) parsed = JSON.parse(log.Details);
                        } catch (e) {}
                        return (
                          <div key={log.Id} className="p-3.5 rounded-xl border border-outline-variant bg-surface-container-lowest hover:border-primary/30 transition-colors">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-bold text-sm text-on-surface bg-surface-container px-2 py-0.5 rounded">
                                {log.Action}
                              </span>
                              <span className="text-[11px] text-on-surface-variant">
                                {formatDate(log.CreatedAt, 'dd/MM/yyyy HH:mm:ss')}
                              </span>
                            </div>
                            <div className="text-xs text-on-surface-variant mt-1.5 flex flex-wrap justify-between gap-1">
                              <span>Thực hiện bởi: <strong className="text-on-surface font-semibold">{log.CreatorName || log.MNV}</strong></span>
                              {parsed.comment && (
                                <span className="w-full text-xs bg-gray-50 p-1.5 rounded mt-1 text-on-surface font-medium block italic">
                                  "{parsed.comment}"
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!loading && booking && (
          <div className="p-5 border-t border-border bg-gray-50 flex gap-2 justify-end flex-wrap">
            {/* Chỉnh sửa */}
            {canEdit && (
              <button
                onClick={() => {
                  navigate(`/vehicle/new?bookingId=${booking.Id}`);
                  onClose();
                }}
                className="btn btn-outline text-primary border-primary hover:bg-blue-50 flex-1 sm:flex-none"
              >
                Chỉnh sửa
              </button>
            )}

            {/* Hủy đơn */}
            {canCancel && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="btn btn-outline text-danger border-danger hover:bg-red-50 flex-1 sm:flex-none"
              >
                Hủy đơn
              </button>
            )}

            {/* Phê duyệt cấp 1 */}
            {canApproveSupervisor && (
              <>
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="btn btn-outline text-danger hover:bg-red-50 hover:border-red-300 flex-1 sm:flex-none"
                >
                  Từ chối
                </button>
                <button
                  onClick={handleSupervisorApprove}
                  className="btn btn-primary flex-1 sm:flex-none"
                >
                  Duyệt Đơn
                </button>
              </>
            )}

            {/* Phê duyệt cấp 2 */}
            {canApproveTeamAdmin && (
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

            {/* Hoàn thành */}
            {(role === 'Admin' || role === 'TeamAdmin') && ['Đã duyệt', 'Team Admin đã duyệt'].includes(booking.Status) && (
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
    </>,
    document.body
  );
}
