// src/pages/Dashboard.jsx — Trang chủ Tổng quan hệ thống đón tiếp khách
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import api from '../services/api';

/* ── helpers ── */
const fmtDate = (str) => {
  if (!str) return '—';
  const parts = str.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return str;
};

const StatusBadge = ({ status }) => {
  const map = {
    'BOD đã duyệt': 'bg-green-100 text-green-700 border border-green-200',
    'PRD đã duyệt': 'bg-orange-100 text-orange-700 border border-orange-200',
    'Hoàn thành': 'bg-purple-100 text-purple-700 border border-purple-200',
    'Chờ phản hồi': 'bg-blue-100 text-blue-700 border border-blue-200',
    'Đã gửi-Chờ phản hồi': 'bg-blue-100 text-blue-700 border border-blue-200',
    'PRD từ chối': 'bg-red-100 text-red-700 border border-red-200',
    'BOD từ chối': 'bg-red-100 text-red-700 border border-red-200',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${map[status] || 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
      {status}
    </span>
  );
};

const TaskStatusBadge = ({ status }) => {
  const map = {
    'Hoàn thành': 'bg-green-100 text-green-700 border border-green-200',
    'Đang xử lý': 'bg-blue-100 text-blue-700 border border-blue-200',
    'Delay': 'bg-red-100 text-red-700 border border-red-200',
    'Chưa bắt đầu': 'bg-gray-100 text-gray-700 border border-gray-200',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${map[status] || 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
      {status}
    </span>
  );
};

const StatCard = ({ icon, label, value, color, trend }) => {
  const isPositive = trend >= 0;
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4 hover:shadow-md transition-shadow w-full">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider truncate">{label}</p>
        <div className="flex flex-col mt-0.5">
          <p className="text-3xl font-black text-gray-900 leading-none">{value ?? '—'}</p>
          {trend !== undefined && trend !== null && (
            <div className="flex items-center gap-1 mt-1">
              <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isPositive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                {isPositive ? '▲' : '▼'} {Math.abs(trend)}% MoM
              </span>
              <span className="text-[10px] text-gray-400 font-semibold">so với tháng trước</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper helper build calendar days
const getCalendarDays = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-indexed

  const firstDay = new Date(year, month, 1);
  const startDayOfWeek = firstDay.getDay(); // 0: CN, 1: T2...
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(new Date(year, month, d));
  }
  return days;
};

const toLocalDateString = (date) => {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const user = JSON.parse(localStorage.getItem('csr_user') || '{}');
        const role = user.role || user.Role || '';
        const mnv = user.mnv || user.MNV || '';
        const res = await api.get('/dashboard', { params: { role, mnv } });
        if (res.success) {
          setData(res.data);
        }
      } catch (e) {
        console.error('Dashboard error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] flex-col gap-3">
        <span className="material-symbols-outlined text-4xl text-primary animate-spin">refresh</span>
        <p className="text-gray-500 font-semibold">Đang tải dữ liệu tổng quan...</p>
      </div>
    );
  }

  const {
    stats = {},
    byMonth = [],
    calendarDates = [],
    notifications = [],
    monthlyGuests = [],
    monthlyTasks = []
  } = data || {};

  // Map monthly data for Line chart
  const lineChartData = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
    const found = byMonth.find(x => x.Month === m);
    return {
      name: `Th${m}`,
      'Số đơn': found ? found.Total : 0
    };
  });

  const calendarDays = getCalendarDays();
  const todayStr = toLocalDateString(new Date());

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-on-surface mb-1">Tổng quan hệ thống</h2>
          <p className="text-xs text-gray-400 font-bold mt-0.5">
            Cập nhật lúc {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} — {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* KPI Cards (4 cards chính) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon="💼"
          label="Đơn tiếp đón tháng này"
          value={stats.TotalSubmissionsMonth}
          color="bg-blue-50 text-blue-600"
          trend={stats.SubmissionsMonthMoM}
        />
        <StatCard
          icon="⌛"
          label="Đang chờ tiếp đón"
          value={stats.FutureReceptionsCount}
          color="bg-amber-50 text-amber-600"
        />
        <StatCard
          icon="📅"
          label="Lịch hẹn tuần này"
          value={stats.WeeklyScheduleCount}
          color="bg-purple-50 text-purple-600"
        />
        <StatCard
          icon="🚨"
          label="Cần thực hiện khẩn cấp"
          value={stats.TasksNearDeadlineCount}
          color={stats.TasksNearDeadlineCount > 0 ? "bg-red-50 text-red-600 animate-pulse" : "bg-green-50 text-green-600"}
        />
      </div>

      {/* Charts & Mini Calendar Widget */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Column 1 & 2 (2/3 width) for Line Chart and Mini Calendar */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Monthly Trend Line Chart */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-gray-800 text-lg">Thống kê tiếp khách theo tháng</h3>
            </div>
            <div className="h-[230px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 'bold' }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="Số đơn" stroke="#3b82f6" strokeWidth={3} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Mini Calendar Widget */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-gray-800 text-lg">Các đơn tiếp đón khách trong tháng</h3>

              {/* Legend */}
              <div className="flex items-center gap-3 text-[11px] font-bold text-gray-400 mt-1 mb-3">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span>Sắp tiếp đón</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-gray-400" />
                  <span>Đã tiếp đón</span>
                </div>
              </div>
            </div>

            {/* Monthly Calendar Grid */}
            <div className="flex-1">
              <div className="grid grid-cols-7 gap-y-2 text-center text-xs font-bold text-gray-500 mb-1 border-b border-gray-50 pb-1">
                <span>CN</span><span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span>
              </div>
              <div className="grid grid-cols-7 gap-y-2.5">
                {calendarDays.map((day, idx) => {
                  if (!day) return <div key={`empty-${idx}`} />;
                  const dayStr = toLocalDateString(day);
                  const isToday = dayStr === todayStr;

                  // Tìm dot color
                  const dateMatch = calendarDates.find(c => c.OnboardDate === dayStr);
                  const hasDot = !!dateMatch;
                  const dotColor = dateMatch?.DotColor === 'green' ? 'bg-green-500' : 'bg-gray-400';

                  return (
                    <div key={dayStr} className="flex flex-col items-center justify-center relative py-0.5">
                      <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-black ${isToday ? 'border-2 border-primary text-primary font-black bg-primary/5' : 'text-gray-700'
                        }`}>
                        {day.getDate()}
                      </span>
                      {hasDot && (
                        <span className={`w-1.5 h-1.5 rounded-full absolute bottom-[-4px] ${dotColor}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="text-[10px] text-right text-gray-400 font-extrabold mt-3 uppercase tracking-wider">
              {new Date().toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}
            </div>
          </div>

        </div>

        {/* Sidebar Column (1/3 width) for notifications waiting BOD/PRD approval */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col h-[325px]">
            <h3 className="font-bold text-gray-800 text-lg mb-3">
              Yêu cầu chờ phê duyệt
            </h3>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                  <span className="material-symbols-outlined text-4xl mb-2 text-gray-300">verified_user</span>
                  <p className="text-xs font-bold">Không có yêu cầu chờ duyệt</p>
                </div>
              ) : (
                notifications.map((noti) => {
                  const text = noti.Status === 'PRD đã duyệt'
                    ? `Đơn tiếp đón khách ${noti.CustomerName} ngày ${noti.OnboardDates || ''} đang chờ BOD duyệt`
                    : `Đơn tiếp đón khách ${noti.CustomerName} ngày ${noti.OnboardDates || ''} đang chờ phản hồi`;

                  return (
                    <div
                      key={noti.ProjectId}
                      onClick={() => noti.ProjectId && navigate(`/submissions?projectId=${noti.ProjectId}`)}
                      className="p-3 rounded-xl border border-blue-50 bg-blue-50/20 text-xs cursor-pointer transition-all hover:bg-blue-50/40 border-l-4 border-l-primary"
                    >
                      <p className="font-extrabold text-gray-900 leading-normal mb-1">{text}</p>
                      <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold">
                        <span>
                          {new Date(noti.CreatedAt).toLocaleDateString('vi-VN')} {new Date(noti.CreatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-primary font-black">#{noti.ProjectId}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Tables Row: Month guests list & Preparing tasks calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Table 1: Danh sách khách hàng trong tháng hiện tại */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-800 text-lg">Danh sách khách có ngày tiếp đón tháng hiện tại</h3>
          </div>

          <div className="overflow-x-auto flex-1 max-h-[350px]">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                <tr>
                  <th className="py-2.5 px-4 text-xs font-bold text-gray-500 uppercase">Đơn</th>
                  <th className="py-2.5 px-4 text-xs font-bold text-gray-500 uppercase">Khách hàng</th>
                  <th className="py-2.5 px-4 text-xs font-bold text-gray-500 uppercase">Ngày tiếp đón</th>
                  <th className="py-2.5 px-4 text-xs font-bold text-gray-500 uppercase text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {monthlyGuests.map(trip => (
                  <tr
                    key={trip.ProjectId}
                    className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/submissions?projectId=${trip.ProjectId}`)}
                  >
                    <td className="py-2.5 px-4">
                      <span className="text-primary font-black text-xs">#{trip.ProjectId}</span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="font-extrabold text-gray-900 block truncate max-w-[150px]">{trip.CustomerName}</span>
                      <span className="text-[10px] text-gray-400 font-bold block">{trip.CustomerType}</span>
                    </td>
                    <td className="py-2.5 px-4 text-gray-600 font-bold text-xs">
                      {trip.OnboardDates || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <StatusBadge status={trip.Status} />
                    </td>
                  </tr>
                ))}
                {monthlyGuests.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-gray-400 font-medium">Không có chuyến tiếp đón nào trong tháng này</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 2: Lịch hoàn thành công việc chuẩn bị */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-800 text-lg">Lịch hoàn thành công việc chuẩn bị</h3>
          </div>

          <div className="overflow-x-auto flex-1 max-h-[350px]">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                <tr>
                  <th className="py-2.5 px-4 text-xs font-bold text-gray-500 uppercase">Công việc</th>
                  <th className="py-2.5 px-4 text-xs font-bold text-gray-500 uppercase">Khách hàng</th>
                  <th className="py-2.5 px-4 text-xs font-bold text-gray-500 uppercase">Hạn chót</th>
                  <th className="py-2.5 px-4 text-xs font-bold text-gray-500 uppercase text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {monthlyTasks.map(task => (
                  <tr
                    key={task.TaskId}
                    className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/tasks?taskId=${task.TaskId}`)}
                  >
                    <td className="py-2.5 px-4">
                      <span className="font-extrabold text-gray-900 block truncate max-w-[150px]">{task.TaskName}</span>
                      <span className="text-[10px] text-gray-400 font-bold block">Phụ trách: {task.Assignee || '—'}</span>
                    </td>
                    <td className="py-2.5 px-4 text-gray-600 font-semibold text-xs">
                      <span className="text-primary font-black">#{task.ProjectId}</span>
                      <span className="block truncate max-w-[120px]">{task.CustomerName}</span>
                    </td>
                    <td className="py-2.5 px-4 text-xs text-gray-500 font-bold">
                      {fmtDate(task.DeadlineDate)}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <TaskStatusBadge status={task.ComputedStatus} />
                    </td>
                  </tr>
                ))}
                {monthlyTasks.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-gray-400 font-medium">Không có công việc chuẩn bị nào trong tháng này</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
