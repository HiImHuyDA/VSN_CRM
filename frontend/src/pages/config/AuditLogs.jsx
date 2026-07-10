import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { ComboboxMultiple } from '../../components/ui/combobox';
import { DateRangePicker } from '../../components/ui/date-range-picker';
import { formatDate } from '../../utils/helpers';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  // Slicer States
  const [filterMnv, setFilterMnv] = useState([]);
  const [filterDept, setFilterDept] = useState([]);
  const [filterRole, setFilterRole] = useState([]);
  const [filterAction, setFilterAction] = useState([]);
  const [filterDate, setFilterDate] = useState();

  const actions = [
    'Đăng nhập',
    'Đổi mật khẩu',
    'Tạo mới đơn',
    'Chỉnh sửa đơn',
    'Huỷ đơn',
    'Phê duyệt đơn',
    'Từ chối đơn'
  ];

  const roles = ['Admin', 'BOD', 'PRD', 'User'];

  const mnvOptions = useMemo(() => [...new Set(logs.map(l => l.MNV))], [logs]);
  const deptOptions = useMemo(() => [...new Set(logs.map(l => l.Department || ''))].filter(Boolean), [logs]);

  const fetchLogs = async () => {
    setLoading(true);

    try {
      const response = await api.get("/audit-logs");

      if (response.success) {
        setLogs(response.data || []);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchMnv = filterMnv.length === 0 || filterMnv.includes(log.MNV);
      const matchDept = filterDept.length === 0 || filterDept.includes(log.Department || '');
      const matchRole = filterRole.length === 0 || filterRole.includes(log.Role || '');
      const matchAction = filterAction.length === 0 || filterAction.includes(log.Action);

      let matchDate = true;
      if (filterDate?.from) {
        const d = new Date(log.CreatedAt);
        if (d < filterDate.from || (filterDate.to && d > filterDate.to)) {
          matchDate = false;
        }
      }

      return matchMnv && matchDept && matchRole && matchAction && matchDate;
    });
  }, [logs, filterMnv, filterDept, filterRole, filterAction, filterDate]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Lịch sử hệ thống</h1>

      <div className="bg-surface rounded-xl p-4 shadow-sm border border-outline-variant mb-6">
        <h2 className="text-sm font-semibold mb-3">Bộ lọc</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium mb-1">Mã NV</label>
            <ComboboxMultiple options={mnvOptions} selected={filterMnv} onChange={setFilterMnv} placeholder="Tất cả Mã NV" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Phòng ban</label>
            <ComboboxMultiple options={deptOptions} selected={filterDept} onChange={setFilterDept} placeholder="Tất cả Phòng ban" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Phân quyền</label>
            <ComboboxMultiple options={roles} selected={filterRole} onChange={setFilterRole} placeholder="Tất cả Quyền" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Loại Log</label>
            <ComboboxMultiple options={actions} selected={filterAction} onChange={setFilterAction} placeholder="Tất cả Loại" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Thời gian</label>
            <DateRangePicker date={filterDate} setDate={setFilterDate} />
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-xl shadow-sm border border-outline-variant overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant text-sm text-on-surface-variant">
                <th className="px-4 py-3 font-semibold">Thời gian</th>
                <th className="px-4 py-3 font-semibold">MNV</th>
                <th className="px-4 py-3 font-semibold">Phòng ban</th>
                <th className="px-4 py-3 font-semibold">Phân quyền</th>
                <th className="px-4 py-3 font-semibold">Hành động</th>
                <th className="px-4 py-3 font-semibold">Mã Đơn</th>
                <th className="px-4 py-3 font-semibold w-1/3">Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="text-center py-4">Đang tải dữ liệu...</td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan="7" className="text-center py-4 text-on-surface-variant">Không có lịch sử nào phù hợp</td></tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.Id} className="border-b border-outline-variant hover:bg-surface-container-lowest text-sm">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(log.CreatedAt, 'HH:mm dd/MM/yyyy')}</td>
                    <td className="px-4 py-3 font-medium">{log.MNV}</td>
                    <td className="px-4 py-3">{log.Department || '-'}</td>
                    <td className="px-4 py-3">
                      {log.Role ? (
                        <span className={`px-2 py-1 rounded text-xs font-bold ${log.Role === 'Admin' ? 'bg-red-100 text-red-700' :
                          log.Role === 'BOD' ? 'bg-orange-100 text-orange-700' :
                            log.Role === 'PRD' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                          }`}>{log.Role}</span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 font-medium text-primary">{log.Action}</td>
                    <td className="px-4 py-3">{log.SubmissionId || '-'}</td>
                    <td className="px-4 py-3 text-on-surface-variant break-words">{log.Details || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
