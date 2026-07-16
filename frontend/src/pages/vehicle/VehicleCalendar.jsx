// src/pages/vehicle/VehicleCalendar.jsx
// Màn hình theo dõi lịch xe - LỊCH THỰC HIỆN PHÂN XE
import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { getVehicles, getDrivers, getVehicleCalendar } from '../../services/fleetApi';
import VehicleBookingDetail from './VehicleBookingDetail';
import { ComboboxMultiple } from '../../components/ui/combobox';

const WEEKDAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];

const VEHICLE_STATUS_COLORS = {
  'Chờ phản hồi': { border: '#3B82F6', text: '#1D4ED8', bg: '#EFF6FF', dot: '#3B82F6' },
  'Giám sát đã duyệt': { border: '#10B981', text: '#047857', bg: '#ECFDF5', dot: '#10B981' },
  'Giám sát từ chối': { border: '#EF4444', text: '#B91C1C', bg: '#FEF2F2', dot: '#EF4444' },
  'Team Admin đã duyệt': { border: '#8B5CF6', text: '#6D28D9', bg: '#F5F3FF', dot: '#8B5CF6' },
  'Team Admin từ chối': { border: '#EF4444', text: '#B91C1C', bg: '#FEF2F2', dot: '#EF4444' },
  'Đang thực hiện': { border: '#F59E0B', text: '#B45309', bg: '#FEF3C7', dot: '#F59E0B' },
  'Hoàn thành': { border: '#6B7280', text: '#374151', bg: '#F3F4F6', dot: '#6B7280' },
  'Đã hủy': { border: '#9CA3AF', text: '#4B5563', bg: '#F9FAFB', dot: '#9CA3AF' }
};

// Helper để tính số tuần theo tiêu chuẩn ISO-8601
function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return { year: date.getUTCFullYear(), week: weekNo };
}

// Helper để lấy ngày thứ 2 của tuần thứ W trong năm Y
function getMondayOfWeek(w, y) {
  const jan4 = new Date(y, 0, 4);
  const day = jan4.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const w1Monday = new Date(jan4.setDate(jan4.getDate() + diffToMonday));
  w1Monday.setDate(w1Monday.getDate() + (w - 1) * 7);
  return w1Monday;
}

export default function VehicleCalendar() {
  const today = new Date();
  const todayWeek = getWeekNumber(today);

  // States bộ lọc lịch
  const [year, setYear] = useState(todayWeek.year);
  const [week, setWeek] = useState(todayWeek.week);
  const [filterDrivers, setFilterDrivers] = useState([]);
  const [filterVehicles, setFilterVehicles] = useState([]);
  const [filterRequesters, setFilterRequesters] = useState([]);
  const [filterStatuses, setFilterStatuses] = useState([]);
  const [viewMode, setViewMode] = useState('vehicle'); // 'vehicle' or 'driver'

  // Master lists
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [rawBookings, setRawBookings] = useState([]);
  const [loading, setLoading] = useState(false);

  // Drawer xem chi tiết/phê duyệt
  const [activeBookingId, setActiveBookingId] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('csr_user'));
    } catch {
      return null;
    }
  })();

  // Lấy ngày thứ 2 đến chủ nhật của tuần hiện tại
  const weekDaysDates = useMemo(() => {
    const monday = getMondayOfWeek(week, year);
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d);
    }
    return dates;
  }, [week, year]);

  const dateFromStr = useMemo(() => {
    const d = weekDaysDates[0];
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, [weekDaysDates]);

  const dateToStr = useMemo(() => {
    const d = weekDaysDates[6];
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, [weekDaysDates]);

  // Load danh mục
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const [vRes, dRes] = await Promise.all([
          getVehicles({ isActive: true }),
          getDrivers({ isActive: true })
        ]);
        if (vRes.success) setVehicles(vRes.data);
        if (dRes.success) setDrivers(dRes.data);
      } catch (err) {
        console.error('Lỗi tải danh mục cấu hình xe/tài xế:', err.message);
      }
    };
    loadMetadata();
  }, []);

  // Tải dữ liệu lịch trình xe
  const loadCalendarBookings = async () => {
    setLoading(true);
    try {
      const res = await getVehicleCalendar({
        dateFrom: dateFromStr,
        dateTo: dateToStr
      });
      if (res.success) {
        setRawBookings(res.data || []);
      }
    } catch (err) {
      toast.error('Lỗi khi tải lịch trình xe: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCalendarBookings();
  }, [dateFromStr, dateToStr]);

  // 1. Danh sách năm (quanh năm hiện tại)
  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return [current - 2, current - 1, current, current + 1, current + 2];
  }, []);

  // 2. Danh sách tuần
  const weekOptions = useMemo(() => {
    const list = [];
    for (let w = 1; w <= 53; w++) {
      const mon = getMondayOfWeek(w, year);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      
      const monStr = `${String(mon.getDate()).padStart(2, '0')}/${String(mon.getMonth() + 1).padStart(2, '0')}`;
      const sunStr = `${String(sun.getDate()).padStart(2, '0')}/${String(sun.getMonth() + 1).padStart(2, '0')}`;
      
      list.push({
        value: w,
        label: `Tuần ${w} (${monStr} - ${sunStr})`
      });
    }
    return list;
  }, [year]);

  // 3. Danh sách Option lọc cho ComboboxMultiple
  const driverOptions = useMemo(() => {
    const list = drivers.map(d => d.FullName);
    if (rawBookings.some(b => !b.DriverId)) {
      list.unshift('Chưa phân công');
    }
    return [...new Set(list)].sort();
  }, [drivers, rawBookings]);

  const vehicleOptions = useMemo(() => {
    const list = vehicles.map(v => v.PlateNumber);
    if (rawBookings.some(b => !b.VehicleId)) {
      list.unshift('Chưa phân công');
    }
    return [...new Set(list)].sort();
  }, [vehicles, rawBookings]);

  const requesterOptions = useMemo(() => {
    const set = new Set();
    rawBookings.forEach(b => {
      if (b.RequesterName) set.add(b.RequesterName);
    });
    return [...set].sort();
  }, [rawBookings]);

  const statusOptions = ['Chờ phản hồi', 'Giám sát đã duyệt', 'Team Admin đã duyệt', 'Đang thực hiện', 'Hoàn thành'];

  // Điều hướng tuần
  const handlePrevWeek = () => {
    if (week === 1) {
      setYear(y => y - 1);
      setWeek(53);
    } else {
      setWeek(w => w - 1);
    }
  };

  const handleNextWeek = () => {
    if (week === 53) {
      setYear(y => y + 1);
      setWeek(1);
    } else {
      setWeek(w => w + 1);
    }
  };

  const handleCurrentWeek = () => {
    setYear(todayWeek.year);
    setWeek(todayWeek.week);
  };

  // Check filter active
  const hasActiveFilters = filterDrivers.length > 0 || filterVehicles.length > 0 || filterRequesters.length > 0 || filterStatuses.length > 0;

  const handleClearFilters = () => {
    setFilterDrivers([]);
    setFilterVehicles([]);
    setFilterRequesters([]);
    setFilterStatuses([]);
    toast.success('Đã xóa tất cả bộ lọc');
  };

  // Lọc dữ liệu đặt xe ở client-side
  const filteredBookings = useMemo(() => {
    return rawBookings.filter(b => {
      // 1. Lọc Lái xe
      if (filterDrivers.length > 0) {
        const match = filterDrivers.some(dName => {
          if (dName === 'Chưa phân công') return !b.DriverId;
          return b.DriverName === dName;
        });
        if (!match) return false;
      }
      // 2. Lọc Xe
      if (filterVehicles.length > 0) {
        const match = filterVehicles.some(vPlate => {
          if (vPlate === 'Chưa phân công') return !b.VehicleId;
          return b.VehiclePlate === vPlate;
        });
        if (!match) return false;
      }
      // 3. Lọc Người đặt
      if (filterRequesters.length > 0 && !filterRequesters.includes(b.RequesterName)) {
        return false;
      }
      // 4. Lọc Trạng thái
      if (filterStatuses.length > 0 && !filterStatuses.includes(b.Status)) {
        return false;
      }
      return true;
    });
  }, [rawBookings, filterDrivers, filterVehicles, filterRequesters, filterStatuses]);

  // Phân nhóm booking theo xe/tài xế và ngày
  const bookingsMap = useMemo(() => {
    const map = {};
    filteredBookings.forEach(b => {
      const key = viewMode === 'vehicle' ? (b.VehicleId || 'unassigned') : (b.DriverId || 'unassigned');
      if (!map[key]) map[key] = {};
      
      weekDaysDates.forEach((date, index) => {
        const dateStr = date.toISOString().split('T')[0];
        const depDate = new Date(b.DepartureTime).toISOString().split('T')[0];
        const retDate = b.ReturnTime ? new Date(b.ReturnTime).toISOString().split('T')[0] : depDate;
        
        if (dateStr >= depDate && dateStr <= retDate) {
          if (!map[key][index]) map[key][index] = [];
          map[key][index].push(b);
        }
      });
    });
    return map;
  }, [filteredBookings, weekDaysDates, viewMode]);

  // Click vào card mở chi tiết
  const handleCardClick = (bookingId) => {
    setActiveBookingId(bookingId);
    setIsDrawerOpen(true);
  };

  // Định dạng giờ hiển thị
  const formatTimeRange = (dep, ret) => {
    if (!dep) return '';
    const d = new Date(dep);
    const r = ret ? new Date(ret) : null;
    const pad = (n) => String(n).padStart(2, '0');
    const startStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (!r) return startStr;
    const endStr = `${pad(r.getHours())}:${pad(r.getMinutes())}`;
    return `${startStr} → ${endStr}`;
  };

  // Render các booking card cho 1 ô ngày cụ thể
  const renderCellBookings = (key, dateIdx) => {
    const list = bookingsMap[key]?.[dateIdx] || [];
    if (list.length === 0) return null;

    return (
      <div className="flex flex-col gap-1.5 p-1 max-h-[180px] overflow-y-auto custom-scrollbar">
        {list.map(b => {
          const statusColors = VEHICLE_STATUS_COLORS[b.Status] || VEHICLE_STATUS_COLORS['Chờ phản hồi'];
          return (
            <div
              key={b.Id}
              onClick={() => handleCardClick(b.Id)}
              className="group cursor-pointer p-2 border-l-[3px] rounded bg-white hover:bg-surface-container-high transition-all shadow-sm border border-outline-variant"
              style={{
                borderLeftColor: statusColors.dot
              }}
              title={`${b.Purpose}\nKhách: ${b.Attendees || 'Không có'}\nTrạng thái: ${b.Status}`}
            >
              <div className="text-xs font-bold text-primary group-hover:underline flex justify-between items-center">
                <span className="truncate max-w-[80px]" title={b.VehicleType || 'Đi công tác'}>{b.VehicleType || 'Đi công tác'}</span>
                <span
                  className="px-1.5 py-0.2 rounded text-[8px] font-bold"
                  style={{
                    backgroundColor: statusColors.bg,
                    color: statusColors.text
                  }}
                >
                  {b.Status}
                </span>
              </div>
              <div className="text-[10px] font-semibold text-on-surface-variant mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[11px]">schedule</span>
                {formatTimeRange(b.DepartureTime, b.ReturnTime)}
              </div>
              <div className="text-[10px] text-on-surface mt-0.5">
                <span className="font-semibold text-on-surface-variant">NĐK:</span> {b.RequesterName}
              </div>
              
              {/* Highlight LX hoặc XE dựa trên viewMode */}
              {viewMode === 'vehicle' ? (
                b.DriverName && (
                  <div className="text-[10px] text-on-surface mt-1 flex items-center gap-1.5">
                    <span className="inline-block bg-blue-50 text-blue-700 text-[8px] font-extrabold px-1 py-0.2 rounded border border-blue-100 uppercase scale-90 origin-left">LX</span>
                    <span className="font-semibold text-on-surface truncate">{b.DriverName}</span>
                  </div>
                )
              ) : (
                b.VehiclePlate && (
                  <div className="text-[10px] text-on-surface mt-1 flex items-center gap-1.5">
                    <span className="inline-block bg-amber-50 text-amber-700 text-[8px] font-extrabold px-1 py-0.2 rounded border border-amber-100 uppercase scale-90 origin-left">XE</span>
                    <span className="font-semibold text-on-surface truncate">{b.VehiclePlate}</span>
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6 flex flex-col h-full">
      {/* Tiêu đề & Action */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant pb-3">
        <div>
          <h1 className="text-2xl font-bold text-on-surface mb-1">LỊCH THỰC HIỆN PHÂN XE</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <button
            onClick={() => setViewMode(prev => prev === 'vehicle' ? 'driver' : 'vehicle')}
            className="flex items-center gap-2 bg-primary hover:bg-primary/95 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">
              {viewMode === 'vehicle' ? 'person' : 'directions_car'}
            </span>
            Xem theo {viewMode === 'vehicle' ? 'Tài xế' : 'Xe / Phương tiện'}
          </button>
        </div>
      </div>

      {/* Slicers Container */}
      <div className="bg-surface-container border border-outline-variant rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-on-surface flex items-center gap-1.5 uppercase tracking-wider text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px]">filter_alt</span>
            Bộ lọc lịch thực hiện
          </span>
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="flex items-center gap-1 text-xs text-error hover:underline font-bold"
            >
              <span className="material-symbols-outlined text-[14px]">filter_alt_off</span>
              Xóa bộ lọc tất cả
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          {/* Chọn năm */}
          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Năm</label>
            <select
              value={year}
              onChange={e => { setYear(Number(e.target.value)); setWeek(1); }}
              className="w-full bg-white border border-outline-variant rounded-lg px-3 py-2 text-sm font-semibold outline-none focus:border-primary transition-colors cursor-pointer"
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>Năm {y}</option>
              ))}
            </select>
          </div>

          {/* Chọn tuần */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Chọn Tuần</label>
              <div className="flex bg-white border border-outline-variant rounded-md p-0.5 scale-90 origin-right">
                <button
                  onClick={handlePrevWeek}
                  className="p-0.5 hover:bg-surface-container-high rounded text-on-surface flex"
                  title="Tuần trước"
                >
                  <span className="material-symbols-outlined text-[15px]">chevron_left</span>
                </button>
                <button
                  onClick={handleCurrentWeek}
                  className="px-1 py-0.2 text-[9px] font-bold hover:bg-surface-container-high rounded text-primary border-x border-outline-variant"
                >
                  Nay
                </button>
                <button
                  onClick={handleNextWeek}
                  className="p-0.5 hover:bg-surface-container-high rounded text-on-surface flex"
                  title="Tuần sau"
                >
                  <span className="material-symbols-outlined text-[15px]">chevron_right</span>
                </button>
              </div>
            </div>
            <select
              value={week}
              onChange={e => setWeek(Number(e.target.value))}
              className="w-full bg-white border border-outline-variant rounded-lg px-3 py-2 text-sm font-semibold outline-none focus:border-primary transition-colors cursor-pointer"
            >
              {weekOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Lọc Lái xe */}
          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Lái xe</label>
            <ComboboxMultiple
              options={driverOptions}
              selected={filterDrivers}
              onChange={setFilterDrivers}
              placeholder="Tất cả lái xe"
            />
          </div>

          {/* Lọc Xe */}
          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Phương tiện</label>
            <ComboboxMultiple
              options={vehicleOptions}
              selected={filterVehicles}
              onChange={setFilterVehicles}
              placeholder="Tất cả xe"
            />
          </div>

          {/* Lọc Người đặt */}
          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Người đặt</label>
            <ComboboxMultiple
              options={requesterOptions}
              selected={filterRequesters}
              onChange={setFilterRequesters}
              placeholder="Tất cả người đặt"
            />
          </div>

          {/* Lọc Trạng thái */}
          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Trạng thái</label>
            <ComboboxMultiple
              options={statusOptions}
              selected={filterStatuses}
              onChange={setFilterStatuses}
              placeholder="Tất cả trạng thái"
            />
          </div>
        </div>
      </div>

      {/* Bảng lịch trình xe */}
      <div className="bg-surface border border-outline-variant rounded-2xl shadow-sm overflow-hidden flex flex-col h-[calc(100vh-320px)] min-h-[500px]">
        <div className="flex-1 overflow-auto custom-scrollbar relative">
          <table className="w-full border-collapse text-left table-fixed min-w-[1230px]">
            <colgroup>
              <col style={{ width: '180px' }} />
              <col style={{ width: '150px' }} />
              <col style={{ width: '150px' }} />
              <col style={{ width: '150px' }} />
              <col style={{ width: '150px' }} />
              <col style={{ width: '150px' }} />
              <col style={{ width: '150px' }} />
              <col style={{ width: '150px' }} />
            </colgroup>
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant sticky top-0 z-30 shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                {/* Cột Đầu tiên */}
                <th className="px-4 py-3.5 text-xs font-bold text-on-surface-variant uppercase tracking-wider border-r border-outline-variant sticky top-0 left-0 bg-surface-container-low z-40">
                  {viewMode === 'vehicle' ? 'XE / PHƯƠNG TIỆN' : 'TÀI XẾ'}
                </th>
                {/* Các ngày trong tuần */}
                {weekDaysDates.map((date, idx) => {
                  const isToday = date.toDateString() === today.toDateString();
                  return (
                    <th
                      key={idx}
                      className={`px-3 py-3 text-center text-xs font-bold border-r border-outline-variant sticky top-0 bg-surface-container-low ${
                        isToday ? 'bg-blue-50/70 text-blue-700 font-bold border-b-2 border-b-blue-300' : 'text-on-surface-variant'
                      }`}
                    >
                      <div className="text-[13px] font-bold">{WEEKDAYS[idx]}</div>
                      <div className="text-[11px] font-normal opacity-85 mt-0.5">
                        {String(date.getDate()).padStart(2, '0')}/{String(date.getMonth() + 1).padStart(2, '0')}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-20 text-on-surface-variant bg-white">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="material-symbols-outlined animate-spin text-[32px] text-primary">sync</span>
                      <span className="text-sm font-semibold">Đang tải lịch trình xe...</span>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {/* Hàng: Đơn chưa phân công (chỉ hiển thị nếu có đơn) */}
                  {bookingsMap['unassigned'] && (
                    <tr className="border-b border-outline-variant hover:bg-surface-container-lowest bg-error-container/5">
                      <td className="w-[180px] min-w-[180px] max-w-[180px] px-4 py-3 border-r border-outline-variant font-semibold sticky left-0 bg-error-container/10 z-20 align-middle">
                        <div className="flex flex-col justify-center">
                          <span className="text-error font-bold flex items-center gap-1 text-[13px]">
                            <span className="material-symbols-outlined text-[16px]">warning</span>
                            {viewMode === 'vehicle' ? 'CHƯA PHÂN XE' : 'CHƯA PHÂN TÀI XẾ'}
                          </span>
                          <span className="text-[10px] text-on-surface-variant mt-0.5 leading-tight">
                            {viewMode === 'vehicle' ? 'Các yêu cầu đang chờ xếp xe' : 'Các yêu cầu đang chờ xếp tài xế'}
                          </span>
                        </div>
                      </td>
                      {weekDaysDates.map((_, idx) => (
                        <td key={idx} className="p-1 border-r border-outline-variant align-top bg-error-container/5">
                          {renderCellBookings('unassigned', idx)}
                        </td>
                      ))}
                    </tr>
                  )}

                  {/* Danh sách chính */}
                  {viewMode === 'vehicle' ? (
                    vehicles.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-10 text-on-surface-variant text-sm font-medium bg-white">
                          Không có danh sách xe nào trong cơ sở dữ liệu
                        </td>
                      </tr>
                    ) : (
                      vehicles.map(v => {
                        const isFreeToBook = v.IsActive && v.Status === 'Sẵn sàng';
                        return (
                          <tr key={v.Id} className="border-b border-outline-variant hover:bg-surface-container-lowest bg-white">
                            {/* Thông tin Xe */}
                            <td className="w-[180px] min-w-[180px] max-w-[180px] px-4 py-3 border-r border-outline-variant sticky left-0 bg-white z-20 align-top">
                              <div className="text-sm font-bold text-on-surface tracking-wide">{v.PlateNumber}</div>
                              <div className="text-[11px] text-on-surface-variant mt-0.5 font-medium leading-tight">
                                {v.Brand} - {v.Seats} chỗ
                              </div>
                              <div className="mt-2">
                                {isFreeToBook ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-success-container text-success border border-success/20">
                                    <span className="w-1 h-1 rounded-full bg-success"></span>
                                    Sẵn sàng
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-error-container text-error border border-error/20">
                                    <span className="w-1 h-1 rounded-full bg-error"></span>
                                    Khóa ({v.Status})
                                  </span>
                                )}
                              </div>
                            </td>
                            {/* Lịch trình các ngày trong tuần */}
                            {weekDaysDates.map((_, idx) => (
                              <td key={idx} className="p-1 border-r border-outline-variant align-top min-h-[90px]">
                                {renderCellBookings(v.Id, idx)}
                              </td>
                            ))}
                          </tr>
                        );
                      })
                    )
                  ) : (
                    drivers.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-10 text-on-surface-variant text-sm font-medium bg-white">
                          Không có danh sách tài xế nào trong cơ sở dữ liệu
                        </td>
                      </tr>
                    ) : (
                      drivers.map(d => {
                        const isFree = d.IsActive && d.Status === 'Sẵn sàng';
                        return (
                          <tr key={d.Id} className="border-b border-outline-variant hover:bg-surface-container-lowest bg-white">
                            {/* Thông tin Tài xế */}
                            <td className="w-[180px] min-w-[180px] max-w-[180px] px-4 py-3 border-r border-outline-variant sticky left-0 bg-white z-20 align-top">
                              <div className="text-sm font-bold text-on-surface tracking-wide">{d.FullName}</div>
                              <div className="text-[11px] text-on-surface-variant mt-0.5 font-medium leading-tight">
                                SĐT: {d.Phone || '—'}
                              </div>
                              <div className="mt-2">
                                {isFree ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-success-container text-success border border-success/20">
                                    <span className="w-1 h-1 rounded-full bg-success"></span>
                                    Sẵn sàng
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-error-container text-error border border-error/20">
                                    <span className="w-1 h-1 rounded-full bg-error"></span>
                                    Bận ({d.Status})
                                  </span>
                                )}
                              </div>
                            </td>
                            {/* Lịch trình các ngày trong tuần */}
                            {weekDaysDates.map((_, idx) => (
                              <td key={idx} className="p-1 border-r border-outline-variant align-top min-h-[90px]">
                                {renderCellBookings(d.Id, idx)}
                              </td>
                            ))}
                          </tr>
                        );
                      })
                    )
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend & Chú thích */}
      <div className="flex flex-wrap items-center gap-6 text-xs text-on-surface-variant font-medium bg-surface-container border border-outline-variant rounded-xl p-3">
        <span className="font-bold text-on-surface">Chú thích trạng thái:</span>
        {Object.entries(VEHICLE_STATUS_COLORS)
          .filter(([status]) => !['Đã hủy', 'Giám sát từ chối', 'Team Admin từ chối'].includes(status))
          .map(([status, colors]) => (
            <div key={status} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full border" style={{ backgroundColor: colors.bg, borderColor: colors.dot }} />
              <span>{status}</span>
            </div>
          ))}
      </div>

      {/* Slide-over Drawer xem chi tiết/điều phối xe */}
      {isDrawerOpen && activeBookingId && (
        <VehicleBookingDetail
          bookingId={activeBookingId}
          isOpen={isDrawerOpen}
          onClose={() => {
            setIsDrawerOpen(false);
            setActiveBookingId(null);
          }}
          onStatusUpdated={() => {
            loadCalendarBookings();
            setIsDrawerOpen(false);
            setActiveBookingId(null);
          }}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
