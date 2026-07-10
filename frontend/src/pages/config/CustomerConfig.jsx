import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import ExcelImportModal from '../../components/ui/ExcelImportModal';

const CUSTOMER_TYPES = [
  { value: 'Brand', label: 'Brand (Thương hiệu)' },
  { value: 'Partner', label: 'Partner (Đối tác)' }
];

const IMPORT_COLUMNS = [
  { key: 'customerType', label: 'Loại (Brand/Partner)', required: true, example: 'Brand', validationList: ['Brand', 'Partner'] },
  { key: 'name', label: 'Tên khách hàng', required: true, example: 'Công ty TNHH ABC' },
  { key: 'isActive', label: 'Trạng thái', required: false, example: 'Hoạt động', validationList: ['Hoạt động', 'Ngưng hoạt động'] },
];


export default function CustomerConfig() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState('Brand');
  const [showImport, setShowImport] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editReps, setEditReps] = useState([]);
  const [editStatusId, setEditStatusId] = useState(1);

  useEffect(() => {
    fetchCustomers(selectedType);
  }, [selectedType]);

  const fetchCustomers = async (type) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/system-config/lists?category=${type}`);
      const data = await res.json();
      if (data.success) {
        setCustomers(data.data);
      }
    } catch (err) {
      toast.error('Lỗi khi tải danh sách khách hàng');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (c) => {
    setEditingId(c.Id);
    setEditName(c.Name);
    setEditEmail(c.Email || '');
    setEditStatusId(c.StatusId || (c.IsActive ? 1 : 2));
    try {
      setEditReps(c.JsonData ? JSON.parse(c.JsonData) : []);
    } catch {
      setEditReps([]);
    }
  };

  const handleAddNew = () => {
    setEditingId(0);
    setEditName('');
    setEditEmail('');
    setEditStatusId(1);
    setEditReps([]);
  };

  const handleSave = async () => {
    if (!editName.trim()) {
      return toast.error('Vui lòng nhập tên khách hàng');
    }
    try {
      const payload = {
        id: editingId,
        category: selectedType,
        name: editName,
        email: null,
        statusId: editStatusId,
        isActive: editStatusId === 1 ? 1 : 0,
        jsonData: editReps
      };
      const res = await fetch(window.location.origin + '/api/system-config/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Đã lưu thông tin khách hàng');
        setEditingId(null);
        fetchCustomers(selectedType);
      } else {
        toast.error(data.error || 'Lỗi khi lưu');
      }
    } catch (err) {
      toast.error('Lỗi kết nối');
    }
  };

  const handleImport = async (rows) => {
    try {
      const res = await fetch(window.location.origin + '/api/system-config/lists/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: rows.map(r => ({ ...r, name: r.name, category: r.customerType || selectedType })) })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        if (data.errors?.length > 0) data.errors.forEach(e => toast.error(e, { duration: 6000 }));
        setShowImport(false);
        fetchCustomers(selectedType);
      } else toast.error(data.error || 'Lỗi khi import');
    } catch { toast.error('Lỗi kết nối'); }
  };


  // --- Quản lý Đại diện (Reps) ---
  const addRep = () => {
    setEditReps([...editReps, { salutation: 'Mr', name: '', email: '', title: '', mealNote: '', extraNote: '' }]);
  };
  const removeRep = (idx) => {
    setEditReps(editReps.filter((_, i) => i !== idx));
  };
  const updateRep = (idx, field, val) => {
    const updated = [...editReps];
    updated[idx][field] = val;
    setEditReps(updated);
  };

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Danh Mục Khách Hàng</h1>
        </div>
      </div>

      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
          <div className="form-group w-full sm:flex-1" style={{ flex: 1 }}>
            <label>Loại khách hàng</label>
            <select value={selectedType} onChange={e => setSelectedType(e.target.value)}>
              {CUSTOMER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-outline btn-sm gap-1" onClick={() => setShowImport(true)}>
              <span className="material-symbols-outlined text-[16px]">upload_file</span>
              Import Excel
            </button>
            <button className="btn btn-primary w-full sm:w-auto" onClick={handleAddNew}>
              + Thêm khách hàng mới
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Cột trái: Danh sách */}
        <div className="card" style={{ flex: 1 }}>
          <h3 className="font-bold mb-4">Danh sách {selectedType}</h3>
          {loading ? <p>Đang tải...</p> : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tên khách hàng</th>
                  <th>Người đại diện</th>
                  <th>Số người đại diện</th>
                  <th>Trạng thái</th>
                  <th style={{ width: '80px' }}></th>
                </tr>
              </thead>
              <tbody>
                {customers.map(c => {
                  let repCount = 0;
                  let reps = [];
                  try {
                    reps = c.JsonData ? JSON.parse(c.JsonData) : [];
                    repCount = reps.length;
                  } catch { }
                  return (
                    <tr key={c.Id}>
                      <td className="font-medium">{c.Name}</td>
                      <td>
                        {reps.map((r, i) => (
                          <span key={i} className="text-xs mr-2 px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded border border-gray-200 inline-block mb-1">
                            {r.salutation || ''} {r.name} {r.title ? `(${r.title})` : ''}
                          </span>
                        ))}
                        {reps.length === 0 && <span className="text-muted text-xs">—</span>}
                      </td>
                      <td>{repCount} người</td>
                      <td>
                        <span
                          className={`badge ${c.StatusId === 2 ? 'badge-danger' : 'badge-success'
                            }`}
                        >
                          {c.StatusId === 2 ? 'Dừng' : 'Hoạt động'}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(c)}>Sửa</button>
                      </td>
                    </tr>
                  )
                })}
                {customers.length === 0 && (
                  <tr><td colSpan="4" className="text-center text-muted">Chưa có dữ liệu</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Cột phải: Form chỉnh sửa */}
        {editingId !== null && (
          <div className="card" style={{ flex: 1 }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold">{editingId === 0 ? 'Thêm mới' : 'Chỉnh sửa'}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>Đóng</button>
            </div>

            <div className="form-group mb-4">
              <label>Tên Khách Hàng <span className="required">*</span></label>
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder="Ví dụ: Công ty TNHH VSN..."
              />
            </div>

            <div className="form-group mb-6">
              <label>Trạng Thái</label>
              <select value={editStatusId} onChange={e => setEditStatusId(Number(e.target.value))}>
                <option value={1}>Hoạt động</option>
                <option value={2}>Dừng</option>
              </select>
            </div>



            <div className="flex justify-between items-center mb-2">
              <label>Danh sách người đại diện mặc định</label>
              <button className="btn btn-outline btn-sm" onClick={addRep}>+ Thêm đại diện</button>
            </div>

            {editReps.length === 0 ? (
              <div className="text-center text-muted text-sm py-4 border border-dashed rounded mb-4">
                Chưa có người đại diện nào.
              </div>
            ) : (
              <div className="flex flex-col gap-4 mb-4" style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '5px' }}>
                {editReps.map((rep, idx) => (
                  <div key={idx} style={{ padding: '12px', border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-bg)' }}>
                    <div className="flex justify-between mb-2">
                      <span className="font-bold text-sm">Đại diện {idx + 1}</span>
                      <button className="text-danger" style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => removeRep(idx)}>Xóa</button>
                    </div>
                    <div className="form-grid-2 mb-2">
                      <div className="form-group">
                        <label>Xưng hô</label>
                        <select value={rep.salutation} onChange={e => updateRep(idx, 'salutation', e.target.value)}>
                          <option value="Mr">Mr</option>
                          <option value="Ms">Ms</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Họ và Tên</label>
                        <input value={rep.name} onChange={e => updateRep(idx, 'name', e.target.value)} placeholder="Nhập tên..." />
                      </div>
                    </div>
                    <div className="form-group mb-2">
                      <label>Chức vụ</label>
                      <input value={rep.title} onChange={e => updateRep(idx, 'title', e.target.value)} placeholder="Nhập chức vụ..." />
                    </div>
                    <div className="form-group mb-2">
                      <label>Email đại diện</label>
                      <input
                        type="email"
                        value={rep.email || ''}
                        onChange={e => updateRep(idx, 'email', e.target.value)}
                        placeholder="Ví dụ: rep@client.com"
                      />
                    </div>
                    <div className="form-grid-2">
                      <div className="form-group">
                        <label>Lưu ý bữa ăn</label>
                        <input value={rep.mealNote} onChange={e => updateRep(idx, 'mealNote', e.target.value)} placeholder="Ăn chay, dị ứng..." />
                      </div>
                      <div className="form-group">
                        <label>Sở thích / Ghi chú</label>
                        <input value={rep.extraNote} onChange={e => updateRep(idx, 'extraNote', e.target.value)} placeholder="Thích uống trà..." />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button className="btn btn-primary w-full justify-center" onClick={handleSave}>
              Lưu Khách Hàng
            </button>
          </div>
        )}
      </div>

      {showImport && (
        <ExcelImportModal
          title="Import danh sách khách hàng"
          templateName="template_khach_hang.xlsx"
          columns={IMPORT_COLUMNS}
          onImport={handleImport}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
