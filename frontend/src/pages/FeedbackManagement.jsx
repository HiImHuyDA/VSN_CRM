import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { utils, write } from 'xlsx';
import {
  getFeedbackInvitations,
  resendFeedbackInvitation,
  cancelFeedbackInvitation,
  getFeedbackResponses,
  triggerFeedbackCronManually,
  triggerFeedbackSyncManually
} from '../services/api';

export default function FeedbackManagement() {
  const [activeTab, setActiveTab] = useState('invitations');
  const [invitations, setInvitations] = useState([]);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRating, setFilterRating] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterHost, setFilterHost] = useState('');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');

  useEffect(() => {
    fetchData();
  }, [activeTab, filterStatus, filterRating, filterCustomer, filterHost, filterDateStart, filterDateEnd]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {
        customerName: filterCustomer,
        host: filterHost,
        dateStart: filterDateStart,
        dateEnd: filterDateEnd
      };

      if (activeTab === 'invitations') {
        params.status = filterStatus;
        const res = await getFeedbackInvitations(params);
        if (res.success) setInvitations(res.data);
      } else {
        params.rating = filterRating;
        const res = await getFeedbackResponses(params);
        if (res.success) setResponses(res.data);
      }
    } catch (err) {
      toast.error('Lỗi khi tải dữ liệu: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn gửi lại thư mời này? Mã token sẽ được làm mới và hạn sử dụng gia hạn thêm 7 ngày.')) return;
    try {
      const res = await resendFeedbackInvitation(id);
      if (res.success) {
        toast.success(res.message);
        fetchData();
      } else {
        toast.error(res.error || 'Lỗi gửi lại thư mời');
      }
    } catch (err) {
      toast.error('Lỗi kết nối: ' + err.message);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy thư mời này? Khách hàng sẽ không thể truy cập liên kết đánh giá nữa.')) return;
    try {
      const res = await cancelFeedbackInvitation(id);
      if (res.success) {
        toast.success(res.message);
        fetchData();
      } else {
        toast.error(res.error || 'Lỗi hủy thư mời');
      }
    } catch (err) {
      toast.error('Lỗi kết nối: ' + err.message);
    }
  };

  const handleTriggerCron = async () => {
    setTriggering(true);
    try {
      const res = await triggerFeedbackCronManually();
      if (res.success) {
        toast.success(res.message || 'Đã kích hoạt quét gửi thư mời đánh giá thành công!');
        fetchData();
      } else {
        toast.error(res.error || 'Lỗi quét thư mời');
      }
    } catch (err) {
      toast.error('Lỗi kết nối: ' + err.message);
    } finally {
      setTriggering(false);
    }
  };

  const handleTriggerSync = async () => {
    setSyncing(true);
    try {
      const res = await triggerFeedbackSyncManually();
      if (res.success) {
        toast.success(res.message || 'Đã quét và đồng bộ kết quả đánh giá thành công!');
        fetchData();
      } else {
        toast.error(res.error || 'Lỗi quét kết quả đánh giá');
      }
    } catch (err) {
      toast.error('Lỗi kết nối: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const getGuestEmailAndName = (guestRepsStr, visitorId) => {
    try {
      if (!guestRepsStr) return { name: 'Khách', email: '—' };
      const reps = JSON.parse(guestRepsStr);
      const rep = reps[visitorId];
      if (rep) {
        return { name: rep.name || 'Khách', email: rep.email || '—' };
      }
    } catch (e) { }
    return { name: 'Khách', email: '—' };
  };

  const exportExcel = () => {
    const dataToExport = activeTab === 'invitations' ? invitations : responses;
    if (dataToExport.length === 0) {
      toast.error('Không có dữ liệu để xuất Excel');
      return;
    }

    let rows = [];
    if (activeTab === 'invitations') {
      rows = dataToExport.map((x, i) => {
        const guest = getGuestEmailAndName(x.GuestReps, x.VisitorId);
        return {
          'STT': i + 1,
          'Mã đơn': x.ProjectId,
          'Khách hàng (Công ty)': x.CustomerName,
          'Đại diện nhận': guest.name,
          'Email nhận': guest.email,
          'Chủ đề': x.MeetingTopic,
          'Ngày tạo': new Date(x.CreatedDate).toLocaleDateString('vi-VN'),
          'Hạn dùng': new Date(x.ExpireDate).toLocaleDateString('vi-VN'),
          'Ngày nộp': x.UsedDate ? new Date(x.UsedDate).toLocaleDateString('vi-VN') : '—',
          'Trạng thái': x.Status
        };
      });
    } else {
      rows = dataToExport.map((x, i) => {
        const guest = getGuestEmailAndName(x.GuestReps, x.VisitorId);
        return {
          'STT': i + 1,
          'Mã đơn': x.ProjectId,
          'Khách hàng (Công ty)': x.CustomerName,
          'Đại diện đánh giá': guest.name,
          'Điểm Overall': x.OverallRating,
          'Ý kiến đóng góp': x.Comments || '—',
          'Ngày nộp': new Date(x.SubmittedAt).toLocaleDateString('vi-VN'),
          'Người tạo đơn': x.SubmitterName
        };
      });
    }

    const ws = utils.json_to_sheet(rows);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, activeTab === 'invitations' ? 'ThuMoiKhaoSat' : 'KetQuaDanhGia');

    // Xuất file
    const excelBuffer = write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CSR_Feedback_Report_${activeTab}_${new Date().toISOString().split('T')[0]}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Xuất báo cáo Excel thành công!');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-on-surface mb-1">Quản lý Phản Hồi Khách Hàng</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleTriggerCron}
            disabled={triggering}
            className="btn btn-outline btn-sm flex items-center gap-1.5 hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-sm">send</span>
            {triggering ? 'Đang quét...' : 'Quét & gửi thư mời'}
          </button>
          <button
            onClick={handleTriggerSync}
            disabled={syncing}
            className="btn btn-outline btn-sm flex items-center gap-1.5 hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-sm">sync</span>
            {syncing ? 'Đang đồng bộ...' : 'Quét kết quả đánh giá'}
          </button>
          <button
            onClick={exportExcel}
            className="btn btn-primary btn-sm flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Xuất Excel
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-outline-variant">
        <button
          onClick={() => { setActiveTab('invitations'); }}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'invitations' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-primary'
            }`}
        >
          Thư Mời Khảo Sát
        </button>
        <button
          onClick={() => { setActiveTab('responses'); }}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'responses' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-primary'
            }`}
        >
          Kết Quả Đánh Giá
        </button>
      </div>

      {/* Filters Form */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 bg-surface-container-low p-4 rounded-2xl border border-outline-variant">
        <div className="form-group">
          <label className="text-xs font-bold text-on-surface-variant">Khách hàng</label>
          <input
            type="text"
            value={filterCustomer}
            onChange={e => setFilterCustomer(e.target.value)}
            placeholder="Tìm công ty..."
            className="w-full text-xs"
          />
        </div>
        <div className="form-group">
          <label className="text-xs font-bold text-on-surface-variant">Người tạo (Host)</label>
          <input
            type="text"
            value={filterHost}
            onChange={e => setFilterHost(e.target.value)}
            placeholder="Tên hoặc email..."
            className="w-full text-xs"
          />
        </div>
        <div className="form-group">
          <label className="text-xs font-bold text-on-surface-variant">Từ ngày (Tạo/Gửi)</label>
          <input
            type="date"
            value={filterDateStart}
            onChange={e => setFilterDateStart(e.target.value)}
            className="w-full text-xs"
          />
        </div>
        <div className="form-group">
          <label className="text-xs font-bold text-on-surface-variant">Đến ngày (Tạo/Gửi)</label>
          <input
            type="date"
            value={filterDateEnd}
            onChange={e => setFilterDateEnd(e.target.value)}
            className="w-full text-xs"
          />
        </div>
        {activeTab === 'invitations' ? (
          <div className="form-group">
            <label className="text-xs font-bold text-on-surface-variant">Trạng thái</label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full text-xs"
            >
              <option value="">Tất cả</option>
              <option value="Pending">Chờ đánh giá (Pending)</option>
              <option value="Completed">Đã hoàn thành (Completed)</option>
              <option value="Expired">Hết hạn (Expired)</option>
              <option value="Cancelled">Đã hủy (Cancelled)</option>
            </select>
          </div>
        ) : (
          <div className="form-group">
            <label className="text-xs font-bold text-on-surface-variant">Điểm đánh giá</label>
            <select
              value={filterRating}
              onChange={e => setFilterRating(e.target.value)}
              className="w-full text-xs"
            >
              <option value="">Tất cả</option>
              <option value="5">⭐⭐⭐⭐⭐ 5 Sao</option>
              <option value="4">⭐⭐⭐⭐ 4 Sao</option>
              <option value="3">⭐⭐⭐ 3 Sao</option>
              <option value="2">⭐⭐ 2 Sao</option>
              <option value="1">⭐ 1 Sao</option>
            </select>
          </div>
        )}
        <div className="flex items-end">
          <button
            onClick={() => {
              setFilterCustomer('');
              setFilterHost('');
              setFilterDateStart('');
              setFilterDateEnd('');
              setFilterStatus('');
              setFilterRating('');
            }}
            className="btn btn-outline btn-sm w-full text-xs hover:bg-surface-container"
          >
            Mặc định
          </button>
        </div>
      </div>

      {/* Main Content View */}
      <div className="bg-surface border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-on-surface-variant text-sm font-semibold">Đang tải dữ liệu...</div>
        ) : activeTab === 'invitations' ? (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Khách hàng</th>
                  <th>Người nhận email</th>
                  <th>Hạn dùng</th>
                  <th>Trạng thái</th>
                  <th style={{ width: 140 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map(x => {
                  const guest = getGuestEmailAndName(x.GuestReps, x.VisitorId);
                  return (
                    <tr key={x.Id}>
                      <td className="font-bold text-primary">{x.ProjectId}</td>
                      <td>
                        <div>
                          <p className="font-semibold text-sm">{x.CustomerName}</p>
                          <p className="text-[11px] text-on-surface-variant italic">{x.MeetingTopic}</p>
                        </div>
                      </td>
                      <td>
                        <div>
                          <p className="font-semibold text-sm">{guest.name}</p>
                          <p className="text-[11px] text-on-surface-variant">{guest.email}</p>
                        </div>
                      </td>
                      <td className="text-xs text-on-surface-variant">
                        {new Date(x.ExpireDate).toLocaleDateString('vi-VN')}
                      </td>
                      <td>
                        <span className={`badge ${x.Status === 'Completed' ? 'badge-success' :
                            x.Status === 'Pending' ? 'badge-info' :
                              x.Status === 'Expired' ? 'badge-danger' : 'badge-warning'
                          }`}>
                          {x.Status === 'Completed' ? 'Đã hoàn thành' :
                            x.Status === 'Pending' ? 'Đang chờ' :
                              x.Status === 'Expired' ? 'Hết hạn' : 'Đã hủy'}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          {x.Status === 'Pending' || x.Status === 'Expired' ? (
                            <>
                              <button
                                onClick={() => handleResend(x.Id)}
                                className="btn btn-outline btn-xs hover:bg-surface-container"
                                title="Gia hạn & Gửi lại mail"
                              >
                                Gửi lại
                              </button>
                              <button
                                onClick={() => handleCancel(x.Id)}
                                className="btn btn-outline btn-xs btn-danger hover:bg-red-50"
                                title="Hủy liên kết đánh giá"
                              >
                                Hủy
                              </button>
                            </>
                          ) : '—'}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {invitations.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-on-surface-variant italic">
                      Không có thư mời khảo sát nào được tìm thấy.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Khách hàng</th>
                  <th>Người đánh giá</th>
                  <th>Điểm Overall</th>
                  <th>Ý kiến bình luận</th>
                  <th>Ngày nộp</th>
                </tr>
              </thead>
              <tbody>
                {responses.map(x => {
                  const guest = getGuestEmailAndName(x.GuestReps, x.VisitorId);
                  return (
                    <tr key={x.Id}>
                      <td className="font-bold text-primary">{x.ProjectId}</td>
                      <td>
                        <div>
                          <p className="font-semibold text-sm">{x.CustomerName}</p>
                          <p className="text-[11px] text-on-surface-variant">Host: {x.SubmitterName}</p>
                        </div>
                      </td>
                      <td>{guest.name}</td>
                      <td>
                        <span className="text-amber-500 font-bold text-sm">
                          {'★'.repeat(x.OverallRating)}{'☆'.repeat(5 - x.OverallRating)}
                        </span>
                      </td>
                      <td>
                        <p className="text-xs max-w-xs truncate italic" title={x.Comments}>
                          {x.Comments ? `"${x.Comments}"` : '—'}
                        </p>
                      </td>
                      <td className="text-xs text-on-surface-variant">
                        {new Date(x.SubmittedAt).toLocaleDateString('vi-VN')}
                      </td>
                    </tr>
                  );
                })}
                {responses.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-on-surface-variant italic">
                      Chưa có kết quả đánh giá nào được gửi lên.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
