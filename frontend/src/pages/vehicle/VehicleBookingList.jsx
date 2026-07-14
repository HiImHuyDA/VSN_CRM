import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getBookings, exportBookingsUrl } from '../../services/fleetApi';
import { formatDate } from '../../utils/helpers';
import VehicleBookingDetail from './VehicleBookingDetail';

const STATUS_OPTIONS = ['Chờ duyệt', 'Đã duyệt', 'Từ chối', 'Đã hủy', 'Hoàn thành'];

export default function VehicleBookingList({ currentUser }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // API states
  const [bookings, setBookings] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Pagination & Filters (from URL search params as single source of truth)
  const page = parseInt(searchParams.get('page')) || 1;
  const status = searchParams.get('status') || '';
  const search = searchParams.get('search') || '';
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';
  const activeTab = searchParams.get('tab') || 'all'; // all, mine
  const selectedBookingId = searchParams.get('bookingId') || null;

  const isApprover = ['Admin', 'BOD', 'PRD'].includes(currentUser?.role);

  useEffect(() => {
    fetchBookings();
  }, [page, status, search, dateFrom, dateTo, activeTab, currentUser]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        pageSize: 20,
        search,
        status,
        dateFrom,
        dateTo
      };

      // If activeTab is 'mine', pass the user's MNV
      if (activeTab === 'mine') {
        params.requesterMNV = currentUser?.mnv;
      }

      const res = await getBookings(params);
      if (res.success) {
        setBookings(res.data);
        setTotalCount(res.totalCount);
      }
    } catch (err) {
      toast.error('Lỗi khi tải danh sách đặt xe: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateParams = (newParams) => {
    const updated = new URLSearchParams(searchParams);
    Object.entries(newParams).forEach(([key, val]) => {
      if (val === null || val === undefined || val === '') {
        updated.delete(key);
      } else {
        updated.set(key, val);
      }
    });
    // Reset to page 1 on filter changes
    if (newParams.page === undefined) {
      updated.set('page', '1');
    }
    setSearchParams(updated);
  };

  const handleClearFilters = () => {
    setSearchParams({ tab: activeTab });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const exportParams = {
        status,
        dateFrom,
        dateTo,
        ...(activeTab === 'mine' ? { requesterMNV: currentUser?.mnv } : {})
      };

      const downloadUrl = exportBookingsUrl(exportParams);

      // Request download file
      const response = await fetch(downloadUrl, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('csr_token')}`
        }
      });

      if (!response.ok) throw new Error('Không thể tạo file Excel');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `DSach_DangKyXe_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Đã xuất Excel thành công!');
    } catch (err) {
      toast.error('Lỗi khi xuất file: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

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
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${s.bg} ${s.text}`}>
        {status}
      </span>
    );
  };

  const totalPages = Math.ceil(totalCount / 20) || 1;

  const hasActiveFilters = status || search || dateFrom || dateTo;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-end mb-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface mb-1">Quản Lý Đặt Xe Công Tác</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="btn btn-outline btn-sm flex items-center gap-1.5 justify-center disabled:opacity-60"
          >
            <span className={`material-symbols-outlined text-[16px] ${exporting ? 'animate-spin' : ''}`}>
              {exporting ? 'refresh' : 'download'}
            </span>
            {exporting ? 'Đang xuất...' : 'Xuất Excel'}
          </button>
          <button
            onClick={() => navigate('/vehicle/new')}
            className="btn btn-primary btn-sm flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Đăng ký xe
          </button>
        </div>
      </div>

      {/* Tabs list: all bookings / mine */}
      <div className="flex gap-4 border-b border-outline-variant mb-6">
        <button
          className={`pb-2 px-2 font-semibold transition-colors ${activeTab === 'all' ? 'border-b-2 border-primary text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
          onClick={() => updateParams({ tab: 'all' })}
        >
          Tất cả yêu cầu
        </button>
        <button
          className={`pb-2 px-2 font-semibold transition-colors ${activeTab === 'mine' ? 'border-b-2 border-primary text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
          onClick={() => updateParams({ tab: 'mine' })}
        >
          Yêu cầu của tôi
        </button>
      </div>

      {/* Filters Section */}
      <div className="bg-white border border-outline-variant rounded-xl p-4 mb-6 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Từ khóa tìm kiếm</label>
            <input
              type="text"
              placeholder="Mã số, người đặt, điểm đến..."
              value={search}
              onChange={e => updateParams({ search: e.target.value })}
              className="w-full text-sm p-2 border border-border rounded-md"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Trạng thái</label>
            <select
              value={status}
              onChange={e => updateParams({ status: e.target.value })}
              className="w-full text-sm p-2 border border-border rounded-md"
            >
              <option value="">Tất cả trạng thái</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Từ ngày đi</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => updateParams({ dateFrom: e.target.value })}
              className="w-full text-sm p-2 border border-border rounded-md"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Đến ngày đi</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => updateParams({ dateTo: e.target.value })}
              className="w-full text-sm p-2 border border-border rounded-md"
            />
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex justify-end">
            <button
              onClick={handleClearFilters}
              className="btn btn-outline btn-xs flex items-center gap-1 text-danger border-red-200 hover:bg-red-50"
            >
              <span className="material-symbols-outlined text-[14px]">backspace</span>
              Xóa bộ lọc
            </button>
          </div>
        )}
      </div>

      {/* Table grid scroll container */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto overflow-y-auto custom-scrollbar max-h-[calc(100vh-340px)]">
          <table className="w-full text-left whitespace-nowrap border-collapse">
            <thead>
              <tr className="border-b border-outline-variant bg-gray-50">
                <th className="px-4 py-3 text-xs font-bold text-on-surface-variant sticky top-0 z-10 bg-surface-container">Mã số</th>
                <th className="px-4 py-3 text-xs font-bold text-on-surface-variant sticky top-0 z-10 bg-surface-container">Người đặt</th>
                <th className="px-4 py-3 text-xs font-bold text-on-surface-variant sticky top-0 z-10 bg-surface-container">Điểm đón khách</th>
                <th className="px-4 py-3 text-xs font-bold text-on-surface-variant sticky top-0 z-10 bg-surface-container">Điểm đến</th>
                <th className="px-4 py-3 text-xs font-bold text-on-surface-variant sticky top-0 z-10 bg-surface-container">Giờ đi</th>
                <th className="px-4 py-3 text-xs font-bold text-on-surface-variant sticky top-0 z-10 bg-surface-container">Số khách</th>
                <th className="px-4 py-3 text-xs font-bold text-on-surface-variant sticky top-0 z-10 bg-surface-container">Xe phân công</th>
                <th className="px-4 py-3 text-xs font-bold text-on-surface-variant sticky top-0 z-10 bg-surface-container">Tài xế</th>
                <th className="px-4 py-3 text-xs font-bold text-on-surface-variant sticky top-0 z-10 bg-surface-container">Trạng thái</th>
                <th className="px-4 py-3 text-xs font-bold text-on-surface-variant sticky top-0 z-10 bg-surface-container">Ngày tạo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-on-surface-variant">
                    <div className="flex justify-center items-center gap-2">
                      <span className="material-symbols-outlined animate-spin text-[20px]">refresh</span>
                      Đang tải danh sách đặt xe...
                    </div>
                  </td>
                </tr>
              ) : bookings.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-on-surface-variant">
                    Không tìm thấy yêu cầu đặt xe nào.
                  </td>
                </tr>
              ) : bookings.map(item => (
                <tr
                  key={item.Id}
                  className={`cursor-pointer hover:bg-gray-50/50 transition-colors ${selectedBookingId === String(item.Id) ? 'bg-primary/5' : ''}`}
                  onClick={() => updateParams({ bookingId: item.Id })}
                >
                  <td className="px-4 py-3 text-sm font-bold text-primary">{item.BookingCode}</td>
                  <td className="px-4 py-3 text-sm font-medium text-on-surface">{item.RequesterName}</td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant max-w-[180px] truncate" title={item.PickupLocation}>{item.PickupLocation}</td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant max-w-[180px] truncate" title={item.Destination}>{item.Destination}</td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant">{formatDate(item.DepartureTime, 'dd/MM/yyyy HH:mm')}</td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant">{item.PassengerCount} người</td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant">{item.VehiclePlate || '—'}</td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant">{item.DriverName || '—'}</td>
                  <td className="px-4 py-3 text-sm">{getStatusBadge(item.Status)}</td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant">{formatDate(item.CreatedAt, 'dd/MM/yyyy')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-outline-variant bg-gray-50 flex items-center justify-between">
            <span className="text-xs text-on-surface-variant">Tổng số: {totalCount} yêu cầu</span>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => updateParams({ page: page - 1 })}
                className="btn btn-outline btn-xs p-1"
              >
                chevron_left
              </button>
              <span className="text-xs px-3 py-1 bg-white border border-border rounded font-semibold">{page} / {totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => updateParams({ page: page + 1 })}
                className="btn btn-outline btn-xs p-1"
              >
                chevron_right
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Slide-over Side Drawer Detail */}
      <VehicleBookingDetail
        bookingId={selectedBookingId}
        isOpen={!!selectedBookingId}
        onClose={() => updateParams({ bookingId: null })}
        onStatusUpdated={fetchBookings}
        currentUser={currentUser}
      />
    </div>
  );
}
