import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSubmission, getApprovalLogs, getSubmissionHistory, approveSubmission, rejectSubmission, cancelSubmission } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';

// ── Status badge helper ───────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    'Đã duyệt':                 { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
    'BOD đã duyệt':             { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
    'PRD đã duyệt':             { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' },
    'Từ chối':                  { bg: 'bg-red-100',   text: 'text-red-700',   dot: 'bg-red-500'   },
    'PRD từ chối':              { bg: 'bg-red-100',   text: 'text-red-700',   dot: 'bg-red-500'   },
    'BOD từ chối':              { bg: 'bg-red-100',   text: 'text-red-700',   dot: 'bg-red-500'   },
    'Chờ phản hồi':            { bg: 'bg-blue-100',  text: 'text-blue-700',  dot: 'bg-blue-500'  },
    'Đã huỷ':                  { bg: 'bg-gray-200',  text: 'text-gray-700',  dot: 'bg-gray-500'  },
    'Đã hủy':                  { bg: 'bg-gray-200',  text: 'text-gray-700',  dot: 'bg-gray-500'  },
    'Hoàn thành':              { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
  };
  const s = map[status] || { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}></span>
      {status}
    </span>
  );
};

// ── Action icon map ──────────────────────────────────────────────
const ACTION_MAP = {
  'Approve': { icon: 'check_circle', color: 'text-green-500', label: 'Đã phê duyệt' },
  'Reject':  { icon: 'cancel',       color: 'text-red-500',   label: 'Đã từ chối'   },
  'Submit':  { icon: 'send',         color: 'text-blue-500',  label: 'Đã trình duyệt'},
  'Update':  { icon: 'edit',         color: 'text-yellow-500',label: 'Đã cập nhật'  },
  'Cancel':  { icon: 'cancel',       color: 'text-gray-500',  label: 'Đã hủy đơn'   },
};

// ── Approval modal ───────────────────────────────────────────────
function ApprovalModal({ mode, projectId, actor, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (mode === 'reject' && !reason.trim()) {
      toast.error('Vui lòng nhập lý do từ chối');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        actorRole:  actor?.role,
        actorMNV:   actor?.mnv,
        actorName:  actor?.fullName,
        actorEmail: actor?.email,
        ...(mode === 'approve' ? { note: reason } : { reason }),
      };
      if (mode === 'approve') {
        await approveSubmission(projectId, payload);
        toast.success('✅ Đã phê duyệt đơn thành công!');
      } else if (mode === 'cancel') {
        await cancelSubmission(projectId, payload);
        toast.success('Đã huỷ đơn thành công.');
      } else {
        await rejectSubmission(projectId, payload);
        toast.success('Đã từ chối đơn.');
      }
      onDone();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 z-10">
        <div className="flex items-center gap-3 mb-4">
          <span className={`material-symbols-outlined text-2xl ${mode === 'approve' ? 'text-green-500' : 'text-red-500'}`}
            style={{ fontVariationSettings: "'FILL' 1" }}>
            {mode === 'approve' ? 'check_circle' : 'cancel'}
          </span>
          <h3 className="font-bold text-lg">
            {mode === 'approve' ? 'Xác nhận Phê Duyệt' : mode === 'cancel' ? 'Huỷ Đơn' : 'Từ Chối Đơn'}
          </h3>
        </div>

        <p className="text-sm text-on-surface-variant mb-4">
          {mode === 'approve'
            ? 'Bạn đang phê duyệt đơn tiếp đón này. Hành động sẽ được ghi lại trong lịch sử.'
            : mode === 'cancel' 
            ? 'Bạn đang yêu cầu huỷ đơn này. Vui lòng nhập lý do huỷ.'
            : 'Vui lòng nhập lý do từ chối để người tạo đơn biết và điều chỉnh lại.'}
        </p>

        <div className="mb-4">
          <label className="block text-sm font-semibold text-on-surface mb-1.5">
            {mode === 'approve' ? 'Ghi chú (không bắt buộc)' : mode === 'cancel' ? 'Lý do huỷ *' : 'Lý do từ chối *'}
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={mode === 'approve' ? 'Ghi chú thêm...' : mode === 'cancel' ? 'Nhập lý do huỷ...' : 'Nhập lý do từ chối...'}
            rows={3}
            className="w-full border border-outline-variant rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-outline-variant rounded-lg py-2.5 text-sm font-semibold hover:bg-surface-container transition-colors">
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className={`flex-1 rounded-lg py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-50 ${
              mode === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {loading ? 'Đang xử lý...' : (mode === 'approve' ? '✅ Phê Duyệt' : mode === 'cancel' ? 'Huỷ Đơn' : '❌ Từ Chối')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Drawer ──────────────────────────────────────────────────
export default function SubmissionDrawer({ projectId, onClose, currentUser }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');
  const [activeTaskDate, setActiveTaskDate] = useState(null);
  const [modalMode, setModalMode] = useState(null); // 'approve' | 'reject' | 'cancel' | null

  const [history, setHistory] = useState([]);
  const [prevProjectId, setPrevProjectId] = useState(projectId);
  const [viewedProjectId, setViewedProjectId] = useState(projectId);

  // Quan trọng: Reset lại viewedProjectId ngay trong render khi projectId thay đổi
  if (projectId !== prevProjectId) {
    setPrevProjectId(projectId);
    setViewedProjectId(projectId);
  }

  const loadData = useCallback(() => {
    if (!viewedProjectId) return;
    setLoading(true);
    Promise.all([
      getSubmission(viewedProjectId),
      getApprovalLogs(viewedProjectId),
      getSubmissionHistory(projectId), // Lấy history của projectId gốc
    ])
      .then(([subRes, logRes, histRes]) => {
        setData(subRes.data);
        setLogs(logRes.data || []);
        setHistory(histRes.data || []);
      })
      .catch((err) => {
        toast.error('Không thể tải thông tin đơn: ' + err.message);
        // Nếu lỗi khi load viewedProjectId, thử quay lại projectId gốc
        if (viewedProjectId !== projectId) {
          setViewedProjectId(projectId);
        } else {
          onClose();
        }
      })
      .finally(() => setLoading(false));
  }, [projectId, viewedProjectId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Update activeTaskDate when tasks load
  useEffect(() => {
    if (data?.tasks?.length > 0) {
      const dates = [...new Set(data.tasks.map(t => t.OnboardDate))].sort();
      if (!activeTaskDate || !dates.includes(activeTaskDate)) {
        setActiveTaskDate(dates[0]);
      }
    } else {
      setActiveTaskDate(null);
    }
  }, [data?.tasks]);

  if (!projectId) return null;

  const project = data?.project;
  const tasks = data?.tasks || [];

  let guestReps = [];
  try { if (project?.GuestReps) guestReps = JSON.parse(project.GuestReps); } catch(e) {}
  let agendaJson = [];
  try { if (project?.AgendaJsonData) agendaJson = JSON.parse(project.AgendaJsonData); } catch(e) {}

  const role = currentUser?.role;
  const status = project?.Status;

  const isViewedCurrent = String(viewedProjectId).toLowerCase() === String(projectId).toLowerCase();
  const canApprove = !!data?.permissions?.canApprove;
  const canEdit = isViewedCurrent && !!data?.permissions?.canEdit;
  const canCancel = isViewedCurrent && !!data?.permissions?.canCancel;


  // Tính toán Ngày tiếp đón & Địa điểm
  let uniqueDates = '—';
  let uniqueDestinations = '—';

  if (tasks?.length) {
    uniqueDates = [...new Set(tasks.map(t => new Date(t.OnboardDate).toLocaleDateString('vi-VN')))].join(', ');
    uniqueDestinations = [...new Set(tasks.map(t => t.Destination))].filter(Boolean).join(', ');
  } else if (agendaJson?.length) {
    const dateStrings = agendaJson.map(day => {
      if (!day.date) return null;
      return new Date(day.date).toLocaleDateString('vi-VN');
    }).filter(Boolean);
    uniqueDates = [...new Set(dateStrings)].join(', ') || '—';

    const dests = agendaJson.flatMap(day => Object.keys(day.agenda || {}));
    uniqueDestinations = [...new Set(dests)].filter(Boolean).join(', ') || '—';
  }

  const TAB = (key, label) => (
    <button
      className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
        activeTab === key
          ? 'border-primary text-primary'
          : 'border-transparent text-on-surface-variant hover:text-primary'
      }`}
      onClick={() => setActiveTab(key)}
    >{label}</button>
  );

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40 z-[60] backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-full sm:w-[540px] bg-white z-[70] shadow-2xl flex flex-col">

        {/* Header */}
        <div className="p-5 border-b border-outline-variant flex justify-between items-start">
          <div>
            {String(viewedProjectId).toLowerCase() !== String(projectId).toLowerCase() && (
              <div className="mb-2 inline-flex items-center gap-2 bg-yellow-100 text-yellow-800 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm">
                <span className="material-symbols-outlined text-[16px]">history</span>
                Bạn đang xem phiên bản cũ
                <button 
                  onClick={() => setViewedProjectId(projectId)} 
                  className="ml-2 underline hover:text-yellow-900 transition-colors"
                >
                  Quay lại bản hiện tại
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-primary font-bold text-sm">Chi tiết đơn tiếp đón</span>
              <span className="text-on-surface-variant opacity-40">|</span>
              <code className="text-xs bg-surface-container px-2 py-0.5 rounded">{viewedProjectId}</code>
              {project?.Status && <StatusBadge status={project.Status} />}
            </div>
            <h3 className="font-bold text-lg leading-tight">
              {project?.CustomerName || 'Đang tải...'}
            </h3>
          </div>
          <button className="material-symbols-outlined p-1.5 hover:bg-surface-container rounded-full text-outline" onClick={onClose}>close</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-outline-variant bg-surface px-2 overflow-x-auto">
          {TAB('info', 'Thông tin')}
          {TAB('visitors', `Khách (${guestReps.length})`)}
          {TAB('agenda', 'Lịch trình')}
          {TAB('tasks', `Công việc (${tasks.length})`)}
          {TAB('attachments', 'Đính kèm')}
          {TAB('approval', `Phê duyệt (${logs.length})`)}
          {TAB('history', `Lịch sử (${history.length})`)}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex justify-center items-center h-full gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin">refresh</span> Đang tải...
            </div>
          ) : (
            <>
              {/* ── Tab: Thông tin ── */}
              {activeTab === 'info' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      ['Tên khách hàng', project?.CustomerName],
                      ['Ngày tiếp đón',  uniqueDates],
                      ['Người trình duyệt', project?.SubmitterName],
                      ['Địa điểm', uniqueDestinations],
                    ].map(([label, val]) => (
                      <div key={label}>
                        <p className="text-xs text-on-surface-variant font-semibold mb-0.5">{label}</p>
                        <p className="text-sm font-semibold">{val || '—'}</p>
                      </div>
                    ))}
                    <div className="col-span-2">
                      <p className="text-xs text-on-surface-variant font-semibold mb-0.5">Chủ đề làm việc</p>
                      <p className="text-sm font-semibold">{project?.MeetingTopic || '—'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-on-surface-variant font-semibold mb-0.5">Người tham dự (VSN)</p>
                      <p className="text-sm">{project?.Attendees || '—'}</p>
                    </div>
                  </div>
                  {project?.AgendaInfo && (
                    <div className="p-4 bg-surface-container rounded-xl">
                      <p className="text-xs text-on-surface-variant font-semibold mb-1">Ghi chú & Thông tin bổ sung</p>
                      <p className="text-sm italic text-on-surface">"{project.AgendaInfo}"</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Tab: Khách hàng ── */}
              {activeTab === 'visitors' && (
                <div>
                  <h4 className="font-semibold text-sm mb-3">Danh sách đoàn khách ({guestReps.length})</h4>
                  {guestReps.length === 0 ? (
                    <p className="text-sm text-on-surface-variant text-center py-8">Chưa có thông tin khách</p>
                  ) : (
                    <div className="border border-outline-variant rounded-xl overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-surface-container-low">
                          <tr>
                            <th className="px-4 py-2.5 font-semibold text-xs text-on-surface-variant">#</th>
                            <th className="px-4 py-2.5 font-semibold text-xs text-on-surface-variant">Họ và tên</th>
                            <th className="px-4 py-2.5 font-semibold text-xs text-on-surface-variant">Email</th>
                            <th className="px-4 py-2.5 font-semibold text-xs text-on-surface-variant">Chức vụ</th>
                            <th className="px-4 py-2.5 font-semibold text-xs text-on-surface-variant">Ghi chú ăn</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant">
                          {guestReps.map((g, i) => (
                            <tr key={i} className="hover:bg-surface-container-lowest">
                              <td className="px-4 py-3 text-on-surface-variant">{i+1}</td>
                              <td className="px-4 py-3 font-semibold">{g.salutation} {g.name}</td>
                              <td className="px-4 py-3 text-on-surface-variant">{g.email || '—'}</td>
                              <td className="px-4 py-3 text-on-surface-variant">{g.title || '—'}</td>
                              <td className="px-4 py-3 text-on-surface-variant">{g.mealNote || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── Tab: Lịch trình ── */}
              {activeTab === 'agenda' && (
                <div>
                  {agendaJson.length === 0 ? (
                    <p className="text-sm text-on-surface-variant text-center py-8">Chưa có dữ liệu lịch trình</p>
                  ) : agendaJson.map((day, idx) => (
                    <div key={idx} className="mb-6">
                      <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-bold mb-3">
                        <span className="material-symbols-outlined text-sm">calendar_today</span>
                        Ngày {new Date(day.date).toLocaleDateString('vi-VN')}
                      </div>
                      <div className="relative ml-3 space-y-4 before:content-[''] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:bg-outline-variant">
                        {Object.keys(day.agenda || {}).flatMap(dest =>
                          (day.agenda[dest] || [])
                            .sort((a, b) => a.timeStart?.localeCompare(b.timeStart))
                            .map((item, itemIdx) => (
                              <div key={itemIdx} className="relative pl-6">
                                <div className="absolute left-[-4px] top-1.5 w-2.5 h-2.5 rounded-full bg-primary"></div>
                                <p className="text-xs font-bold text-on-surface-variant">{item.timeStart} – {item.timeEnd}</p>
                                <p className="text-sm font-semibold text-on-surface">📍 {dest} · {item.contentType}</p>
                                {item.detail && <p className="text-xs text-on-surface-variant mt-0.5">{item.detail}</p>}
                              </div>
                            ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Tab: Công việc ── */}
              {activeTab === 'tasks' && (
                <div>
                  {tasks.length === 0 ? (
                    <p className="text-sm text-on-surface-variant text-center py-8">Không có công việc</p>
                  ) : (
                    <div>
                      {/* Tabs theo ngày */}
                      <div className="flex gap-2 overflow-x-auto mb-4 pb-2 border-b border-outline-variant">
                        {[...new Set(tasks.map(t => t.OnboardDate))].sort().map(date => (
                          <button
                            key={date}
                            onClick={() => setActiveTaskDate(date)}
                            className={`px-3 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                              activeTaskDate === date
                                ? 'bg-primary text-white'
                                : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
                            }`}
                          >
                            Ngày {new Date(date).toLocaleDateString('vi-VN')}
                          </button>
                        ))}
                      </div>

                      {/* Các task của ngày đang chọn, nhóm theo địa điểm */}
                      {(() => {
                        const dayTasks = tasks.filter(t => t.OnboardDate === activeTaskDate);
                        const groupedByDest = dayTasks.reduce((acc, t) => {
                          const dest = t.Destination || 'Khác';
                          if (!acc[dest]) acc[dest] = [];
                          acc[dest].push(t);
                          return acc;
                        }, {});

                        return Object.entries(groupedByDest).map(([dest, destTasks]) => (
                          <div key={dest} className="mb-6 last:mb-0">
                            <h5 className="font-bold text-sm text-primary mb-3 flex items-center gap-2">
                              <span className="material-symbols-outlined text-sm">location_on</span>
                              {dest} ({destTasks.length})
                            </h5>
                            <div className="space-y-2">
                              {destTasks.map((t, i) => (
                                <div key={i} className="border border-outline-variant rounded-xl p-4 hover:bg-surface-container-lowest transition-colors ml-4">
                                  <div className="flex justify-between items-start gap-2 mb-1">
                                    <p className="font-semibold text-sm">{t.TaskName}</p>
                                  </div>
                                  <div className="flex gap-4 text-xs text-on-surface-variant mt-2">
                                    <span>👤 {t.Assignee || '—'}</span>
                                    {t.DeadlineDate && <span>📅 HĐ: {new Date(t.DeadlineDate).toLocaleDateString('vi-VN')}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* ── Tab: Đính kèm ── */}
              {activeTab === 'attachments' && (
                <div>
                  {project?.AgendaAttachUrl ? (
                    <a
                      href={project.AgendaAttachUrl.startsWith('/api/') 
                        ? (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : '') + project.AgendaAttachUrl 
                        : project.AgendaAttachUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-4 p-4 border border-outline-variant rounded-xl hover:bg-surface-container-lowest transition-colors group"
                    >
                      <span className="material-symbols-outlined text-primary text-3xl">description</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">Tệp đính kèm</p>
                        <p className="text-xs text-on-surface-variant">Bấm để tải xuống</p>
                      </div>
                      <span className="material-symbols-outlined text-outline group-hover:text-primary">download</span>
                    </a>
                  ) : (
                    <p className="text-sm text-on-surface-variant text-center py-8">Không có tệp đính kèm</p>
                  )}
                </div>
              )}

              {/* ── Tab: Phê duyệt (Audit Trail) ── */}
              {activeTab === 'approval' && (
                <div>
                  {/* Current Status */}
                  <div className="p-4 bg-surface-container rounded-xl mb-5 flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary">info</span>
                    <div>
                      <p className="text-xs text-on-surface-variant">Trạng thái hiện tại</p>
                      <StatusBadge status={project?.Status} />
                      {(project?.Status === 'Đã hủy' || project?.Status === 'Đã huỷ') && project?.CancelReason && (
                        <p className="text-xs text-red-600 mt-2 font-medium">Lý do hủy: {project.CancelReason}</p>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons (Admin only, not yet approved/rejected) */}
                  {canApprove && (
                    <div className="flex gap-3 mb-6">
                      <button
                        onClick={() => setModalMode('approve')}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                        Phê Duyệt
                      </button>
                      <button
                        onClick={() => setModalMode('reject')}
                        className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>cancel</span>
                        Từ Chối
                      </button>
                    </div>
                  )}

                  {/* Approval Timeline */}
                  <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">Lịch sử phê duyệt</h4>
                  {logs.length === 0 ? (
                    <p className="text-sm text-on-surface-variant text-center py-6">Chưa có lịch sử phê duyệt</p>
                  ) : (
                    <div className="relative space-y-4 before:content-[''] before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-outline-variant">
                      {logs.map((log, i) => {
                        const a = ACTION_MAP[log.Action] || ACTION_MAP['Submit'];
                        return (
                          <div key={log.Id || i} className="relative flex gap-4 pl-10">
                            <span
                              className={`material-symbols-outlined absolute left-0.5 top-0.5 text-xl ${a.color}`}
                              style={{ fontVariationSettings: "'FILL' 1" }}
                            >{a.icon}</span>
                            <div className="flex-1 pb-2">
                              <div className="flex items-start justify-between gap-2">
                                <p className="font-semibold text-sm">{a.label}</p>
                                <span className="text-xs text-on-surface-variant whitespace-nowrap">
                                  {formatDate(log.CreatedAt, 'HH:mm dd/MM/yyyy')}
                                </span>
                              </div>
                              <p className="text-xs text-on-surface-variant">
                                bởi <span className="font-medium">{log.ActorName || log.ActorMNV || 'Hệ thống'}</span>
                              </p>
                              {log.Reason && (
                                <div className="mt-1.5 bg-surface-container-low rounded-lg px-3 py-2 text-xs text-on-surface-variant italic">
                                  "{log.Reason}"
                                </div>
                              )}
                              {(log.OldStatus || log.NewStatus) && (
                                <div className="flex items-center gap-1.5 mt-1.5 text-xs">
                                  {log.OldStatus && <StatusBadge status={log.OldStatus} />}
                                  <span className="material-symbols-outlined text-sm text-on-surface-variant">arrow_forward</span>
                                  {log.NewStatus && <StatusBadge status={log.NewStatus} />}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── Tab: Lịch sử ── */}
              {activeTab === 'history' && (
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-primary mb-3">Lịch sử các phiên bản</h4>
                  {history.length === 0 ? (
                    <p className="text-sm text-on-surface-variant">Không có lịch sử.</p>
                  ) : (
                    <div className="space-y-3">
                      {history.map((h, i) => {
                        const isViewed = String(h.Project_id).toLowerCase() === String(viewedProjectId).toLowerCase();
                        const isCurrent = String(h.Project_id).toLowerCase() === String(projectId).toLowerCase();

                        return (
                        <div key={h.Project_id} className={`p-4 rounded-xl border transition-colors ${isViewed ? 'border-primary bg-primary/5' : 'border-outline-variant bg-surface-container-lowest hover:border-primary/30'}`}>
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-on-surface">{h.Project_id}</span>
                                {isCurrent && <span className="bg-primary text-white text-[10px] px-1.5 py-0.5 rounded font-bold">Hiện tại</span>}
                                {isViewed && !isCurrent && <span className="bg-yellow-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">Đang xem</span>}
                              </div>
                              <p className="text-xs text-on-surface-variant mt-1">Phiên bản {h.Version}</p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <StatusBadge status={h.Status} />
                              {!isViewed && (
                                <button 
                                  onClick={() => {
                                    setViewedProjectId(h.Project_id);
                                    setActiveTab('tasks');
                                  }}
                                  className="text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                                >
                                  <span className="material-symbols-outlined text-[14px]">visibility</span>
                                  Xem chi tiết
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="text-sm text-on-surface-variant space-y-1">
                            <p><strong>Ngày tạo:</strong> {formatDate(h.CreatedAt, 'HH:mm dd/MM/yyyy')}</p>
                            <p><strong>Người tạo:</strong> {h.SubmitterName}</p>
                            <p><strong>Loại:</strong> {h.RecordType === 1 ? 'Tạo mới' : h.RecordType === 2 ? 'Chỉnh sửa' : 'Huỷ đơn'}</p>
                          </div>
                        </div>
                      )})}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-outline-variant bg-surface flex gap-3">
          {canEdit && (
            <button
              onClick={() => navigate(`/edit/${projectId}`)}
              className="flex-1 border border-primary text-primary hover:bg-primary/10 py-2.5 rounded-xl font-bold text-sm transition-colors"
            >
              ✏️ Chỉnh Sửa
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => setModalMode('cancel')}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl font-bold text-sm transition-colors"
            >
              🗑️ Huỷ Đơn
            </button>
          )}

          {canApprove ? (
            <>
              <button
                onClick={() => setModalMode('approve')}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-bold text-sm transition-colors"
              >
                ✅ Phê Duyệt
              </button>
              <button
                onClick={() => setModalMode('reject')}
                className="flex-1 border border-red-200 text-red-700 hover:bg-red-50 py-2.5 rounded-xl font-bold text-sm transition-colors"
              >
                ❌ Từ Chối
              </button>
            </>
          ) : (!canEdit && !canCancel) && (
            <button onClick={onClose} className="flex-1 border border-outline-variant text-on-surface py-2.5 rounded-xl font-semibold text-sm hover:bg-surface-container-high transition-colors">
              Đóng
            </button>
          )}

        </div>
      </div>

      {/* Approval Modal */}
      {modalMode && (
        <ApprovalModal
          mode={modalMode}
          projectId={projectId}
          actor={currentUser}
          onClose={() => setModalMode(null)}
          onDone={loadData}
        />
      )}
    </>
  );
}
