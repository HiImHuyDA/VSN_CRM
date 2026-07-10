// src/pages/ReviewCriteriaConfig.jsx — Quản lý Biểu mẫu & Tiêu chí đánh giá khách hàng (Admin/PRD)
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';

export default function ReviewCriteriaConfig() {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Sync state
  const [syncLog, setSyncLog] = useState({
    lastSyncTime: null,
    status: 'Idle',
    syncedCount: 0,
    message: 'Chưa có thông tin đồng bộ.'
  });
  const [syncing, setSyncing] = useState(false);

  // Popup Modal state
  const [showPopup, setShowPopup] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [editId, setEditId] = useState(0);
  const [editFormName, setEditFormName] = useState('');
  const [sendToCustomer, setSendToCustomer] = useState(false);
  const [sendToPrd, setSendToPrd] = useState(false);
  const [sendToSubmitter, setSendToSubmitter] = useState(false);
  const [sendToBod, setSendToBod] = useState(false);
  const [editIsActive, setEditIsActive] = useState(true);
  const [formCriteriaList, setFormCriteriaList] = useState([]);

  // Criteria Sub-form Inputs
  const [cId, setCId] = useState(0);
  const [cName, setCName] = useState('');
  const [cGroup, setCGroup] = useState('Tổng hợp');
  const [cDescription, setCDescription] = useState('');
  const [cSortOrder, setCSortOrder] = useState(0);
  const [cIsRequired, setCIsRequired] = useState(false);
  const [editingCriterionIndex, setEditingCriterionIndex] = useState(null);

  // Load forms
  const loadForms = () => {
    setLoading(true);
    const params = {};
    if (searchText) params.search = searchText;
    if (filterStatus) params.isActive = filterStatus;

    api.get('/review-criteria/forms', { params })
      .then(res => {
        if (res.success) {
          setForms(res.data || []);
        }
      })
      .catch(err => {
        console.error('Error fetching forms:', err);
        toast.error('Lỗi khi tải danh sách biểu mẫu');
      })
      .finally(() => setLoading(false));
  };

  // Load sync status
  const loadSyncStatus = () => {
    api.get('/review-criteria/sync-status')
      .then(res => {
        if (res.success && res.log) {
          setSyncLog(res.log);
        }
      })
      .catch(err => console.error('Error fetching sync status:', err));
  };

  useEffect(() => {
    loadForms();
    loadSyncStatus();
  }, [filterStatus]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadForms();
  };

  // Trigger sync now
  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/review-criteria/sync-now');
      if (res.success) {
        toast.success(res.message || 'Đồng bộ Cloud thành công!');
        if (res.log) setSyncLog(res.log);
      } else {
        toast.error(res.error || 'Có lỗi xảy ra trong quá trình đồng bộ.');
        if (res.log) setSyncLog(res.log);
      }
    } catch (err) {
      toast.error(err.message || 'Lỗi kết nối đồng bộ.');
    } finally {
      setSyncing(false);
    }
  };

  // Add new evaluation form
  const handleAddNewForm = () => {
    setEditId(0);
    setEditFormName('');
    setSendToCustomer(true);
    setSendToPrd(false);
    setSendToSubmitter(false);
    setSendToBod(false);
    setEditIsActive(true);
    setFormCriteriaList([]);
    resetCriteriaSubform();
    setShowPopup(true);
  };

  // Edit form - fetch detailed criteria
  const handleEditForm = async (formItem) => {
    try {
      const res = await api.get(`/review-criteria/forms/${formItem.Id}`);
      if (res.success && res.data) {
        const d = res.data;
        setEditId(d.Id);
        setEditFormName(d.FormName);
        setSendToCustomer(!!d.SendToCustomer);
        setSendToPrd(!!d.SendToPrd);
        setSendToSubmitter(!!d.SendToSubmitter);
        setSendToBod(!!d.SendToBod);
        setEditIsActive(!!d.IsActive);
        
        // Map criteria back into state with matching schema
        const mapped = (d.criteria || []).map(c => ({
          id: c.Id || c.id || 0,
          criteriaName: c.CriteriaName || c.criteriaName,
          description: c.Description || c.description || '',
          criteriaGroup: c.CriteriaGroup || c.criteriaGroup || 'Tổng hợp',
          sortOrder: c.SortOrder || c.sortOrder || 0,
          isRequired: !!(c.IsRequired !== undefined ? c.IsRequired : c.isRequired),
          isActive: !!(c.IsActive !== undefined ? c.IsActive : c.isActive)
        }));
        setFormCriteriaList(mapped);
        resetCriteriaSubform();
        setShowPopup(true);
      } else {
        toast.error(res.error || 'Không thể tải chi tiết biểu mẫu');
      }
    } catch (err) {
      toast.error('Lỗi khi tải thông tin chi tiết');
    }
  };

  // Toggle active status quick toggle
  const handleToggleFormActive = async (id, currentActive) => {
    const newActive = !currentActive;
    try {
      const res = await api.post(`/review-criteria/forms/${id}/toggle`, { isActive: newActive });
      if (res.success) {
        toast.success(newActive ? 'Đã kích hoạt biểu mẫu' : 'Đã ngưng hoạt động biểu mẫu');
        loadForms();
      } else {
        toast.error(res.error || 'Cập nhật trạng thái thất bại');
      }
    } catch (err) {
      toast.error('Lỗi khi cập nhật trạng thái');
    }
  };

  // Criteria sub-form controls
  const resetCriteriaSubform = () => {
    setCId(0);
    setCName('');
    setCGroup('Tổng hợp');
    setCDescription('');
    setCSortOrder(formCriteriaList.length + 1);
    setCIsRequired(false);
    setEditingCriterionIndex(null);
  };

  const handleConfirmCriterion = () => {
    if (!cName.trim()) {
      toast.error('Tên tiêu chí không được bỏ trống');
      return;
    }

    const newItem = {
      id: cId,
      criteriaName: cName.trim(),
      criteriaGroup: cGroup,
      description: cDescription.trim(),
      sortOrder: parseInt(cSortOrder) || 0,
      isRequired: cIsRequired,
      isActive: true
    };

    if (editingCriterionIndex === null) {
      // Add new
      setFormCriteriaList([...formCriteriaList, newItem]);
      toast.success('Đã thêm tiêu chí mới vào biểu mẫu');
    } else {
      // Update existing index
      const updated = [...formCriteriaList];
      updated[editingCriterionIndex] = newItem;
      setFormCriteriaList(updated);
      toast.success('Đã cập nhật tiêu chí');
    }

    resetCriteriaSubform();
  };

  const handleEditCriterionInList = (index) => {
    const item = formCriteriaList[index];
    setCId(item.id || 0);
    setCName(item.criteriaName);
    setCGroup(item.criteriaGroup || 'Tổng hợp');
    setCDescription(item.description || '');
    setCSortOrder(item.sortOrder || 0);
    setCIsRequired(!!item.isRequired);
    setEditingCriterionIndex(index);
  };

  const handleDeleteCriterionInList = (index) => {
    setFormCriteriaList(formCriteriaList.filter((_, i) => i !== index));
    if (editingCriterionIndex === index) {
      resetCriteriaSubform();
    }
    toast.success('Đã gỡ tiêu chí khỏi biểu mẫu');
  };

  // Main Form Save
  const handleSaveForm = async () => {
    if (!editFormName.trim()) {
      toast.error('Vui lòng nhập tên biểu mẫu');
      return;
    }
    if (formCriteriaList.length === 0) {
      toast.error('Cần có ít nhất 1 tiêu chí đánh giá trong biểu mẫu');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        id: editId,
        formName: editFormName.trim(),
        sendToCustomer,
        sendToPrd,
        sendToSubmitter,
        sendToBod,
        isActive: editIsActive,
        criteria: formCriteriaList
      };

      const res = await api.post('/review-criteria/forms', payload);
      if (res.success) {
        toast.success(editId === 0 ? 'Thêm mới biểu mẫu thành công' : 'Cập nhật biểu mẫu thành công');
        setShowPopup(false);
        loadForms();
      } else {
        toast.error(res.error || 'Lỗi khi lưu biểu mẫu');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Có lỗi xảy ra khi lưu biểu mẫu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Cấu hình Đánh giá</h1>
          <p className="text-sm text-muted block mt-1">
            Thiết kế biểu mẫu khảo sát ý kiến khách hàng và các bên liên quan đối với dịch vụ tiếp đón
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Filters and Tables (Full width) */}
        <div className="lg:col-span-3 space-y-6">
          {/* SEARCH FILTERS */}
          <div className="card">
            <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="form-group">
                <label className="text-sm font-semibold">Tên biểu mẫu</label>
                <input
                  type="text"
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  placeholder="Tìm theo tên biểu mẫu..."
                />
              </div>
              <div className="form-group">
                <label className="text-sm font-semibold">Trạng thái</label>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="">Tất cả trạng thái</option>
                  <option value="1">Đang hoạt động</option>
                  <option value="0">Ngưng hoạt động</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn btn-outline flex-1 justify-center">Lọc</button>
                <button type="button" className="btn btn-primary" onClick={handleAddNewForm}>+ Thêm</button>
              </div>
            </form>
          </div>

          {/* TEMPLATES LIST TABLE */}
          <div className="card overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-muted">
                <span className="material-symbols-outlined text-3xl animate-spin">refresh</span>
                <p className="text-xs font-semibold mt-1">Đang tải biểu mẫu đánh giá...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 60 }} className="text-center">ID</th>
                      <th>Tên Biểu mẫu</th>
                      <th>Đối tượng gửi</th>
                      <th className="text-center" style={{ width: 100 }}>Số tiêu chí</th>
                      <th className="text-center" style={{ width: 150 }}>Trạng thái</th>
                      <th className="text-center" style={{ width: 150 }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forms.map(form => {
                      const targets = [];
                      if (form.SendToCustomer) targets.push('Khách hàng');
                      if (form.SendToPrd) targets.push('PRD');
                      if (form.SendToSubmitter) targets.push('Người làm phiếu');
                      if (form.SendToBod) targets.push('BOD');

                      return (
                        <tr key={form.Id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="text-center font-semibold text-gray-500">{form.Id}</td>
                          <td className="font-bold text-gray-900">{form.FormName}</td>
                          <td>
                            <div className="flex flex-wrap gap-1">
                              {targets.map(t => (
                                <span key={t} className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700">
                                  {t}
                                </span>
                              ))}
                              {targets.length === 0 && <span className="text-gray-400">—</span>}
                            </div>
                          </td>
                          <td className="text-center font-bold text-gray-700">{form.CriteriaCount}</td>
                          <td className="text-center">
                            <span className={`badge ${form.IsActive ? 'badge-success' : 'badge-danger'}`}>
                              {form.IsActive ? 'Đang hoạt động' : 'Ngưng'}
                            </span>
                          </td>
                          <td>
                            <div className="flex gap-2 justify-center">
                              <button className="btn btn-ghost btn-sm" onClick={() => handleEditForm(form)}>
                                Sửa
                              </button>
                              <button
                                className={`btn btn-sm ${form.IsActive ? 'btn-outline text-red-600 hover:bg-red-50' : 'btn-primary'}`}
                                onClick={() => handleToggleFormActive(form.Id, form.IsActive)}
                              >
                                {form.IsActive ? 'Ngưng' : 'Kích hoạt'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {forms.length === 0 && (
                      <tr>
                        <td colSpan="6" className="text-center text-muted py-8">
                          Không tìm thấy biểu mẫu đánh giá nào.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
      </div>
      </div>

      {/* POPUP MODAL */}
      {showPopup && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div style={{
              padding: '20px 28px 16px',
              borderBottom: '1px solid #f3f4f6',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'linear-gradient(to right, #f5f3ff, #eef2ff)',
              borderRadius: '12px 12px 0 0',
            }}>
              <div>
                <h2 style={{ fontWeight: 700, fontSize: 18, color: '#1e1b4b', margin: 0 }}>
                  {editId === 0 ? '📋  Thêm mới biểu mẫu đánh giá' : '✏️  Chỉnh sửa cấu hình biểu mẫu'}
                </h2>
                <p style={{ fontSize: 13, color: '#6b7280', margin: '3px 0 0' }}>
                  Thiết lập thông tin chung, nhóm nhận và danh sách các tiêu chí đánh giá khảo sát
                </p>
              </div>
              <button
                onClick={() => setShowPopup(false)}
                style={{
                  width: 32, height: 32, borderRadius: 8, border: '1px solid #e5e7eb',
                  background: '#fff', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 18,
                  color: '#6b7280', lineHeight: 1,
                }}
              >×</button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px 28px' }} className="space-y-6">
              
              {/* Form Name & Active Status */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="form-group md:col-span-3">
                  <label className="font-semibold">Tên biểu mẫu đánh giá <span className="required">*</span></label>
                  <input
                    type="text"
                    value={editFormName}
                    onChange={e => setEditFormName(e.target.value)}
                    placeholder="Ví dụ: Đánh giá dịch vụ đón tiếp đoàn đối tác..."
                  />
                </div>
                <div className="form-group md:col-span-1 flex items-center h-10 pb-1">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-sm">
                    <input
                      type="checkbox"
                      checked={editIsActive}
                      onChange={e => setEditIsActive(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-primary"
                    />
                    Kích hoạt hoạt động
                  </label>
                </div>
              </div>

              {/* Recipients Checkboxes */}
              <div className="card bg-gray-50 border-gray-200">
                <label className="font-bold text-xs uppercase text-gray-500 block mb-3">Biểu mẫu này gửi cho:</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-sm">
                    <input
                      type="checkbox"
                      checked={sendToCustomer}
                      onChange={e => setSendToCustomer(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-primary"
                    />
                    Khách hàng
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-sm">
                    <input
                      type="checkbox"
                      checked={sendToPrd}
                      onChange={e => setSendToPrd(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-primary"
                    />
                    PRD
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-sm">
                    <input
                      type="checkbox"
                      checked={sendToSubmitter}
                      onChange={e => setSendToSubmitter(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-primary"
                    />
                    Người làm phiếu
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-sm">
                    <input
                      type="checkbox"
                      checked={sendToBod}
                      onChange={e => setSendToBod(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-primary"
                    />
                    BOD
                  </label>
                </div>
              </div>

              {/* CRITERIA DECLARATION SUB-FORM */}
              <div className="border border-gray-200 rounded-xl p-5 space-y-4">
                <h3 className="font-extrabold text-sm text-gray-900 border-b border-gray-100 pb-2 flex items-center justify-between">
                  <span>➕ Khai báo tiêu chí đánh giá</span>
                  {editingCriterionIndex !== null && (
                    <button
                      type="button"
                      onClick={resetCriteriaSubform}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      Hủy sửa tiêu chí này
                    </button>
                  )}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="form-group md:col-span-2">
                    <label className="text-xs font-bold text-gray-500 uppercase">Tên tiêu chí</label>
                    <input
                      type="text"
                      value={cName}
                      onChange={e => setCName(e.target.value)}
                      placeholder="Ví dụ: Thái độ tiếp đón..."
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-xs font-bold text-gray-500 uppercase">Nhóm tiêu chí</label>
                    <select value={cGroup} onChange={e => setCGroup(e.target.value)}>
                      <option value="Tiếp đón">Tiếp đón</option>
                      <option value="Di chuyển">Di chuyển</option>
                      <option value="Hậu cần">Hậu cần</option>
                      <option value="Ăn uống">Ăn uống</option>
                      <option value="Tổng hợp">Tổng hợp</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="text-xs font-bold text-gray-500 uppercase">Thứ tự hiển thị</label>
                    <input
                      type="number"
                      value={cSortOrder}
                      onChange={e => setCSortOrder(parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="text-xs font-bold text-gray-500 uppercase">Mô tả chi tiết</label>
                  <textarea
                    rows={2}
                    value={cDescription}
                    onChange={e => setCDescription(e.target.value)}
                    placeholder="Mô tả nội dung của tiêu chí để người đánh giá dễ hiểu..."
                    className="w-full px-3 py-2 border border-gray-200 bg-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-sm">
                    <input
                      type="checkbox"
                      checked={cIsRequired}
                      onChange={e => setCIsRequired(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-primary"
                    />
                    Bắt buộc trả lời
                  </label>
                  
                  <button
                    type="button"
                    onClick={handleConfirmCriterion}
                    className="btn btn-outline hover:bg-indigo-50 border-indigo-200 text-indigo-700 py-1.5 px-4 font-bold text-xs"
                  >
                    {editingCriterionIndex !== null ? '💾 Xác nhận Cập nhật' : '⚡ Xác nhận thêm tiêu chí'}
                  </button>
                </div>
              </div>

              {/* LIST OF CURRENT DECLARED CRITERIA IN STATE */}
              <div>
                <label className="font-bold text-xs uppercase text-gray-500 block mb-2">
                  Danh sách tiêu chí đã khai báo ({formCriteriaList.length})
                </label>
                
                {formCriteriaList.length === 0 ? (
                  <div className="p-8 border border-dashed border-gray-200 rounded-xl text-center text-gray-400 text-xs italic">
                    Chưa có tiêu chí nào được khai báo. Hãy nhập và bấm xác nhận ở trên.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto p-1 border border-gray-100 rounded-xl">
                    {formCriteriaList.map((item, idx) => (
                      <div
                        key={idx}
                        className={`flex items-start justify-between border rounded-xl p-3 shadow-xs relative transition-all ${
                          editingCriterionIndex === idx 
                            ? 'border-indigo-400 bg-indigo-50/30' 
                            : 'border-gray-200 bg-white hover:border-indigo-200'
                        }`}
                      >
                        <div className="space-y-1 pr-6 flex-1">
                          <div className="flex items-center flex-wrap gap-1.5">
                            <span className="text-xs font-black text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                              #{item.sortOrder}
                            </span>
                            <span className="font-bold text-gray-900 text-sm">{item.criteriaName}</span>
                            {item.isRequired && (
                              <span className="text-[9px] font-black bg-red-50 text-red-600 px-1.5 py-0.2 rounded border border-red-200">
                                Bắt buộc
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.2 rounded-full">
                              {item.criteriaGroup}
                            </span>
                          </div>

                          {item.description && (
                            <p className="text-xs text-gray-500 italic line-clamp-2 mt-1">
                              {item.description}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleEditCriterionInList(idx)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                            title="Sửa tiêu chí"
                          >
                            <span className="material-symbols-outlined text-[15px]">edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCriterionInList(idx)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Gỡ bỏ"
                          >
                            <span className="material-symbols-outlined text-[15px]">close</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 28px', borderTop: '1px solid #f3f4f6',
              display: 'flex', justifyContent: 'flex-end', gap: 12,
              background: '#fafafa', borderRadius: '0 0 12px 12px',
            }}>
              <button className="btn btn-outline" onClick={() => setShowPopup(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={handleSaveForm} disabled={saving}>
                {saving ? 'Đang lưu...' : 'Lưu biểu mẫu'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
