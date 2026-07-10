// src/pages/TaskManagement.jsx — Quản lý công việc tiếp đón (Kanban board & Table)
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { ComboboxMultiple } from '../components/ui/combobox';

const fmtDate = (str) => {
  if (!str) return '—';
  const parts = str.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return str;
};

export default function TaskManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('kanban'); // kanban | table
  
  // Filters
  const [filters, setFilters] = useState({
    departments: [],
    assignees: [],
    projectIds: [],
    customerNames: [],
    onboardDates: [],
    destinations: []
  });
  const [showFilters, setShowFilters] = useState(true);
  
  // Options
  const [departments, setDepartments] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [projectIds, setProjectIds] = useState([]);
  const [customerNames, setCustomerNames] = useState([]);
  const [onboardDates, setOnboardDates] = useState([]);
  const [destinations, setDestinations] = useState([]);

  // Active Task Detail Modal
  const [selectedTask, setSelectedTask] = useState(null);
  const [notes, setNotes] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [submittingNote, setSubmittingNote] = useState(false);

  // User Session Info
  const currentUser = JSON.parse(localStorage.getItem('csr_user') || '{}');
  const userMNV = currentUser.mnv || currentUser.MNV || '';
  const userRole = currentUser.role || currentUser.Role || '';
  const userName = currentUser.fullName || currentUser.FullName || '';

  const loadTasks = () => {
    setLoading(true);
    const params = {
      role: userRole,
      mnv: userMNV
    };
    if (filters.departments.length > 0) params.department = filters.departments.join(',');
    if (filters.assignees.length > 0) params.assignee = filters.assignees.join(',');
    if (filters.projectIds.length > 0) params.projectId = filters.projectIds.join(',');
    if (filters.customerNames.length > 0) params.customerName = filters.customerNames.join(',');
    if (filters.onboardDates.length > 0) params.onboardDate = filters.onboardDates.join(',');
    if (filters.destinations.length > 0) params.destination = filters.destinations.join(',');

    api.get('/task-management', { params })
      .then(res => {
        if (res.success) {
          const list = res.data || [];
          setTasks(list);

          // Extract filter options dynamically on the first load when no filters are active
          const noFiltersActive = 
            filters.departments.length === 0 &&
            filters.assignees.length === 0 &&
            filters.projectIds.length === 0 &&
            filters.customerNames.length === 0 &&
            filters.onboardDates.length === 0 &&
            filters.destinations.length === 0;

          if (noFiltersActive) {
            setDepartments([...new Set(list.map(t => t.Department).filter(Boolean))]);
            setAssignees([...new Set(list.map(t => t.Assignee).filter(Boolean))]);
            setProjectIds([...new Set(list.map(t => String(t.ProjectId)).filter(Boolean))]);
            setCustomerNames([...new Set(list.map(t => t.CustomerName).filter(Boolean))]);
            setOnboardDates([...new Set(list.map(t => t.OnboardDate).filter(Boolean))].sort());
            setDestinations([...new Set(list.map(t => t.Destination).filter(Boolean))]);
          }
        }
      })
      .catch(err => console.error('Error fetching tasks:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTasks();
  }, [filters]);

  useEffect(() => {
    const taskIdParam = searchParams.get('taskId');
    if (taskIdParam && tasks.length > 0) {
      const foundTask = tasks.find(t => t.TaskId === taskIdParam);
      if (foundTask) {
        handleOpenDetail(foundTask);
      }
    }
  }, [tasks, searchParams]);

  // Drag and Drop handlers
  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, columnStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    try {
      const res = await api.put('/task-management/status', {
        taskId,
        newStatus: columnStatus,
        actorMNV: userMNV
      });
      if (res.success) {
        // Cập nhật state local
        setTasks(prev => prev.map(t => t.TaskId === taskId ? { ...t, TaskStatus: columnStatus } : t));
        loadTasks(); // reload to re-run status logic (like automatic complete/delay dates check)
      }
    } catch (err) {
      console.error('Error updating task status:', err);
    }
  };

  // Xem chi tiết công việc, notes & attachments
  const handleOpenDetail = async (task) => {
    setSelectedTask(task);
    setNewNote('');
    
    // Load notes
    api.get(`/task-management/${task.TaskId}/notes`)
      .then(res => {
        if (res.success) setNotes(res.data || []);
      })
      .catch(e => console.error(e));

    // Load attachments
    api.get(`/task-management/${task.TaskId}/attachments`)
      .then(res => {
        if (res.success) setAttachments(res.data || []);
      })
      .catch(e => console.error(e));
  };

  const handleCloseDetail = () => {
    setSelectedTask(null);
    setNotes([]);
    setAttachments([]);
    setSearchParams({}, { replace: true });
    loadTasks(); // reload statistics count
  };

  // Note actions
  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setSubmittingNote(true);
    try {
      const res = await api.post(`/task-management/${selectedTask.TaskId}/notes`, {
        content: newNote,
        authorMNV: userMNV,
        authorName: userName
      });
      if (res.success) {
        setNotes(prev => [res.data, ...prev]);
        setNewNote('');
      }
    } catch (err) {
      console.error('Add note error:', err);
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('Bạn có chắc muốn xoá ghi chú này?')) return;
    try {
      const res = await api.delete(`/task-management/notes/${noteId}?authorMNV=${userMNV}`);
      if (res.success) {
        setNotes(prev => prev.filter(n => n.Id !== noteId));
      }
    } catch (err) {
      console.error('Delete note error:', err);
    }
  };

  // Attachment actions
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('uploadedBy', userName);

    setUploadingFile(true);
    try {
      const res = await api.post(`/task-management/${selectedTask.TaskId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.success) {
        setAttachments(prev => [res.data, ...prev]);
      }
    } catch (err) {
      console.error('File upload error:', err);
      alert(err.response?.data?.message || 'Không thể tải file lên.');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDeleteAttachment = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xoá file đính kèm này?')) return;
    try {
      const res = await api.delete(`/task-management/attachments/${id}`);
      if (res.success) {
        setAttachments(prev => prev.filter(a => a.Id !== id));
      }
    } catch (err) {
      console.error('Delete attachment error:', err);
    }
  };

  // Nhóm tasks theo Project cho chế độ hiển thị Bảng (Collapsible accordion)
  const groupedTasksByProject = tasks.reduce((groups, task) => {
    const key = task.ProjectId;
    if (!groups[key]) {
      groups[key] = {
        projectId: task.ProjectId,
        customerName: task.CustomerName,
        customerType: task.CustomerType,
        meetingTopic: task.MeetingTopic,
        submitterName: task.SubmitterName,
        tasks: []
      };
    }
    groups[key].tasks.push(task);
    return groups;
  }, {});

  const projectGroups = Object.values(groupedTasksByProject);

  const updateFilter = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleClearFilters = () => {
    setFilters({
      departments: [],
      assignees: [],
      projectIds: [],
      customerNames: [],
      onboardDates: [],
      destinations: []
    });
  };

  // Status mappings
  const kanbanColumns = [
    { key: 'Chưa bắt đầu', title: '📋 Chưa bắt đầu', bg: 'bg-gray-100/50', border: 'border-t-gray-400' },
    { key: 'Đang xử lý', title: '⚡ Đang xử lý', bg: 'bg-amber-50/30', border: 'border-t-amber-500' },
    { key: 'Hoàn thành', title: '✅ Hoàn thành', bg: 'bg-emerald-50/20', border: 'border-t-emerald-500' }
  ];

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-on-surface mb-1">Quản lý Công việc</h2>
        </div>
        
        {/* Toggle View Mode */}
        <div className="flex items-center bg-gray-100 p-1.5 rounded-xl border w-fit">
          <button
            onClick={() => {
              setViewMode('kanban');
            }}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-black rounded-lg transition-all ${
              viewMode === 'kanban' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <span className="material-symbols-outlined text-base">view_kanban</span>
            Kanban
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-black rounded-lg transition-all ${
              viewMode === 'table' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <span className="material-symbols-outlined text-base">table_rows</span>
            Bảng
          </button>
        </div>
      </div>

      {/* Filters Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-xl text-primary">filter_alt</span>
          <span className="font-extrabold text-xs text-gray-400 uppercase tracking-wider">Bộ lọc công việc</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-sm transition-all"
          >
            <span className="material-symbols-outlined text-base">
              {showFilters ? 'visibility_off' : 'visibility'}
            </span>
            {showFilters ? 'Ẩn bộ lọc' : 'Hiện bộ lọc'}
          </button>
          <button
            onClick={handleClearFilters}
            className="flex items-center gap-2 px-4 py-2 border border-transparent bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-bold text-gray-700 transition-all"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Slicers Filters Bar */}
      {showFilters && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Phòng ban</label>
              <ComboboxMultiple
                options={departments}
                selected={filters.departments}
                onChange={val => updateFilter('departments', val)}
                placeholder="Tất cả phòng ban"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Người phụ trách</label>
              <ComboboxMultiple
                options={assignees}
                selected={filters.assignees}
                onChange={val => updateFilter('assignees', val)}
                placeholder="Tất cả người phụ trách"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Mã đơn tiếp đón</label>
              <ComboboxMultiple
                options={projectIds}
                selected={filters.projectIds}
                onChange={val => updateFilter('projectIds', val)}
                placeholder="Tất cả đơn"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Khách hàng</label>
              <ComboboxMultiple
                options={customerNames}
                selected={filters.customerNames}
                onChange={val => updateFilter('customerNames', val)}
                placeholder="Tất cả khách hàng"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Ngày tiếp đón</label>
              <ComboboxMultiple
                options={onboardDates.map(fmtDate)}
                selected={filters.onboardDates.map(fmtDate)}
                onChange={val => {
                  const isoVals = val.map(v => {
                    const parts = v.split('/');
                    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
                    return v;
                  });
                  updateFilter('onboardDates', isoVals);
                }}
                placeholder="Tất cả ngày"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Địa điểm</label>
              <ComboboxMultiple
                options={destinations}
                selected={filters.destinations}
                onChange={val => updateFilter('destinations', val)}
                placeholder="Tất cả địa điểm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Views Container */}
      {loading ? (
        <div className="p-12 text-center text-gray-500">
          <span className="material-symbols-outlined text-4xl animate-spin text-primary">refresh</span>
          <p className="text-sm font-semibold mt-1">Đang đồng bộ công việc...</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-gray-400">
          Không tìm thấy công việc chuẩn bị nào phù hợp.
        </div>
      ) : viewMode === 'kanban' ? (
        
        /* ── VIEW 1: KANBAN BOARD DRAG & DROP ── */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {kanbanColumns.map(col => {
            const colTasks = tasks.filter(t => {
              // Phân công vào các cột trên bảng:
              // status trong DB là 'Chưa bắt đầu', 'Đang xử lý', 'Hoàn thành'
              // Lấy cột khớp với TaskStatus
              return t.TaskStatus === col.key || (col.key === 'Chưa bắt đầu' && !t.TaskStatus);
            });

            return (
              <div
                key={col.key}
                onDragOver={handleDragOver}
                onDrop={e => handleDrop(e, col.key)}
                className={`rounded-2xl border border-t-4 ${col.border} ${col.bg} p-4 flex flex-col h-[650px]`}
              >
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-extrabold text-sm text-gray-900 uppercase tracking-wider">{col.title}</h4>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-white text-gray-500 shadow-sm border border-gray-100">
                    {colTasks.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {colTasks.map(task => {
                    const isDelay = task.ComputedStatus === 'Delay';
                    return (
                      <div
                        key={task.TaskId}
                        draggable
                        onDragStart={e => handleDragStart(e, task.TaskId)}
                        onClick={() => handleOpenDetail(task)}
                        className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow hover:translate-y-[-2px] transition-all cursor-pointer select-none space-y-3 group"
                      >
                        <div className="space-y-1">
                          <span className="text-[10px] font-extrabold text-primary uppercase">#{task.ProjectId}</span>
                          <h5 className="font-extrabold text-sm text-gray-950 group-hover:text-primary transition-colors leading-tight">
                            {task.TaskName}
                          </h5>
                        </div>

                        <p className="text-xs text-gray-400 font-bold truncate">🏢 {task.CustomerName}</p>

                        <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                          <span className="text-xs font-bold text-gray-600 bg-gray-50 px-2 py-0.5 rounded-md truncate max-w-[120px]">
                            👤 {task.Assignee || 'Chưa phân công'}
                          </span>
                          
                          {/* Due Indicator / Delay flag */}
                          <div className="flex items-center gap-1">
                            {isDelay && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-red-100 text-red-700 animate-pulse">
                                Delay
                              </span>
                            )}
                            {task.DeadlineDate && (
                              <span className="text-[10px] text-gray-400 font-bold">
                                {task.DeadlineDate.substring(5, 10).replace('-', '/')}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Badges count */}
                        <div className="flex items-center gap-3 text-[10px] text-gray-400 font-bold">
                          {task.NotesCount > 0 && (
                            <span className="flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-xs">chat</span>
                              {task.NotesCount}
                            </span>
                          )}
                          {task.AttachmentsCount > 0 && (
                            <span className="flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-xs">attach_file</span>
                              {task.AttachmentsCount}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {colTasks.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-300">
                      <span className="material-symbols-outlined text-3xl">inbox</span>
                      <p className="text-[10px] font-bold mt-1">Kéo thả để chuyển việc</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        
        /* ── VIEW 2: GROUPED TABLE BY PROJECTS ── */
        <div className="space-y-6">
          {projectGroups.map(group => (
            <div key={group.projectId} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Project title block */}
              <div className="bg-gray-50/50 p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-primary/10 text-primary font-black px-2.5 py-0.5 rounded-full uppercase">
                      {group.customerType}
                    </span>
                    <h4 className="font-extrabold text-base text-gray-950">
                      {group.customerName}
                    </h4>
                    <span className="text-xs text-gray-400 font-bold">#{group.projectId}</span>
                  </div>
                  <p className="text-xs text-gray-500 font-medium mt-1 truncate max-w-2xl">
                    Chủ đề: {group.meetingTopic || 'Không có chủ đề'} — Đề xuất bởi: {group.submitterName}
                  </p>
                </div>
                <div className="text-xs text-gray-400 font-bold shrink-0">
                  {group.tasks.length} công việc cần làm
                </div>
              </div>

              {/* Tasks table details */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-white border-b border-gray-50">
                    <tr>
                      <th className="py-2.5 px-4 text-xs font-bold text-gray-400 uppercase">Công việc</th>
                      <th className="py-2.5 px-4 text-xs font-bold text-gray-400 uppercase">Địa điểm</th>
                      <th className="py-2.5 px-4 text-xs font-bold text-gray-400 uppercase">Người phụ trách</th>
                      <th className="py-2.5 px-4 text-xs font-bold text-gray-400 uppercase">Hạn chót</th>
                      <th className="py-2.5 px-4 text-xs font-bold text-gray-400 uppercase text-center w-32">Trạng thái</th>
                      <th className="py-2.5 px-4 text-xs font-bold text-gray-400 uppercase text-center w-24">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {group.tasks.map(task => {
                      const isDelay = task.ComputedStatus === 'Delay';
                      return (
                        <tr key={task.TaskId} className="hover:bg-gray-50/30 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-extrabold text-gray-900">{task.TaskName}</span>
                            {task.TaskDetail && (
                              <p className="text-xs text-gray-400 font-medium mt-0.5 truncate max-w-md">{task.TaskDetail}</p>
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-500 font-semibold">{task.Destination}</td>
                          <td className="py-3 px-4 text-gray-900 font-bold">{task.Assignee || '—'}</td>
                          <td className="py-3 px-4 text-gray-500 font-bold">{fmtDate(task.DeadlineDate)}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                              isDelay ? 'bg-red-50 text-red-700 animate-pulse' :
                              task.TaskStatus === 'Hoàn thành' ? 'bg-green-50 text-green-700' :
                              task.TaskStatus === 'Đang xử lý' ? 'bg-amber-50 text-amber-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {isDelay ? 'Delay' : (task.TaskStatus || 'Chưa bắt đầu')}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleOpenDetail(task)}
                              className="text-primary hover:text-primary-dark font-extrabold text-xs bg-primary/5 hover:bg-primary/10 px-2.5 py-1 rounded-lg transition-all"
                            >
                              Chi tiết
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DETAIL MODAL DRAWER (Ghi chú & Đính kèm) */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col p-6 space-y-6 animate-slide-in">
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-gray-100 pb-4">
              <div>
                <span className="text-[10px] font-black text-primary uppercase">#{selectedTask.ProjectId}</span>
                <h3 className="font-extrabold text-lg text-gray-950 leading-snug">{selectedTask.TaskName}</h3>
                <p className="text-xs text-gray-400 font-bold mt-1">
                  Đơn khách: {selectedTask.CustomerName} — Người giao: {selectedTask.Supervisor || '—'}
                </p>
              </div>
              <button
                onClick={handleCloseDetail}
                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full transition-all"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            {/* Task Meta details */}
            <div className="bg-gray-50 p-4 rounded-2xl grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-gray-400 font-bold">Người phụ trách</p>
                <p className="font-extrabold text-gray-900 mt-0.5">{selectedTask.Assignee || 'Chưa phân công'}</p>
                <p className="text-gray-400 mt-0.5">{selectedTask.AssigneeEmail || ''}</p>
              </div>
              <div>
                <p className="text-gray-400 font-bold">Thời hạn hoàn thành</p>
                <p className="font-extrabold text-red-600 mt-0.5">{fmtDate(selectedTask.DeadlineDate)}</p>
                <p className="text-gray-400 mt-0.5">Ngày tiếp đón: {fmtDate(selectedTask.OnboardDate)}</p>
              </div>
            </div>

            {/* Accordion Tabs inside Modal (Notes & Attachments) */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-1">
              
              {/* Part 1: Ghi chú (Notes list) */}
              <div className="space-y-4">
                <h4 className="font-extrabold text-sm text-gray-950 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">chat</span>
                  Ghi chú thảo luận ({notes.length})
                </h4>

                {/* Add note form */}
                <form onSubmit={handleAddNote} className="flex gap-2">
                  <input
                    type="text"
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    placeholder="Viết ghi chú thảo luận, đôn đốc công việc..."
                    className="flex-1 px-3 py-2 border border-gray-200 bg-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="submit"
                    disabled={submittingNote || !newNote.trim()}
                    className="bg-primary text-white font-bold px-4 py-2 rounded-xl text-sm hover:opacity-90 disabled:opacity-50 transition-all shrink-0"
                  >
                    {submittingNote ? 'Gửi...' : 'Gửi'}
                  </button>
                </form>

                {/* Notes List */}
                <div className="space-y-3">
                  {notes.map(note => (
                    <div key={note.Id} className="bg-gray-50/50 border rounded-xl p-3 space-y-1 relative group">
                      <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold">
                        <span>{note.AuthorName} ({note.AuthorMNV})</span>
                        <span>{new Date(note.CreatedAt).toLocaleDateString('vi-VN')} {new Date(note.CreatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-xs text-gray-900 leading-normal">{note.Content}</p>
                      
                      {/* Delete button (only show for authors or admin) */}
                      {(note.AuthorMNV === userMNV || userRole === 'Admin') && (
                        <button
                          onClick={() => handleDeleteNote(note.Id)}
                          className="absolute right-2 bottom-2 text-red-500 hover:bg-red-50 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      )}
                    </div>
                  ))}
                  {notes.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">Chưa có ghi chú nào.</p>
                  )}
                </div>
              </div>

              {/* Part 2: Đính kèm file (Attachments) */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <h4 className="font-extrabold text-sm text-gray-950 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">attach_file</span>
                  Tệp đính kèm ({attachments.length})
                </h4>

                {/* Upload attachment input */}
                <div className="flex items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl p-4 hover:bg-gray-50 transition-all relative">
                  {uploadingFile ? (
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                      <span className="material-symbols-outlined animate-spin text-lg">sync</span>
                      Đang tải file lên...
                    </div>
                  ) : (
                    <label className="flex flex-col items-center gap-1 cursor-pointer text-xs text-gray-400 font-semibold">
                      <span className="material-symbols-outlined text-2xl text-gray-300">upload_file</span>
                      <span>Kéo thả hoặc click để chọn file đính kèm</span>
                      <span className="text-[10px] text-gray-400">(Tối đa 20MB, tránh file thực thi)</span>
                      <input
                        type="file"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* Attachment list */}
                <div className="space-y-2">
                  {attachments.map(att => (
                    <div key={att.Id} className="flex items-center justify-between p-2.5 border rounded-xl hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="material-symbols-outlined text-xl text-gray-400 shrink-0">draft</span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-900 truncate" title={att.FileName}>{att.FileName}</p>
                          <p className="text-[10px] text-gray-400 font-bold">
                            {(att.FileSize / 1024).toFixed(1)} KB — Tải bởi: {att.UploadedBy}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={`/api/task-management/attachments/${att.Id}/download`}
                          download
                          className="p-1 hover:bg-gray-100 rounded-full text-primary"
                          title="Tải xuống"
                        >
                          <span className="material-symbols-outlined text-sm">download</span>
                        </a>
                        <button
                          onClick={() => handleDeleteAttachment(att.Id)}
                          className="p-1 hover:bg-red-50 rounded-full text-red-500"
                          title="Xoá file"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                  {attachments.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">Chưa có tệp đính kèm nào.</p>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
