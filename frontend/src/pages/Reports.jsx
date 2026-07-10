// src/pages/Reports.jsx — Báo cáo & Thống kê nâng cao (BOD, PRD, Admin only)
import { useState, useEffect } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import api from '../services/api';
import { ComboboxMultiple } from '../components/ui/combobox';

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6b7280'];
const PROGRESS_COLORS = ['#10b981', '#ef4444']; // Ontime, Delay

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-bold text-gray-900 mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="text-gray-500 font-medium">{p.name}:</span>
          <span className="font-extrabold text-gray-900">
            {p.value !== undefined ? (typeof p.value === 'number' && p.name.includes('%') ? `${p.value}%` : p.value) : '—'}
          </span>
        </div>
      ))}
    </div>
  );
};

const KpiCard = ({ icon, label, value, colorClass = "text-primary", mom, yoy, subText }) => {
  const renderTrend = (val, type) => {
    if (val === undefined || val === null) return null;
    const isPositive = val >= 0;
    return (
      <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${
        isPositive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
      }`}>
        {type}: {isPositive ? '↑' : '↓'} {Math.abs(val)}%
      </span>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl p-2.5 bg-gray-50 rounded-xl">{icon}</span>
        <div className="flex flex-col items-end gap-1">
          {renderTrend(mom, 'MoM')}
          {renderTrend(yoy, 'YoY')}
        </div>
      </div>
      <p className={`text-3xl font-black tracking-tight ${colorClass}`}>{value ?? '—'}</p>
      <p className="text-xs text-gray-400 mt-1 font-bold uppercase tracking-wider">{label}</p>
      {subText && <p className="text-xs text-gray-500 mt-1 font-semibold">{subText}</p>}
    </div>
  );
};

export default function Reports() {
  const [activeTab, setActiveTab] = useState('summary'); // summary | review | progress
  
  // States cho bộ lọc
  const [filters, setFilters] = useState({
    years: [],
    months: [],
    weeks: [],
    customerTypes: [],
    customerNames: [],
    destinations: [],
    departments: [],
    projectStatuses: [],
    taskStatuses: []
  });

  // Tùy chọn bộ lọc lấy từ DB
  const [filterOptions, setFilterOptions] = useState({
    years: [],
    months: [],
    weeks: [],
    customerTypes: [],
    customerNames: [],
    destinations: [],
    departments: [],
    projectStatuses: ['Hoàn thành', 'Chờ phản hồi', 'Đang xử lý'],
    taskStatuses: ['Hoàn thành', 'Delay', 'Đang xử lý']
  });

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(true);

  // Load danh mục các bộ lọc khi mount
  useEffect(() => {
    api.get('/reports/filters')
      .then(res => {
        if (res.success) {
          const dbOptions = res.data;
          setFilterOptions({
            years: (dbOptions.years || []).map(r => String(r.Year)),
            months: (dbOptions.months || []).map(r => String(r.Month)),
            weeks: (dbOptions.weeks || []).map(r => String(r.Week)),
            customerTypes: (dbOptions.customerTypes || []).map(r => r.CustomerType),
            customerNames: (dbOptions.customerNames || []).map(r => r.CustomerName),
            destinations: (dbOptions.destinations || []).map(r => r.Destination),
            departments: (dbOptions.departments || []).map(r => r.Department),
            projectStatuses: ['Hoàn thành', 'Chờ phản hồi', 'Đang xử lý'],
            taskStatuses: ['Hoàn thành', 'Delay', 'Đang xử lý']
          });
        }
      })
      .catch(err => console.error('Error fetching filter options:', err));
  }, []);

  // Lấy params gửi lên API
  const getFilterParams = () => {
    const params = {};
    if (filters.years.length > 0) params.year = filters.years.join(',');
    if (filters.months.length > 0) params.month = filters.months.join(',');
    if (filters.weeks.length > 0) params.week = filters.weeks.join(',');
    if (filters.customerTypes.length > 0) params.customerType = filters.customerTypes.join(',');
    if (filters.customerNames.length > 0) params.customerName = filters.customerNames.join(',');
    if (filters.destinations.length > 0) params.destination = filters.destinations.join(',');
    if (filters.departments.length > 0) params.department = filters.departments.join(',');
    if (filters.projectStatuses.length > 0) params.projectStatus = filters.projectStatuses.join(',');
    if (filters.taskStatuses.length > 0) params.taskStatus = filters.taskStatuses.join(',');
    return params;
  };

  // Load báo cáo khi thay đổi tab hoặc filter
  useEffect(() => {
    setLoading(true);
    const params = getFilterParams();

    api.get(`/reports/${activeTab}`, { params })
      .then(res => {
        if (res.success) {
          setData(res.data);
        }
      })
      .catch(err => console.error(`Error loading reports for ${activeTab}:`, err))
      .finally(() => setLoading(false));
  }, [activeTab, filters]);

  const handleClearFilters = () => {
    setFilters({
      years: [],
      months: [],
      weeks: [],
      customerTypes: [],
      customerNames: [],
      destinations: [],
      departments: [],
      projectStatuses: [],
      taskStatuses: []
    });
  };

  const updateFilter = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-on-surface mb-1">Báo cáo & Thống kê</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 shadow-sm transition-all"
          >
            <span className="material-symbols-outlined text-lg">filter_alt</span>
            {showFilters ? 'Ẩn bộ lọc' : 'Hiện bộ lọc'}
          </button>
          <button
            onClick={handleClearFilters}
            className="flex items-center gap-2 px-4 py-2 border border-transparent bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-bold text-gray-700 transition-all"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Slicers Filters Bar */}
      {showFilters && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h4 className="font-extrabold text-sm text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-4 bg-primary rounded-full" />
            BỘ LỌC BÁO CÁO
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Năm</label>
              <ComboboxMultiple
                options={filterOptions.years}
                selected={filters.years}
                onChange={val => updateFilter('years', val)}
                placeholder="Tất cả năm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Tháng</label>
              <ComboboxMultiple
                options={filterOptions.months}
                selected={filters.months}
                onChange={val => updateFilter('months', val)}
                placeholder="Tất cả tháng"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Tuần</label>
              <ComboboxMultiple
                options={filterOptions.weeks}
                selected={filters.weeks}
                onChange={val => updateFilter('weeks', val)}
                placeholder="Tất cả tuần"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Loại khách hàng</label>
              <ComboboxMultiple
                options={filterOptions.customerTypes}
                selected={filters.customerTypes}
                onChange={val => updateFilter('customerTypes', val)}
                placeholder="Tất cả loại"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Khách hàng</label>
              <ComboboxMultiple
                options={filterOptions.customerNames}
                selected={filters.customerNames}
                onChange={val => updateFilter('customerNames', val)}
                placeholder="Tất cả khách"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Địa điểm</label>
              <ComboboxMultiple
                options={filterOptions.destinations}
                selected={filters.destinations}
                onChange={val => updateFilter('destinations', val)}
                placeholder="Tất cả địa điểm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Phòng ban</label>
              <ComboboxMultiple
                options={filterOptions.departments}
                selected={filters.departments}
                onChange={val => updateFilter('departments', val)}
                placeholder="Tất cả phòng"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Tình trạng đơn</label>
              <ComboboxMultiple
                options={filterOptions.projectStatuses}
                selected={filters.projectStatuses}
                onChange={val => updateFilter('projectStatuses', val)}
                placeholder="Tất cả trạng thái"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Tình trạng công việc</label>
              <ComboboxMultiple
                options={filterOptions.taskStatuses}
                selected={filters.taskStatuses}
                onChange={val => updateFilter('taskStatuses', val)}
                placeholder="Tất cả trạng thái"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {[
          { id: 'summary',  label: '📈 Thống kê tiếp đón', icon: 'analytics' },
          { id: 'review',   label: '⭐ Đánh giá khách hàng', icon: 'rate_review' },
          { id: 'progress', label: '⏳ Báo cáo tiến độ', icon: 'checklist' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setData(null);
            }}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-extrabold border-b-2 transition-all ${
              activeTab === tab.id
                ? 'border-primary text-primary bg-primary/5 rounded-t-xl'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <span className="material-symbols-outlined text-lg">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Container */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px] flex-col gap-3">
          <span className="material-symbols-outlined text-4xl text-primary animate-spin">refresh</span>
          <p className="text-gray-500 font-semibold text-sm">Đang tính toán dữ liệu báo cáo...</p>
        </div>
      ) : !data ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-gray-400 font-semibold">
          Không có dữ liệu hiển thị. Vui lòng kiểm tra lại bộ lọc.
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* TAB 1: THỐNG KÊ TIẾP ĐÓN */}
          {activeTab === 'summary' && (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <KpiCard
                  icon="💼"
                  label="Tổng số đơn tiếp đón"
                  value={data.kpi.TotalSubmissions}
                  colorClass="text-primary"
                  mom={data.kpi.TotalMoM}
                  yoy={data.kpi.TotalYoY}
                  subText={`Hoàn thành: ${data.kpi.CompletedSubmissions} | Đang xử lý: ${data.kpi.ProcessingSubmissions} | Chờ phản hồi: ${data.kpi.PendingSubmissions}`}
                />
                <KpiCard
                  icon="📋"
                  label="Tổng số công việc chuẩn bị"
                  value={data.kpi.TotalTasks}
                  colorClass="text-purple-600"
                  subText={`Hoàn thành: ${data.kpi.CompletedTasks} | Đang xử lý: ${data.kpi.ProcessingTasks} | Delay: ${data.kpi.DelayTasks}`}
                />
                <KpiCard
                  icon="⭐"
                  label="Đánh giá khách hàng"
                  value={data.kpi.AverageRating ? `${data.kpi.AverageRating} / 5.0` : '—'}
                  colorClass="text-amber-500"
                  mom={data.kpi.RatingMoM}
                  yoy={data.kpi.RatingYoY}
                  subText="Dựa trên thang điểm 5 sao"
                />
              </div>

              {/* Charts Row 1 */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Column Chart 1 */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm lg:col-span-2">
                  <h3 className="font-bold text-gray-800 text-lg mb-4">Số đơn tiếp đón (Tổng cộng)</h3>
                  <div className="h-[300px]">
                    {data.trendByOnboardDate?.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-gray-400 font-semibold">Không có dữ liệu xu hướng</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={(data.trendByOnboardDate || []).map(item => ({
                          ...item,
                          Total: (item.Completed || 0) + (item.Processing || 0) + (item.Pending || 0)
                        }))}>
                          <defs>
                            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="OnboardDate" tickFormatter={(str) => {
                            if (!str) return '';
                            const p = str.split('-');
                            return p.length === 3 ? `${p[2]}/${p[1]}` : str;
                          }} tick={{ fontSize: 11, fontWeight: 'bold' }} />
                          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend wrapperStyle={{ fontSize: 12, pt: 10 }} />
                          <Area type="monotone" dataKey="Total" name="Số đơn tiếp đón" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorTotal)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Pie Chart: Tỉ lệ đơn theo tình trạng */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <h3 className="font-bold text-gray-800 text-lg mb-4">Tỷ lệ đơn tiếp đón theo tình trạng</h3>
                  <div className="h-[220px] relative">
                    {data.byStatus?.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-gray-400 font-semibold">Không có dữ liệu tỷ lệ</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={data.byStatus.map(r => ({ name: r.Status, value: r.Count }))}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={80}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {data.byStatus.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-4">
                    {data.byStatus?.map((item, index) => (
                      <div key={index} className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                        <span>{item.Status} ({item.Count})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Charts Row 2 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Column Chart: Đơn theo phòng ban */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <h3 className="font-bold text-gray-800 text-lg mb-4">Tổng đơn tiếp đón theo phòng ban</h3>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.byDepartment}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="Department" tick={{ fontSize: 11, fontWeight: 'bold' }} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="Total" name="Tổng đơn" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Bar Chart: Đơn theo địa điểm */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <h3 className="font-bold text-gray-800 text-lg mb-4">Tổng đơn tiếp đón theo địa điểm</h3>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.byLocation} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis dataKey="Destination" type="category" tick={{ fontSize: 10, fontWeight: 'bold' }} width={90} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="Count" name="Số đơn" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Top khách hàng Table */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  <h3 className="font-bold text-gray-800 text-lg">Top khách hàng tiếp đón nhiều nhất</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="py-3 px-5 text-xs font-bold text-gray-500 uppercase">Hạng</th>
                        <th className="py-3 px-5 text-xs font-bold text-gray-500 uppercase">Tên khách hàng</th>
                        <th className="py-3 px-5 text-xs font-bold text-gray-500 uppercase">Phân loại</th>
                        <th className="py-3 px-5 text-xs font-bold text-gray-500 uppercase text-center">Số chuyến tiếp đón</th>
                        <th className="py-3 px-5 text-xs font-bold text-gray-500 uppercase text-center">Đánh giá trung bình</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.topCustomers?.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-5 font-black text-gray-400">#{idx + 1}</td>
                          <td className="py-3 px-5 font-bold text-gray-900">{item.CustomerName}</td>
                          <td className="py-3 px-5">
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                              {item.CustomerType}
                            </span>
                          </td>
                          <td className="py-3 px-5 text-center font-extrabold text-primary">{item.VisitCount}</td>
                          <td className="py-3 px-5 text-center font-extrabold text-amber-500">
                            {item.AverageRating ? `⭐ ${item.AverageRating} / 5.0` : 'Chưa có đánh giá'}
                          </td>
                        </tr>
                      ))}
                      {(!data.topCustomers || data.topCustomers.length === 0) && (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-gray-400 font-medium">Không tìm thấy khách hàng nào</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Table: Chi tiết các đơn tiếp đón */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  <h3 className="font-bold text-gray-800 text-lg">Chi tiết danh sách các chuyến tiếp khách</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="py-3 px-5 text-xs font-bold text-gray-500 uppercase">Mã đơn</th>
                        <th className="py-3 px-5 text-xs font-bold text-gray-500 uppercase">Khách hàng</th>
                        <th className="py-3 px-5 text-xs font-bold text-gray-500 uppercase">Loại</th>
                        <th className="py-3 px-5 text-xs font-bold text-gray-500 uppercase">Chủ đề họp</th>
                        <th className="py-3 px-5 text-xs font-bold text-gray-500 uppercase">Người đề xuất</th>
                        <th className="py-3 px-5 text-xs font-bold text-gray-500 uppercase">Ngày onboard</th>
                        <th className="py-3 px-5 text-xs font-bold text-gray-500 uppercase text-center">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.detailsTable?.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-5 font-bold text-primary">{item.Project_id}</td>
                          <td className="py-3 px-5 font-semibold text-gray-900">{item.CustomerName}</td>
                          <td className="py-3 px-5">
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                              {item.CustomerType}
                            </span>
                          </td>
                          <td className="py-3 px-5 text-gray-600 truncate max-w-xs">{item.MeetingTopic || '—'}</td>
                          <td className="py-3 px-5 text-gray-600 font-medium">{item.SubmitterName}</td>
                          <td className="py-3 px-5 text-gray-600 font-bold">{item.OnboardDates || '—'}</td>
                          <td className="py-3 px-5 text-center">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                              item.Status === 'Hoàn thành' ? 'bg-green-50 text-green-700' :
                              item.Status === 'BOD đã duyệt' ? 'bg-purple-50 text-purple-700' :
                              item.Status === 'Chờ phản hồi' || item.Status === 'Đã gửi-Chờ phản hồi' ? 'bg-blue-50 text-blue-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {item.Status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {(!data.detailsTable || data.detailsTable.length === 0) && (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-gray-400 font-medium">Không tìm thấy chuyến tiếp đón nào</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ĐÁNH GIÁ KHÁCH HÀNG */}
          {activeTab === 'review' && (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider truncate">Điểm đánh giá trung bình</p>
                    <p className="text-3xl font-black text-amber-500 mt-0.5">{data.kpi.AverageRating || '—'} / 5.0</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-50 text-amber-600 text-2xl shrink-0">
                    ⭐
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider truncate">Tổng số lượt đánh giá</p>
                    <p className="text-3xl font-black text-blue-600 mt-0.5">{data.kpi.TotalReviews || 0}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600 shrink-0">
                    <span className="material-symbols-outlined text-2xl">rate_review</span>
                  </div>
                </div>
              </div>

              {/* Top & Bottom Criteria side-by-side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Top Criteria */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <h3 className="font-bold text-emerald-600 text-lg mb-4 flex items-center gap-1.5">
                    <span className="material-symbols-outlined">thumb_up</span>
                    Tiêu chí đánh giá cao nhất
                  </h3>
                  <div className="space-y-3">
                    {data.byCriteria?.slice(0, 5).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between border-b border-gray-50 pb-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-gray-900 text-sm truncate">{item.CriteriaName}</p>
                          <p className="text-[10px] text-gray-400 font-extrabold uppercase">{item.CriteriaGroup}</p>
                        </div>
                        <span className="font-extrabold text-sm text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
                          ⭐ {item.AverageRating} / 5.0
                        </span>
                      </div>
                    ))}
                    {(!data.byCriteria || data.byCriteria.length === 0) && (
                      <p className="text-sm text-gray-400 italic">Chưa có dữ liệu tiêu chí</p>
                    )}
                  </div>
                </div>

                {/* Bottom Criteria */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <h3 className="font-bold text-red-600 text-lg mb-4 flex items-center gap-1.5">
                    <span className="material-symbols-outlined">thumb_down</span>
                    Tiêu chí đánh giá thấp nhất
                  </h3>
                  <div className="space-y-3">
                    {[...data.byCriteria].reverse().slice(0, 5).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between border-b border-gray-50 pb-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-gray-900 text-sm truncate">{item.CriteriaName}</p>
                          <p className="text-[10px] text-gray-400 font-extrabold uppercase">{item.CriteriaGroup}</p>
                        </div>
                        <span className="font-extrabold text-sm text-red-600 bg-red-50 px-2.5 py-1 rounded-lg">
                          ⭐ {item.AverageRating} / 5.0
                        </span>
                      </div>
                    ))}
                    {(!data.byCriteria || data.byCriteria.length === 0) && (
                      <p className="text-sm text-gray-400 italic">Chưa có dữ liệu tiêu chí</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Destination Ratings Chart */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="font-bold text-gray-800 text-lg mb-4">Điểm đánh giá theo địa điểm tiếp đón</h3>
                <div className="h-[280px]">
                  {data.byDestination?.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-400 font-semibold">Chưa có địa điểm nào được đánh giá</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.byDestination}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="Destination" tick={{ fontSize: 11, fontWeight: 'bold' }} />
                        <YAxis tick={{ fontSize: 11 }} domain={[0, 5]} allowDecimals={true} />
                        <Tooltip formatter={(val) => [`${val} / 5.0`, 'Điểm đánh giá TB']} />
                        <Bar dataKey="AverageRating" name="Điểm đánh giá TB" fill="#10b981" radius={[4, 4, 0, 0]}>
                          {data.byDestination.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Table chi tiết đánh giá */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  <h3 className="font-bold text-gray-800 text-lg">Chi tiết bảng đánh giá phản hồi</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="py-3 px-5 text-xs font-bold text-gray-500 uppercase">Ngày tiếp đón</th>
                        <th className="py-3 px-5 text-xs font-bold text-gray-500 uppercase">Địa điểm</th>
                        <th className="py-3 px-5 text-xs font-bold text-gray-500 uppercase">Khách hàng</th>
                        <th className="py-3 px-5 text-xs font-bold text-gray-500 uppercase">Nhận xét</th>
                        <th className="py-3 px-5 text-xs font-bold text-gray-500 uppercase text-center">Đánh giá rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.commentsTable?.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-5 font-bold text-gray-600">{item.OnboardDates || '—'}</td>
                          <td className="py-3 px-5 text-gray-700 font-semibold">{item.Destinations || '—'}</td>
                          <td className="py-3 px-5 font-bold text-gray-900">{item.CustomerName}</td>
                          <td className="py-3 px-5 text-gray-600 font-medium italic">"{item.Comment}"</td>
                          <td className="py-3 px-5 text-center">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-50 text-amber-600 border border-amber-200">
                              ⭐ {item.Rating} / 5
                            </span>
                          </td>
                        </tr>
                      ))}
                      {(!data.commentsTable || data.commentsTable.length === 0) && (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-gray-400 font-medium">Chưa có bình luận đánh giá nào từ khách hàng</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BÁO CÁO TIẾN ĐỘ */}
          {activeTab === 'progress' && (
            <div className="space-y-6">
              {/* Row 1: Pie charts tiến độ */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Tiến độ gửi đơn tiếp đón */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center">
                  <h3 className="font-bold text-gray-800 text-lg mb-2 w-full text-left uppercase">Tiến độ gửi đơn tiếp đón</h3>
                  
                  <div className="h-[220px] w-full relative">
                    {(!data.submissionProgress.OntimeCount && !data.submissionProgress.DelayCount) ? (
                      <div className="flex items-center justify-center h-full text-gray-400 font-semibold">Chưa có đơn hàng nào</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Đúng hạn (Ontime)', value: data.submissionProgress.OntimeCount || 0 },
                              { name: 'Trễ hạn (Delay)', value: data.submissionProgress.DelayCount || 0 }
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={80}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            <Cell fill={PROGRESS_COLORS[0]} />
                            <Cell fill={PROGRESS_COLORS[1]} />
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  
                  <div className="flex justify-center gap-6 mt-4 w-full">
                    <div className="text-center">
                      <p className="text-xs font-bold text-gray-400 uppercase">Ontime</p>
                      <p className="text-xl font-black text-emerald-600">{data.submissionProgress.OntimeCount || 0}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-gray-400 uppercase">Delay</p>
                      <p className="text-xl font-black text-red-600">{data.submissionProgress.DelayCount || 0}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-gray-400 uppercase">Tỷ lệ Ontime</p>
                      <p className="text-xl font-black text-primary">
                        {Math.round(((data.submissionProgress.OntimeCount || 0) / ((data.submissionProgress.OntimeCount || 0) + (data.submissionProgress.DelayCount || 0) || 1)) * 100)}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tiến độ hoàn thành công việc */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center">
                  <h3 className="font-bold text-gray-800 text-lg mb-2 w-full text-left uppercase">Tiến độ chuẩn bị công việc</h3>
                  
                  <div className="h-[220px] w-full relative">
                    {(!data.taskProgress.OntimeCount && !data.taskProgress.DelayCount) ? (
                      <div className="flex items-center justify-center h-full text-gray-400 font-semibold">Chưa có công việc nào</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Đúng hạn (Ontime)', value: data.taskProgress.OntimeCount || 0 },
                              { name: 'Quá hạn (Delay)', value: data.taskProgress.DelayCount || 0 }
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={80}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            <Cell fill={PROGRESS_COLORS[0]} />
                            <Cell fill={PROGRESS_COLORS[1]} />
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  
                  <div className="flex justify-center gap-6 mt-4 w-full">
                    <div className="text-center">
                      <p className="text-xs font-bold text-gray-400 uppercase">Ontime</p>
                      <p className="text-xl font-black text-emerald-600">{data.taskProgress.OntimeCount || 0}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-gray-400 uppercase">Delay</p>
                      <p className="text-xl font-black text-red-600">{data.taskProgress.DelayCount || 0}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-gray-400 uppercase">Tỷ lệ Ontime</p>
                      <p className="text-xl font-black text-primary">
                        {Math.round(((data.taskProgress.OntimeCount || 0) / ((data.taskProgress.OntimeCount || 0) + (data.taskProgress.DelayCount || 0) || 1)) * 100)}%
                      </p>
                    </div>
                  </div>
                </div>

              </div>

              {/* Row 2: Charts tỷ lệ Ontime vs Delay */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Top Team Ontime */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <h3 className="font-bold text-gray-800 text-lg mb-4 uppercase">Tỷ lệ ontime công việc theo team</h3>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[...data.departmentProgress].sort((a,b) => b.OntimeRate - a.OntimeRate).slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="Department" tick={{ fontSize: 11, fontWeight: 'bold' }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="OntimeRate" name="Tỷ lệ Ontime (%)" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Top Team Delay */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <h3 className="font-bold text-gray-800 text-lg mb-4 uppercase">Tỷ lệ delay công việc theo team</h3>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[...data.departmentProgress].sort((a,b) => b.DelayRate - a.DelayRate).slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="Department" tick={{ fontSize: 11, fontWeight: 'bold' }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="DelayRate" name="Tỷ lệ Delay (%)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>

            </div>
          )}

        </div>
      )}
    </div>
  );
}
