import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Checkbox } from '../../components/ui/checkbox';
import { Field, FieldLabel } from '../../components/ui/field';
import ExcelImportModal from '../../components/ui/ExcelImportModal';

const COLUMNS = [
  { key: 'name',     label: 'Tên phòng họp',            required: true,  example: 'Saigon Meeting Room' },
  { key: 'email',    label: 'Email lịch Outlook',        required: false, example: 'phong-saigon@vietsuncorp.com.vn' },
  { key: 'isActive', label: 'Trạng thái',               required: false, example: 'Hoạt động', validationList: ['Hoạt động', 'Ngưng hoạt động'] },
];


export default function MeetingRoomConfig() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [showImport, setShowImport] = useState(false);

  useEffect(() => { fetchRooms(); }, []);

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const res = await fetch(window.location.origin + '/api/system-config/lists?category=MeetingRoom');
      const data = await res.json();
      if (data.success) setRooms(data.data);
    } catch { toast.error('Lỗi tải dữ liệu'); }
    finally { setLoading(false); }
  };

  const handleAddNew = () => { setEditingId(0); setEditName(''); setEditEmail(''); setEditActive(true); };
  const handleEdit = (r) => { setEditingId(r.Id); setEditName(r.Name); setEditEmail(r.Email || ''); setEditActive(!!r.IsActive); };

  const handleSave = async () => {
    if (!editName.trim()) return toast.error('Vui lòng nhập tên phòng họp');
    try {
      const res = await fetch(window.location.origin + '/api/system-config/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, category: 'MeetingRoom', name: editName, email: editEmail, isActive: editActive ? 1 : 0 })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Lưu phòng họp thành công');
        setEditingId(null);
        fetchRooms();
      } else toast.error(data.error || 'Lỗi khi lưu');
    } catch { toast.error('Lỗi kết nối'); }
  };

  const handleImport = async (rows) => {
    try {
      const res = await fetch(window.location.origin + '/api/system-config/lists/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, category: 'MeetingRoom' })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        if (data.errors?.length > 0) data.errors.forEach(e => toast.error(e, { duration: 6000 }));
        setShowImport(false);
        fetchRooms();
      } else toast.error(data.error || 'Lỗi khi import');
    } catch { toast.error('Lỗi kết nối'); }
  };

  return (
    <div className="w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-end mb-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface mb-1">Danh Mục Phòng Họp</h1>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="card overflow-hidden flex flex-col" style={{ flex: 1 }}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold">Danh sách phòng họp</h3>
            <div className="flex gap-2">
              <button className="btn btn-outline btn-sm gap-1" onClick={() => setShowImport(true)}>
                <span className="material-symbols-outlined text-[16px]">upload_file</span>
                Import Excel
              </button>
              <button className="btn btn-primary" onClick={handleAddNew}>+ Thêm phòng họp</button>
            </div>
          </div>
          <div className="overflow-x-auto overflow-y-auto custom-scrollbar max-h-[calc(100vh-340px)]">
            {loading ? <p className="p-4">Đang tải...</p> : (
              <table className="data-table border-collapse">
                <thead>
                  <tr>
                    <th className="sticky top-0 z-10 bg-white">Tên phòng họp</th>
                    <th className="sticky top-0 z-10 bg-white">Email lịch Outlook</th>
                    <th className="sticky top-0 z-10 bg-white">Trạng thái</th>
                    <th className="sticky top-0 z-10 bg-white" style={{ width: 80 }}></th>
                  </tr>
                </thead>
              <tbody>
                {rooms.map(r => (
                  <tr key={r.Id}>
                    <td className="font-medium">{r.Name}</td>
                    <td className="text-muted text-sm">{r.Email || '—'}</td>
                    <td>
                      <span className={r.IsActive ? 'badge badge-success' : 'badge badge-danger'}>
                        {r.IsActive ? 'Hoạt động' : 'Dừng'}
                      </span>
                    </td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => handleEdit(r)}>Sửa</button></td>
                  </tr>
                ))}
                {!rooms.length && <tr><td colSpan="4" className="text-center text-muted">Chưa có dữ liệu</td></tr>}
              </tbody>
            </table>
            )}
          </div>

          {/* Thông tin hướng dẫn */}
          <div style={{ marginTop: 16, padding: 12, background: 'var(--color-bg)', borderRadius: 8, fontSize: 13, color: 'var(--color-text-muted)' }}>
            💡 <strong>Lưu ý:</strong> Email lịch Outlook là địa chỉ tài nguyên phòng họp (Resource Calendar). Khi tạo đơn tiếp khách, hệ thống sẽ tự động gửi lời mời vào email này để đặt phòng.
          </div>
        </div>

        {editingId !== null && (
          <div className="card" style={{ width: '100%', maxWidth: '380px', flexShrink: 0 }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold">{editingId === 0 ? 'Thêm phòng họp' : 'Chỉnh sửa'}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>Đóng</button>
            </div>
            <div className="form-group mb-4">
              <label>Tên phòng họp <span className="required">*</span></label>
              <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="VD: Saigon Meeting Room..." />
            </div>
            <div className="form-group mb-4">
              <label>Email lịch Outlook</label>
              <input
                type="email"
                value={editEmail}
                onChange={e => setEditEmail(e.target.value)}
                placeholder="phong-hop@vietsuncorp.com.vn"
              />
            </div>
            <Field orientation="horizontal" className="mb-4 items-center">
              <Checkbox id="room-active" checked={editActive} onCheckedChange={setEditActive} />
              <FieldLabel htmlFor="room-active" className="cursor-pointer">Đang hoạt động</FieldLabel>
            </Field>
            <button className="btn btn-primary w-full justify-center" onClick={handleSave}>Lưu phòng họp</button>
          </div>
        )}
      </div>

      {showImport && (
        <ExcelImportModal
          title="Import danh sách phòng họp"
          templateName="template_phong_hop.xlsx"
          columns={COLUMNS}
          onImport={handleImport}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
