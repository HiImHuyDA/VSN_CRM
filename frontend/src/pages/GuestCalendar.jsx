// src/pages/GuestCalendar.jsx — Theo dõi lịch tiếp khách
import { useState, useEffect, useMemo, useRef } from 'react';
import { getGuestCalendar } from '../services/api';
import { formatDate } from '../utils/helpers';
import SubmissionDrawer from '../components/dashboard/SubmissionDrawer';
import { ComboboxMultiple } from '../components/ui/combobox';

const STATUS_COLORS = {
  'Chờ phản hồi':  { bg: '#EFF6FF', border: '#93C5FD', text: '#1D4ED8', dot: '#3B82F6' },
  'PRD đã duyệt':  { bg: '#FFF7ED', border: '#FDBA74', text: '#C2410C', dot: '#F97316' },
  'BOD đã duyệt':  { bg: '#F0FDF4', border: '#86EFAC', text: '#15803D', dot: '#22C55E' },
  'Hoàn thành':    { bg: '#f3e8ff', border: '#D4D4D8', text: '#7e22ce', dot: '#a855f7' },
};

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getMonthMatrix(year, month) {
  const firstDay = new Date(year, month, 1);
  let startDay = firstDay.getDay(); // 0=Sun
  startDay = startDay === 0 ? 6 : startDay - 1; // convert to Mon=0
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  
  const cells = [];
  
  // Previous month padding
  const prevMonthYear = month === 0 ? year - 1 : year;
  const prevMonthIndex = month === 0 ? 11 : month - 1;
  for (let i = startDay - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const dateStr = `${prevMonthYear}-${String(prevMonthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, current: false, date: dateStr });
  }
  
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, current: true, date: dateStr });
  }
  
  // Next month padding
  const nextMonthYear = month === 11 ? year + 1 : year;
  const nextMonthIndex = month === 11 ? 0 : month + 1;
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const dateStr = `${nextMonthYear}-${String(nextMonthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, current: false, date: dateStr });
    }
  }
  
  // Group into weeks
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

// ── Month/Year Picker Popup ──────────────────────────────────────
function MonthYearPicker({ year, month, onSelect, onClose }) {
  const [view, setView] = useState('month'); // 'month' | 'year'
  const [displayYear, setDisplayYear] = useState(year);
  const [rangeStart, setRangeStart] = useState(Math.floor(year / 12) * 12);
  const popupRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleMonthClick = (m) => {
    onSelect(displayYear, m);
    onClose();
  };

  const handleYearClick = (y) => {
    setDisplayYear(y);
    setView('month');
  };

  const today = new Date();

  if (view === 'year') {
    const rangeEnd = rangeStart + 11;
    const years = [];
    for (let y = rangeStart; y <= rangeEnd; y++) years.push(y);

    return (
      <div ref={popupRef} style={{
        position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
        zIndex: 50, background: 'white', borderRadius: 12, padding: '16px 20px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        border: '1px solid var(--color-outline-variant)',
        minWidth: 280, marginTop: 6,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span
            onClick={() => setView('month')}
            style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-on-surface)', cursor: 'pointer' }}
          >
            {rangeStart} - {rangeEnd}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setRangeStart(r => r - 12)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--color-on-surface-variant)' }}>arrow_upward</span>
            </button>
            <button onClick={() => setRangeStart(r => r + 12)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--color-on-surface-variant)' }}>arrow_downward</span>
            </button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {years.map(y => {
            const isCurrent = y === today.getFullYear();
            const isSelected = y === displayYear;
            return (
              <button key={y} onClick={() => handleYearClick(y)}
                style={{
                  padding: '10px 4px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 14, fontWeight: isSelected || isCurrent ? 700 : 500,
                  background: isSelected ? 'var(--color-primary)' : isCurrent ? 'rgba(91,106,240,0.08)' : 'transparent',
                  color: isSelected ? 'white' : isCurrent ? 'var(--color-primary)' : 'var(--color-on-surface)',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--color-surface-container)'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isCurrent ? 'rgba(91,106,240,0.08)' : 'transparent'; }}
              >
                {y}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Month view
  return (
    <div ref={popupRef} style={{
      position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
      zIndex: 50, background: 'white', borderRadius: 12, padding: '16px 20px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
      border: '1px solid var(--color-outline-variant)',
      minWidth: 280, marginTop: 6,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span
          onClick={() => { setRangeStart(Math.floor(displayYear / 12) * 12); setView('year'); }}
          style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-on-surface)', cursor: 'pointer' }}
          title="Click để chọn năm"
        >
          {displayYear}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setDisplayYear(y => y - 1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--color-on-surface-variant)' }}>arrow_upward</span>
          </button>
          <button onClick={() => setDisplayYear(y => y + 1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--color-on-surface-variant)' }}>arrow_downward</span>
          </button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {MONTH_NAMES.map((name, i) => {
          const isCurrent = displayYear === today.getFullYear() && i === today.getMonth();
          const isSelected = displayYear === year && i === month;
          return (
            <button key={i} onClick={() => handleMonthClick(i)}
              style={{
                padding: '10px 4px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: isSelected || isCurrent ? 700 : 500,
                background: isSelected ? 'var(--color-primary)' : isCurrent ? 'rgba(91,106,240,0.08)' : 'transparent',
                color: isSelected ? 'white' : isCurrent ? 'var(--color-primary)' : 'var(--color-on-surface)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--color-surface-container)'; }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isCurrent ? 'rgba(91,106,240,0.08)' : 'transparent'; }}
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────
export default function GuestCalendar() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [events, setEvents] = useState({});
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const tableRef = useRef(null);
  const pickerAnchorRef = useRef(null);

  // Slicer states
  const [filterCustomer, setFilterCustomer] = useState([]);
  const [filterLocation, setFilterLocation] = useState([]);
  const [filterStatus, setFilterStatus] = useState([]);
  const [filterDate, setFilterDate] = useState([]);
  const [filterCustomerType, setFilterCustomerType] = useState([]);

  const currentUser = (() => { try { return JSON.parse(localStorage.getItem('csr_user')); } catch { return null; } })();

  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthLabel = new Date(year, month).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

  useEffect(() => {
    setLoading(true);
    getGuestCalendar(monthStr)
      .then(res => {
        setEvents(res.data?.events || {});
        setSubmissions(res.data?.submissions || []);
      })
      .catch(err => {
        console.error('Guest calendar error:', err);
        setEvents({});
        setSubmissions([]);
      })
      .finally(() => setLoading(false));
  }, [monthStr]);

  // Reset slicers when month changes
  useEffect(() => {
    setFilterCustomer([]);
    setFilterLocation([]);
    setFilterStatus([]);
    setFilterDate([]);
    setFilterCustomerType([]);
  }, [monthStr]);

  const weeks = useMemo(() => getMonthMatrix(year, month), [year, month]);

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  };

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const handleMonthYearSelect = (y, m) => {
    setYear(y);
    setMonth(m);
  };

  const handleCardClick = (projectId) => {
    setSelectedProjectId(projectId);
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Slicer options derived from submissions
  const customerOptions = useMemo(() => [...new Set(submissions.map(s => s.customerName))].filter(Boolean).sort(), [submissions]);
  
  const locationOptions = useMemo(() => {
    const locs = new Set();
    submissions.forEach(s => {
      if (s.destination) {
        s.destination.split(',').forEach(l => locs.add(l.trim()));
      }
    });
    return [...locs].filter(Boolean).sort();
  }, [submissions]);

  const statusOptions = useMemo(() => [...new Set(submissions.map(s => s.status))].filter(Boolean).sort(), [submissions]);
  // Convert yyyy-MM-dd → dd/MM/yyyy without timezone shift (split by '-')
  const isoToDisplay = (iso) => {
    if (!iso || !iso.trim()) return iso;
    const parts = iso.trim().split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return iso;
  };

  const dateOptions = useMemo(() => {
    const allDates = new Set();
    submissions.forEach(s => {
      if (s.onboardDates) {
        s.onboardDates.split(', ').forEach(d => allDates.add(d.trim()));
      } else if (s.onboardDate) {
        allDates.add(s.onboardDate);
      }
    });
    return [...allDates].sort().map(d => isoToDisplay(d));
  }, [submissions]);

  const customerTypeOptions = useMemo(() => ['Brand', 'Partner', 'Nhà cung cấp', 'Khách vãng lai', 'Ứng viên phỏng vấn'], []);

  // Filter submissions by slicers
  const filteredSubmissions = useMemo(() => {
    return submissions.filter(sub => {
      const matchCustomer = filterCustomer.length === 0 || filterCustomer.includes(sub.customerName);
      const matchLocation = filterLocation.length === 0 || filterLocation.some(loc => (sub.destination || '').includes(loc));
      const matchStatus = filterStatus.length === 0 || filterStatus.includes(sub.status);
      const matchDate = filterDate.length === 0 || (() => {
        const subDates = sub.onboardDates
          ? sub.onboardDates.split(', ').map(d => isoToDisplay(d.trim()))
          : sub.onboardDate ? [isoToDisplay(sub.onboardDate)] : [];
        return filterDate.some(fd => subDates.includes(fd));
      })();
      const matchCustomerType = filterCustomerType.length === 0 || filterCustomerType.some(type => {
        const typeInDb = sub.customerType || '';
        const label = typeInDb === 'Supplier' ? 'Nhà cung cấp' : typeInDb;
        return label.toLowerCase() === type.toLowerCase();
      });
      return matchCustomer && matchLocation && matchStatus && matchDate && matchCustomerType;
    });
  }, [submissions, filterCustomer, filterLocation, filterStatus, filterDate, filterCustomerType]);

  // Group dates of each filtered submission into contiguous segments and build spanning events
  const spanningEvents = useMemo(() => {
    const isConsecutive = (d1Str, d2Str) => {
      if (!d1Str || !d2Str) return false;
      const parts1 = d1Str.split('-');
      const parts2 = d2Str.split('-');
      const d1 = new Date(parseInt(parts1[0]), parseInt(parts1[1]) - 1, parts1.length === 3 ? parseInt(parts1[2]) : 1);
      const d2 = new Date(parseInt(parts2[0]), parseInt(parts2[1]) - 1, parts2.length === 3 ? parseInt(parts2[2]) : 1);
      const diffDays = Math.ceil(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24));
      return diffDays === 1;
    };

    const list = [];
    filteredSubmissions.forEach(sub => {
      const dates = sub.onboardDates
        ? sub.onboardDates.split(', ').map(d => d.trim()).sort()
        : (sub.onboardDate ? [sub.onboardDate] : []);

      if (dates.length === 0) return;

      const segments = [];
      let currentSeg = [dates[0]];
      for (let i = 1; i < dates.length; i++) {
        if (isConsecutive(dates[i - 1], dates[i])) {
          currentSeg.push(dates[i]);
        } else {
          segments.push(currentSeg);
          currentSeg = [dates[i]];
        }
      }
      segments.push(currentSeg);

      segments.forEach(seg => {
        list.push({
          projectId: sub.projectId,
          customerName: sub.customerName,
          destination: sub.destination,
          status: sub.status,
          meetingTopic: sub.meetingTopic,
          startDate: seg[0],
          endDate: seg[seg.length - 1],
        });
      });
    });
    return list;
  }, [filteredSubmissions]);


  const getStatusBadge = (status) => {
    const colors = STATUS_COLORS[status] || { bg: '#F4F4F5', text: '#71717A', dot: '#A1A1AA' };
    return (
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 10px', borderRadius: 20,
          background: colors.bg, color: colors.text,
          fontSize: 12, fontWeight: 600,
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: colors.dot, display: 'inline-block' }} />
        {status}
      </span>
    );
  };

  return (
    <>
      <div className="w-full pb-10">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-on-surface mb-1 flex items-center gap-3">
            <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--color-primary)' }}>calendar_month</span>
            Theo dõi lịch tiếp khách
          </h1>
        </div>

        {/* Month Navigation */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <button onClick={prevMonth} className="btn btn-icon btn-outline" title="Tháng trước">
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <div ref={pickerAnchorRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setShowPicker(v => !v)}
                style={{
                  fontSize: 20, fontWeight: 700, textTransform: 'capitalize', minWidth: 200,
                  textAlign: 'center', background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  color: 'var(--color-on-surface)', padding: '4px 8px', borderRadius: 8,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-container)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {monthLabel}
                <span className="material-symbols-outlined" style={{ fontSize: 18, opacity: 0.5, transition: 'transform 0.2s', transform: showPicker ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  expand_more
                </span>
              </button>
              {showPicker && (
                <MonthYearPicker
                  year={year}
                  month={month}
                  onSelect={handleMonthYearSelect}
                  onClose={() => setShowPicker(false)}
                />
              )}
            </div>
            <button onClick={nextMonth} className="btn btn-icon btn-outline" title="Tháng sau">
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
          <button onClick={goToday} className="btn btn-outline btn-sm" style={{ fontWeight: 600 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>today</span>
            Hôm nay
          </button>
        </div>

        {/* Calendar Grid */}
        <div style={{ overflowX: 'auto', marginBottom: 32, borderRadius: 16, border: '1px solid var(--color-outline-variant)' }}>
          <div style={{
            background: 'var(--color-surface)',
            minWidth: '100%',
            overflow: 'hidden',
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          }}>
          {/* Weekday Headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--color-outline-variant)' }}>
            {WEEKDAYS.map((wd, i) => (
              <div key={wd} style={{
                padding: '10px 0',
                textAlign: 'center',
                fontWeight: 700,
                fontSize: 13,
                color: i >= 5 ? 'var(--color-error)' : 'var(--color-on-surface-variant)',
                background: 'var(--color-surface-container)',
                letterSpacing: '0.5px',
              }}>
                {wd}
              </div>
            ))}
          </div>

          {/* Week Rows */}
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-on-surface-variant)' }}>
              <span className="material-symbols-outlined animate-spin" style={{ fontSize: 28 }}>refresh</span>
              <p style={{ marginTop: 8 }}>Đang tải lịch...</p>
            </div>
          ) : (
            weeks.map((week, wi) => {
              const weekStart = week[0].date;
              const weekEnd = week[6].date;

              // Tìm các sự kiện kéo dài có giao với tuần này
              const weekEvents = [];
              spanningEvents.forEach(event => {
                const overlaps = event.startDate <= weekEnd && event.endDate >= weekStart;
                if (overlaps) {
                  const partStart = event.startDate < weekStart ? weekStart : event.startDate;
                  const partEnd = event.endDate > weekEnd ? weekEnd : event.endDate;
                  const startCol = week.findIndex(cell => cell.date === partStart);
                  const endCol = week.findIndex(cell => cell.date === partEnd);
                  
                  if (startCol !== -1 && endCol !== -1) {
                    weekEvents.push({
                      ...event,
                      startCol,
                      endCol,
                      partStart,
                      partEnd,
                    });
                  }
                }
              });

              // Sắp xếp sự kiện để render ổn định: dài hơn lên trước, sớm hơn lên trước
              const sortedWeekEvents = weekEvents.sort((a, b) => {
                const spanA = a.endCol - a.startCol;
                const spanB = b.endCol - b.startCol;
                if (spanA !== spanB) return spanB - spanA;
                if (a.startCol !== b.startCol) return a.startCol - b.startCol;
                return a.projectId.localeCompare(b.projectId);
              });

              // Phân bổ track (greedy coloring)
              const tracks = [];
              sortedWeekEvents.forEach(ev => {
                let assignedTrack = 0;
                while (true) {
                  const hasOverlap = (tracks[assignedTrack] || []).some(occupied => {
                    return ev.startCol <= occupied.end && ev.endCol >= occupied.start;
                  });
                  if (!hasOverlap) {
                    break;
                  }
                  assignedTrack++;
                }
                if (!tracks[assignedTrack]) tracks[assignedTrack] = [];
                tracks[assignedTrack].push({ start: ev.startCol, end: ev.endCol });
                ev.track = assignedTrack;
              });

              const maxTrack = sortedWeekEvents.reduce((max, ev) => Math.max(max, ev.track), -1);
              const trackCount = maxTrack + 1;
              const weekHeight = Math.max(120, 36 + trackCount * 28 + 8);

              return (
                <div key={wi} style={{
                  position: 'relative',
                  borderBottom: wi < weeks.length - 1 ? '1px solid var(--color-outline-variant)' : 'none',
                  minHeight: weekHeight,
                }}>
                  {/* Grid nền chứa ô ngày */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    zIndex: 0,
                  }}>
                    {week.map((cell, ci) => {
                      const isToday = cell.date === todayStr;
                      const isWeekend = ci >= 5;
                      
                      return (
                        <div key={ci} style={{
                          borderRight: ci < 6 ? '1px solid var(--color-outline-variant)' : 'none',
                          background: !cell.current ? 'rgba(0,0,0,0.02)' : isToday ? 'rgba(91,106,240,0.04)' : isWeekend ? 'rgba(0,0,0,0.01)' : 'transparent',
                          padding: '6px 8px',
                          boxSizing: 'border-box',
                        }}>
                          {/* Day Number */}
                          <div style={{
                            fontSize: 13,
                            fontWeight: isToday ? 800 : 600,
                            color: !cell.current ? 'var(--color-on-surface-variant)' : isToday ? 'white' : isWeekend ? 'var(--color-error)' : 'var(--color-on-surface)',
                            marginBottom: 4,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}>
                            {isToday ? (
                              <span style={{
                                background: 'var(--color-primary)',
                                color: 'white',
                                borderRadius: '50%',
                                width: 26, height: 26,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 13,
                                fontWeight: 800,
                              }}>
                                {cell.day}
                              </span>
                            ) : (
                              cell.day
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Lớp hiển thị các card kéo dài */}
                  <div style={{
                    position: 'absolute',
                    top: 36,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    pointerEvents: 'none',
                    zIndex: 10,
                  }}>
                    {sortedWeekEvents.map((ev, ei) => {
                      const colors = STATUS_COLORS[ev.status] || STATUS_COLORS['Chờ phản hồi'];
                      const isContFromPrev = ev.startDate < week[0].date;
                      const isContToNext = ev.endDate > week[6].date;
                      
                      return (
                        <div
                          key={ei}
                          onClick={() => handleCardClick(ev.projectId)}
                          title={`${ev.customerName} — ${ev.destination} (${ev.status})\n${ev.meetingTopic || ''}`}
                          style={{
                            position: 'absolute',
                            left: `${ev.startCol * 14.2857}%`,
                            width: `${(ev.endCol - ev.startCol + 1) * 14.2857}%`,
                            top: `${ev.track * 28}px`,
                            height: 24,
                            padding: '0 4px',
                            boxSizing: 'border-box',
                            pointerEvents: 'auto',
                          }}
                        >
                          <div
                            style={{
                              background: colors.bg,
                              padding: '2px 8px',
                              cursor: 'pointer',
                              fontSize: 11,
                              lineHeight: '1.4',
                              color: colors.text,
                              fontWeight: 600,
                              overflow: 'hidden',
                              whiteSpace: 'nowrap',
                              textOverflow: 'ellipsis',
                              transition: 'transform 0.15s, box-shadow 0.15s',
                              height: '100%',
                              boxSizing: 'border-box',
                              borderTop: `1px solid ${colors.border || 'transparent'}`,
                              borderBottom: `1px solid ${colors.border || 'transparent'}`,
                              borderRight: isContToNext ? 'none' : `1px solid ${colors.border || 'transparent'}`,
                              borderLeft: isContFromPrev ? `1px solid ${colors.border || 'transparent'}` : `3px solid ${colors.dot}`,
                              borderTopLeftRadius: isContFromPrev ? 0 : 4,
                              borderBottomLeftRadius: isContFromPrev ? 0 : 4,
                              borderTopRightRadius: isContToNext ? 0 : 4,
                              borderBottomRightRadius: isContToNext ? 0 : 4,
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.01)'; e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                          >
                            {ev.customerName}
                            <span style={{ fontWeight: 400, opacity: 0.8, marginLeft: 4 }}>- {ev.destination}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
          </div>
        </div>

        {/* Status Legend */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          {Object.entries(STATUS_COLORS).map(([status, colors]) => (
            <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-on-surface-variant)' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: colors.dot, display: 'inline-block' }} />
              {status}
            </div>
          ))}
        </div>

        {/* Table Section */}
        <div ref={tableRef} style={{ scrollMarginTop: 80 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-on-surface)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--color-primary)' }}>list_alt</span>
            Danh sách đơn tiếp khách trong tháng
          </h2>

          {/* Slicers */}
          <div className="bg-white border border-outline-variant rounded-xl p-4 mb-4 grid grid-cols-1 md:grid-cols-5 gap-4 items-end shadow-sm">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Khách hàng</label>
              <ComboboxMultiple options={customerOptions} selected={filterCustomer} onChange={setFilterCustomer} placeholder="Tất cả Khách hàng" />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Loại khách hàng</label>
              <ComboboxMultiple options={customerTypeOptions} selected={filterCustomerType} onChange={setFilterCustomerType} placeholder="Tất cả Loại khách" />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Địa điểm</label>
              <ComboboxMultiple options={locationOptions} selected={filterLocation} onChange={setFilterLocation} placeholder="Tất cả Địa điểm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Trạng thái</label>
              <ComboboxMultiple options={statusOptions} selected={filterStatus} onChange={setFilterStatus} placeholder="Tất cả Trạng thái" />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Ngày tiếp đón</label>
              <ComboboxMultiple options={dateOptions} selected={filterDate} onChange={setFilterDate} placeholder="Tất cả Ngày" />
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap">
                <thead className="bg-surface-container border-b border-outline-variant">
                  <tr>
                    <th className="px-4 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Mã Đơn</th>
                    <th className="px-4 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Khách hàng</th>
                    <th className="px-4 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Ngày tiếp đón</th>
                    <th className="px-4 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Địa điểm</th>
                    <th className="px-4 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Chủ đề</th>
                    <th className="px-4 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Người tạo</th>
                    <th className="px-4 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Trạng thái</th>
                    <th className="px-4 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Ngày tạo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-6 text-on-surface-variant">
                        <span className="material-symbols-outlined animate-spin">refresh</span> Đang tải...
                      </td>
                    </tr>
                  ) : filteredSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-6 text-on-surface-variant">
                        <span className="material-symbols-outlined" style={{ fontSize: 40, opacity: 0.2, display: 'block', marginBottom: 8 }}>event_busy</span>
                        Không có đơn tiếp khách nào trong tháng này.
                      </td>
                    </tr>
                  ) : filteredSubmissions.map(sub => (
                    <tr
                      key={sub.projectId}
                      className={`cursor-pointer hover:bg-surface-container-lowest transition-colors ${selectedProjectId === sub.projectId ? 'bg-primary/5' : ''}`}
                      onClick={() => setSelectedProjectId(sub.projectId)}
                    >
                      <td className="px-4 py-3 text-sm font-bold text-primary">{sub.projectId}</td>
                      <td className="px-4 py-3 text-sm text-on-surface font-medium">{sub.customerName}</td>
                      <td className="px-4 py-3 text-sm text-on-surface-variant">
                        {sub.onboardDates
                          ? sub.onboardDates.split(', ').map(d => isoToDisplay(d.trim())).join(', ')
                          : sub.onboardDate ? isoToDisplay(sub.onboardDate) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-on-surface-variant">{sub.destination || '—'}</td>
                      <td className="px-4 py-3 text-sm text-on-surface-variant max-w-[200px] truncate" title={sub.meetingTopic}>{sub.meetingTopic || '—'}</td>
                      <td className="px-4 py-3 text-sm text-on-surface-variant">{sub.submitterName}</td>
                      <td className="px-4 py-3">{getStatusBadge(sub.status)}</td>
                      <td className="px-4 py-3 text-xs text-on-surface-variant">
                        {formatDate(sub.createdAt, 'dd/MM/yyyy')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 bg-surface-container-low border-t border-outline-variant">
              <p className="text-sm text-on-surface-variant">
                Hiển thị: <strong>{filteredSubmissions.length}</strong> / {submissions.length} đơn trong tháng
              </p>
            </div>
          </div>
        </div>
      </div>

      <SubmissionDrawer
        projectId={selectedProjectId}
        currentUser={currentUser}
        onClose={() => { setSelectedProjectId(null); }}
      />
    </>
  );
}
