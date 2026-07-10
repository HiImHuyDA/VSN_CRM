import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getSubmissions } from '../services/api';
import { formatDate } from '../utils/helpers';
import SubmissionDrawer from '../components/dashboard/SubmissionDrawer';
import { ComboboxMultiple } from '../components/ui/combobox';
import { DateRangePicker } from '../components/ui/date-range-picker';
import { t } from '../utils/t';

const getStatusBadge = (status) => {
  const map = {
    'BOD đã duyệt':             { bg: 'bg-green-100', text: 'text-green-700' },
    'PRD đã duyệt':             { bg: 'bg-orange-100', text: 'text-orange-700' },
    'PRD từ chối':              { bg: 'bg-red-100',   text: 'text-red-700'   },
    'BOD từ chối':              { bg: 'bg-red-100',   text: 'text-red-700'   },
    'Chờ phản hồi':            { bg: 'bg-blue-100',  text: 'text-blue-700'  },
    'Đã huỷ':                  { bg: 'bg-gray-200',  text: 'text-gray-700'  },
    'Hoàn thành':              { bg: 'bg-purple-100', text: 'text-purple-700' },
  };
  const s = map[status] || { bg: 'bg-gray-100', text: 'text-gray-600' };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${s.bg} ${s.text}`}>
      {status}
    </span>
  );
};

// Icon mũi tên sort
const SortIcon = ({ columnKey, sortConfig }) => {
  if (sortConfig.key !== columnKey) {
    return <span className="material-symbols-outlined text-xs opacity-30 ml-1">unfold_more</span>;
  }
  return (
    <span className="material-symbols-outlined text-xs text-primary ml-1">
      {sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'}
    </span>
  );
};

const parseDbDate = (str) => {
  if (!str || !str.trim()) return null;
  const parts = str.trim().split('/');
  if (parts.length !== 3) return null;
  const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  return isNaN(d.getTime()) ? null : d;
};

const parseUrlDate = (str) => {
  if (!str || !str.trim()) return null;
  const parts = str.trim().split('-');
  if (parts.length !== 3) return null;
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  return isNaN(d.getTime()) ? null : d;
};

const CLIENT_PAGE_SIZE = 20;

export default function SubmissionList() {
  const [allItems, setAllItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [clientPage, setClientPage] = useState(1);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // URL query params as single source of truth
  const activeTab = searchParams.get('tab') || 'tracking';
  const selectedProjectId = searchParams.get('projectId') || null;

  const filterId = useMemo(() => searchParams.getAll('id'), [searchParams]);
  const filterCustomer = useMemo(() => searchParams.getAll('customer'), [searchParams]);
  const filterYear = useMemo(() => searchParams.getAll('year'), [searchParams]);
  const filterMonth = useMemo(() => searchParams.getAll('month'), [searchParams]);
  const filterLocation = useMemo(() => searchParams.getAll('location'), [searchParams]);
  const filterStatus = useMemo(() => searchParams.getAll('status'), [searchParams]);

  const filterDate = useMemo(() => {
    const fromStr = searchParams.get('dateFrom');
    const toStr = searchParams.get('dateTo');
    const from = fromStr ? parseUrlDate(fromStr) : undefined;
    const to = toStr ? parseUrlDate(toStr) : undefined;
    if (from || to) {
      return { from, to };
    }
    return undefined;
  }, [searchParams]);

  // Lấy user hiện tại từ localStorage
  const currentUser = (() => { try { return JSON.parse(localStorage.getItem('csr_user')); } catch { return null; } })();

  // Tải toàn bộ dữ liệu (không server-pagination) — filter hoàn toàn client-side
  const load = async () => {
    setLoading(true);
    setClientPage(1);
    try {
      const roleParam = currentUser?.role || currentUser?.Role || '';
      const mnvParam = currentUser?.mnv || currentUser?.MNV || '';
      const res = await getSubmissions({ search: '', page: 1, pageSize: 1000, role: roleParam, mnv: mnvParam, tab: activeTab });
      setAllItems(res.data || []);
    } catch { setAllItems([]); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
  }, [activeTab]);

  // Reset client page khi filter thay đổi
  useEffect(() => {
    setClientPage(1);
  }, [
    filterId.join(),
    filterCustomer.join(),
    filterLocation.join(),
    filterStatus.join(),
    filterYear.join(),
    filterMonth.join(),
    searchParams.get('dateFrom'),
    searchParams.get('dateTo')
  ]);

  // Helper to update URL search parameters
  const updateParams = (updates) => {
    const newParams = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      newParams.delete(key);
      if (Array.isArray(value)) {
        value.forEach(v => newParams.append(key, v));
      } else if (value !== undefined && value !== null && value !== '') {
        if (value instanceof Date) {
          const yyyy = value.getFullYear();
          const mm = String(value.getMonth() + 1).padStart(2, '0');
          const dd = String(value.getDate()).padStart(2, '0');
          newParams.set(key, `${yyyy}-${mm}-${dd}`);
        } else {
          newParams.set(key, String(value));
        }
      }
    });

    setSearchParams(newParams);
  };

  // Xóa toàn bộ bộ lọc (giữ lại tab)
  const clearAllFilters = () => {
    const newParams = new URLSearchParams();
    newParams.set('tab', activeTab);
    setSearchParams(newParams);
    setClientPage(1);
  };

  const closeDrawer = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('projectId');
    setSearchParams(newParams);
    load();
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const currentUser = (() => { try { return JSON.parse(localStorage.getItem('csr_user')); } catch { return null; } })();
      const roleParam = currentUser?.role || currentUser?.Role || '';
      const mnvParam  = currentUser?.mnv  || currentUser?.MNV  || '';

      const params = new URLSearchParams();
      params.set('tab',  activeTab);
      params.set('role', roleParam);
      params.set('mnv',  mnvParam);
      filterId.forEach(v       => params.append('id', v));
      filterCustomer.forEach(v => params.append('customer', v));
      filterLocation.forEach(v => params.append('location', v));
      filterStatus.forEach(v   => params.append('status', v));
      filterYear.forEach(v     => params.append('year', v));
      filterMonth.forEach(v    => params.append('month', v));
      if (filterDate?.from) params.set('dateFrom', filterDate.from.toISOString().split('T')[0]);
      if (filterDate?.to)   params.set('dateTo',   filterDate.to.toISOString().split('T')[0]);

      const apiBase = import.meta.env.VITE_API_URL || '/api';
      const url = `${apiBase}/export/submissions?${params.toString()}`;

      const resp = await fetch(url);
      if (!resp.ok) throw new Error('Export thất bại');

      const blob = await resp.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const dateTag = new Date().toISOString().slice(0, 10);
      link.download = `DSach_Don_TiepDon_${dateTag}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    } catch (e) {
      alert('Lỗi xuất dữ liệu: ' + e.message);
    } finally {
      setExporting(false);
    }
  };

  // Sort handler
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
    setClientPage(1);
  };

  // Derive filter options from all items
  const idOptions = useMemo(() => [...new Set(allItems.map(i => i.Project_id))], [allItems]);
  const customerOptions = useMemo(() => [...new Set(allItems.map(i => i.CustomerName))], [allItems]);
  const locationOptions = ['VSN OFFICE', 'VAC', 'VDC', 'VSDN', 'VSN-NT', 'VSPY', 'Khác'];
  const statusOptions = useMemo(() => {
    if (activeTab === 'tracking') {
      const role = String(currentUser?.role || currentUser?.Role || '').trim().toUpperCase();
      if (role === 'BOD') return ['PRD đã duyệt'];
      return ['Chờ phản hồi', 'PRD đã duyệt'];
    }
    return ['PRD đã duyệt', 'PRD từ chối', 'BOD đã duyệt', 'BOD từ chối', 'Chờ phản hồi', 'Hoàn thành', 'Đã huỷ'];
  }, [activeTab, currentUser]);

  const yearOptions = useMemo(() => {
    const years = new Set();
    allItems.forEach(item => {
      if (item.OnboardDates) {
        item.OnboardDates.split(',').forEach(d => {
          const parts = d.trim().split('/');
          if (parts.length === 3) years.add(parts[2]);
        });
      }
    });
    return [...years].sort().map(y => `${y}`);
  }, [allItems]);

  const monthOptions = useMemo(() => {
    const months = new Set();
    allItems.forEach(item => {
      if (item.OnboardDates) {
        item.OnboardDates.split(',').forEach(d => {
          const parts = d.trim().split('/');
          if (parts.length === 3) months.add(parts[1]);
        });
      }
    });
    return [...months].sort((a, b) => parseInt(a) - parseInt(b)).map(m => `Tháng ${m}`);
  }, [allItems]);

  // Apply Slicers
  const filteredItems = useMemo(() => {
    const role = String(currentUser?.role || currentUser?.Role || '').trim().toUpperCase();

    let result = allItems.filter(item => {
      // Tab Filtering
      if (activeTab === 'tracking') {
        if (role === 'BOD') {
          if (item.Status !== 'PRD đã duyệt') return false;
        } else {
          if (!['Chờ phản hồi', 'PRD đã duyệt'].includes(item.Status)) return false;
        }
      }

      // Slicer Filtering
      const matchId = filterId.length === 0 || filterId.includes(item.Project_id);
      const matchCustomer = filterCustomer.length === 0 || filterCustomer.includes(item.CustomerName);
      const matchLocation = filterLocation.length === 0 || filterLocation.some(loc => (item.Destinations || '').includes(loc));
      const matchStatus = filterStatus.length === 0 || filterStatus.includes(item.Status);

      // Filter by Date Range
      let matchDate = true;
      if (filterDate?.from) {
        const from = new Date(filterDate.from); from.setHours(0, 0, 0, 0);
        const to = filterDate.to ? new Date(filterDate.to) : new Date(filterDate.from);
        to.setHours(23, 59, 59, 999);

        const dates = (item.OnboardDates || '').split(',').map(d => parseDbDate(d)).filter(Boolean);
        matchDate = dates.some(d => d >= from && d <= to);
      }

      // Filter by Year
      const matchYear = filterYear.length === 0 || (() => {
        const itemYears = (item.OnboardDates || '').split(',').map(d => {
          const parts = d.trim().split('/');
          return parts.length === 3 ? `${parts[2]}` : null;
        }).filter(Boolean);
        return filterYear.some(y => itemYears.includes(y));
      })();

      // Filter by Month
      const matchMonth = filterMonth.length === 0 || (() => {
        const itemMonths = (item.OnboardDates || '').split(',').map(d => {
          const parts = d.trim().split('/');
          return parts.length === 3 ? `Tháng ${parts[1]}` : null;
        }).filter(Boolean);
        return filterMonth.some(m => itemMonths.includes(m));
      })();

      return matchId && matchCustomer && matchLocation && matchStatus && matchDate && matchYear && matchMonth;
    });

    // Apply sort
    if (sortConfig.key) {
      result = [...result].sort((a, b) => {
        let aVal = a[sortConfig.key] ?? '';
        let bVal = b[sortConfig.key] ?? '';
        // Sort số
        if (sortConfig.key === 'Project_id') {
          aVal = parseInt(aVal) || 0;
          bVal = parseInt(bVal) || 0;
        }
        // Sort ngày CreatedAt / UpdatedAt
        if (['CreatedAt', 'UpdatedAt'].includes(sortConfig.key)) {
          aVal = aVal ? new Date(aVal).getTime() : 0;
          bVal = bVal ? new Date(bVal).getTime() : 0;
        }
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [allItems, activeTab, filterId, filterCustomer, filterLocation, filterStatus, filterDate, filterYear, filterMonth, sortConfig, currentUser]);

  // Client-side pagination
  const totalFiltered = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / CLIENT_PAGE_SIZE));
  const pagedItems = useMemo(() => {
    const start = (clientPage - 1) * CLIENT_PAGE_SIZE;
    return filteredItems.slice(start, start + CLIENT_PAGE_SIZE);
  }, [filteredItems, clientPage]);

  // Kiểm tra có bộ lọc active không
  const hasActiveFilters = filterId.length > 0 || filterCustomer.length > 0 || filterLocation.length > 0 ||
    filterStatus.length > 0 || filterYear.length > 0 || filterMonth.length > 0 || filterDate;

  // Sortable header helper
  const SortableTh = ({ columnKey, label }) => (
    <th
      className="px-4 py-2 text-xs font-bold text-on-surface-variant cursor-pointer select-none hover:text-primary transition-colors"
      onClick={() => handleSort(columnKey)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        <SortIcon columnKey={columnKey} sortConfig={sortConfig} />
      </span>
    </th>
  );

  return (
    <>
      <div className="w-full">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-end mb-4">
          <div>
            <h2 className="text-2xl font-bold text-on-surface mb-1">{t('list.title')}</h2>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="px-4 py-2 bg-white border border-outline-variant rounded-lg font-label-md text-on-surface-variant flex items-center gap-2 hover:bg-surface-container transition-colors w-full sm:w-auto justify-center disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className={`material-symbols-outlined text-sm ${exporting ? 'animate-spin' : ''}`}>
                {exporting ? 'refresh' : 'download'}
              </span>
              {exporting ? 'Đang xuất...' : t('list.exportBtn')}
            </button>
          </div>
        </div>

        <div className="flex gap-4 border-b border-outline-variant mb-6">
          <button 
            className={`pb-2 px-2 font-semibold transition-colors ${activeTab === 'tracking' ? 'border-b-2 border-primary text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
            onClick={() => { updateParams({ tab: 'tracking', status: [] }); }}
          >
            {t('list.tabTracking')}
          </button>
          <button 
            className={`pb-2 px-2 font-semibold transition-colors ${activeTab === 'search' ? 'border-b-2 border-primary text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
            onClick={() => { updateParams({ tab: 'search', status: [] }); }}
          >
            {t('list.tabSearch')}
          </button>
        </div>

        {isMobile && (
          <button 
            className="w-full mb-4 py-2 border border-outline-variant rounded-lg font-bold text-on-surface-variant flex items-center justify-center gap-2 hover:bg-surface-container transition-colors bg-white shadow-sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <span className="material-symbols-outlined">{showFilters ? 'expand_less' : 'filter_list'}</span>
            {showFilters ? 'Ẩn bộ lọc' : 'Hiện bộ lọc'}
          </button>
        )}

        {(!isMobile || showFilters) && (
          <div className="bg-white border border-outline-variant rounded-xl p-4 mb-6 shadow-sm space-y-3">
            {/* Dòng 1: ID, Khách hàng, Năm, Tháng, Khoảng ngày */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">{t('list.filter.id')}</label>
                <ComboboxMultiple options={idOptions} selected={filterId} onChange={(val) => updateParams({ id: val })} placeholder="Tất cả ID" />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">{t('list.filter.customer')}</label>
                <ComboboxMultiple options={customerOptions} selected={filterCustomer} onChange={(val) => updateParams({ customer: val })} placeholder="Tất cả Khách hàng" />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">{t('list.filter.year')}</label>
                <ComboboxMultiple options={yearOptions} selected={filterYear} onChange={(val) => updateParams({ year: val })} placeholder="Tất cả Năm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">{t('list.filter.month')}</label>
                <ComboboxMultiple options={monthOptions} selected={filterMonth} onChange={(val) => updateParams({ month: val })} placeholder="Tất cả Tháng" />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">{t('list.filter.date')}</label>
                <DateRangePicker date={filterDate} setDate={(range) => updateParams({ dateFrom: range?.from, dateTo: range?.to })} />
              </div>
            </div>

            {/* Dòng 2: Địa điểm, Trạng thái, Nút Xóa bộ lọc */}
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">{t('list.filter.location')}</label>
                <ComboboxMultiple options={locationOptions} selected={filterLocation} onChange={(val) => updateParams({ location: val })} placeholder="Tất cả Địa điểm" />
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">{t('list.filter.status')}</label>
                <ComboboxMultiple options={statusOptions} selected={filterStatus} onChange={(val) => updateParams({ status: val })} placeholder="Tất cả Trạng thái" />
              </div>
              {/* Nút Clear All Filters */}
              <div className="flex-shrink-0">
                <button
                  onClick={clearAllFilters}
                  title="Xóa tất cả bộ lọc"
                  disabled={!hasActiveFilters}
                  className={`h-[38px] px-3 rounded-lg border flex items-center gap-1.5 text-sm font-medium transition-all
                    ${hasActiveFilters
                      ? 'border-red-300 text-red-600 bg-red-50 hover:bg-red-100 hover:border-red-400 cursor-pointer'
                      : 'border-outline-variant text-on-surface-variant opacity-40 cursor-not-allowed'
                    }`}
                >
                  <span className="material-symbols-outlined text-base">backspace</span>
                  Xóa bộ lọc
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-surface-container border-b border-outline-variant">
                <tr>
                  <SortableTh columnKey="Project_id" label={t('list.headers.projectId')} />
                  <SortableTh columnKey="CustomerName" label={t('list.headers.customer')} />
                  <th className="px-4 py-2 text-xs font-bold text-on-surface-variant">{t('list.headers.onboardDate')}</th>
                  <SortableTh columnKey="MeetingTopic" label={t('list.headers.topic')} />
                  <SortableTh columnKey="SubmitterName" label={t('list.headers.submitter')} />
                  <SortableTh columnKey="Destinations" label={t('list.headers.location')} />
                  <SortableTh columnKey="Status" label={t('list.headers.status')} />
                  <SortableTh columnKey="CreatedAt" label={t('list.headers.createdAt')} />
                  <SortableTh columnKey="UpdatedAt" label={t('list.headers.updatedAt')} />
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="text-center py-4 text-on-surface-variant">
                      <div className="flex justify-center items-center gap-2">
                        <span className="material-symbols-outlined animate-spin">refresh</span>
                        {t('list.loading')}
                      </div>
                    </td>
                  </tr>
                ) : pagedItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-4 text-on-surface-variant">
                      {t('list.empty')}
                    </td>
                  </tr>
                ) : pagedItems.map(item => (
                  <tr 
                    key={item.Project_id} 
                    className={`cursor-pointer hover:bg-surface-container-lowest transition-colors ${selectedProjectId === item.Project_id ? 'bg-primary/5' : ''}`}
                    onClick={() => updateParams({ projectId: item.Project_id })}
                  >
                    <td className="px-4 py-2 text-sm font-bold text-primary">{item.Project_id}</td>
                    <td className="px-4 py-2 text-sm text-on-surface font-medium">{item.CustomerName}</td>
                    <td className="px-4 py-2 text-sm text-on-surface-variant">
                      {(item.OnboardDates || '').split(',').map(d => {
                        const parts = d.trim().split('-');
                        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
                        return d.trim();
                      }).join(', ')}
                    </td>
                    <td className="px-4 py-2 text-sm text-on-surface-variant max-w-[200px] truncate" title={item.MeetingTopic}>{item.MeetingTopic || 'Không có'}</td>
                    <td className="px-4 py-2 text-sm text-on-surface-variant">{item.SubmitterName}</td>
                    <td className="px-4 py-2 text-sm text-on-surface-variant">{item.Destinations}</td>
                    <td className="px-4 py-2">
                      {getStatusBadge(item.Status)}
                    </td>
                    <td className="px-4 py-2 text-xs text-on-surface-variant">
                      {formatDate(item.CreatedAt, 'dd/MM/yyyy HH:mm')}
                    </td>
                    <td className="px-4 py-2 text-xs text-on-surface-variant">
                      {formatDate(item.UpdatedAt, 'dd/MM/yyyy HH:mm')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 bg-surface-container-low border-t border-outline-variant flex justify-between items-center">
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Trang {totalFiltered === 0 ? 0 : clientPage}/{totalFiltered === 0 ? 0 : totalPages} · {totalFiltered} kết quả
            </p>
            {totalFiltered > 0 && (
              <div className="flex gap-2">
                <button 
                  className="p-2 border border-outline-variant rounded hover:bg-white transition-colors disabled:opacity-50" 
                  disabled={clientPage <= 1}
                  onClick={() => setClientPage(p => Math.max(1, p - 1))}
                >
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
                <button 
                  className="p-2 border border-outline-variant rounded hover:bg-white transition-colors disabled:opacity-50"
                  disabled={clientPage >= totalPages}
                  onClick={() => setClientPage(p => Math.min(totalPages, p + 1))}
                >
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <SubmissionDrawer 
        projectId={selectedProjectId}
        currentUser={currentUser}
        onClose={closeDrawer}
      />
    </>
  );
}
