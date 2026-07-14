import { useState, useEffect } from 'react';
import { Checkbox } from '../../components/ui/checkbox';
import { Field, FieldLabel } from '../../components/ui/field';
import ExcelImportModal from '../../components/ui/ExcelImportModal';
import toast from 'react-hot-toast';

const COLUMNS = [
  { key: 'name',               label: 'Tên địa điểm',        required: true,  example: 'VSN OFFICE' },
  { key: 'notificationEmails', label: 'Email nhận thông báo', required: false, example: 'admin@vsn.com.vn;hr@vsn.com.vn' },
  { key: 'isActive',           label: 'Trạng thái',            required: false, example: 'Hoạt động', validationList: ['Hoạt động', 'Ngưng hoạt động'] },
];


export default function LocationConfig() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editNotificationEmails, setEditNotificationEmails] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [showImport, setShowImport] = useState(false);

  useEffect(() => { fetchLocations(); }, []);

  const fetchLocations = async () => {
    setLoading(true);
    try {
      const res = await fetch(window.location.origin + '/api/system-config/locations');
      const data = await res.json();
      if (data.success) setLocations(data.data);
    } catch { toast.error('Lỗi tải danh sách địa điểm'); }
    finally { setLoading(false); }
  };

  const handleEdit = (loc) => {
    setEditingId(loc.Id);
    setEditName(loc.Name);
    setEditNotificationEmails(loc.NotificationEmails || '');
    setEditActive(!!loc.IsActive);
  };

  const handleAddNew = () => {
    setEditingId(0);
    setEditName('');
    setEditNotificationEmails('');
    setEditActive(true);
  };

  const handleSave = async () => {
    if (!editName.trim()) return toast.error('Vui lòng nhập tên địa điểm');
    try {
      const res = await fetch(window.location.origin + '/api/system-config/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: editingId, 
          name: editName, 
          notificationEmails: editNotificationEmails, 
          isActive: editActive ? 1 : 0 
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Lưu địa điểm thành công');
        setEditingId(null);
        fetchLocations();
      } else {
        toast.error(data.error || 'Lỗi khi lưu');
      }
    } catch { toast.error('Lỗi kết nối'); }
  };

  const handleImport = async (rows) => {
    try {
      const res = await fetch(window.location.origin + '/api/system-config/locations/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        if (data.errors?.length > 0) {
          data.errors.forEach(e => toast.error(e, { duration: 6000 }));
        }
        setShowImport(false);
        fetchLocations();
      } else {
        toast.error(data.error || 'Lỗi khi import');
      }
    } catch { toast.error('Lỗi kết nối'); }
  };

  return (
    <div className="w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-end mb-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface mb-1">Địa Điểm Tiếp Đón</h1>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="card overflow-hidden flex flex-col" style={{ flex: 1 }}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold">Danh sách địa điểm</h3>
            <div className="flex gap-2">
              <button className="btn btn-outline btn-sm gap-1" onClick={() => setShowImport(true)}>
                <span className="material-symbols-outlined text-[16px]">upload_file</span>
                Import Excel
              </button>
              <button className="btn btn-primary" onClick={handleAddNew}>+ Thêm địa điểm</button>
            </div>
          </div>
          <div className="overflow-x-auto overflow-y-auto custom-scrollbar max-h-[calc(100vh-340px)]">
            {loading ? <p className="p-4">Đang tải...</p> : (
              <table className="data-table border-collapse">
              <thead>
                <tr>
                  <th className="sticky top-0 z-10 bg-white">Tên địa điểm</th>
                  <th className="sticky top-0 z-10 bg-white">Email nhận thông báo</th>
                  <th className="sticky top-0 z-10 bg-white">Trạng thái</th>
                  <th className="sticky top-0 z-10 bg-white" style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {locations.map(loc => (
                  <tr key={loc.Id}>
                    <td className="font-medium">{loc.Name}</td>
                    <td className="text-muted text-sm" style={{ maxWidth: 250, wordBreak: 'break-all' }}>
                      {loc.NotificationEmails || '—'}
                    </td>
                    <td>
                      <span className={loc.IsActive ? 'badge badge-success' : 'badge badge-danger'}>
                        {loc.IsActive ? 'Hoạt động' : 'Dừng'}
                      </span>
                    </td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => handleEdit(loc)}>Sửa</button></td>
                  </tr>
                ))}
                {!locations.length && <tr><td colSpan="4" className="text-center text-muted">Chưa có dữ liệu</td></tr>}
              </tbody>
            </table>
            )}
          </div>
        </div>

        {editingId !== null && (
          <div className="card" style={{ width: '100%', maxWidth: '360px', flexShrink: 0 }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold">{editingId === 0 ? 'Thêm mới' : 'Chỉnh sửa'}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>Đóng</button>
            </div>
            <div className="form-group mb-4">
              <label>Tên địa điểm <span className="required">*</span></label>
              <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="VD: Nhà máy VAC..." />
            </div>
            <div className="form-group mb-4">
              <label>Email nhận thông báo</label>
              <input value={editNotificationEmails} onChange={e => setEditNotificationEmails(e.target.value)} placeholder="Nhập các email phân tách bằng dấu ;" />
            </div>
            <Field orientation="horizontal" className="mb-4 items-center">
              <Checkbox id="loc-active" checked={editActive} onCheckedChange={setEditActive} />
              <FieldLabel htmlFor="loc-active" className="cursor-pointer">Đang hoạt động</FieldLabel>
            </Field>
            <button className="btn btn-primary w-full justify-center" onClick={handleSave}>Lưu địa điểm</button>
          </div>
        )}
      </div>

      {showImport && (
        <ExcelImportModal
          title="Import danh sách địa điểm"
          templateName="template_dia_diem.xlsx"
          columns={COLUMNS}
          onImport={handleImport}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
