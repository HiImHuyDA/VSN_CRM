import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Checkbox } from '../../components/ui/checkbox';
import { Field, FieldLabel } from '../../components/ui/field';
import AutocompleteInput from '../../components/ui/AutocompleteInput';
import ExcelImportModal from '../../components/ui/ExcelImportModal';

const TASK_COLUMNS = [
  { key: 'destination',     label: 'Địa điểm',              required: true,  example: 'VSN OFFICE' },
  { key: 'taskName',        label: 'Tên công việc',        required: true,  example: 'Đón khách tại cổng' },
  { key: 'assigneeName',    label: 'Người thực hiện',     required: false, example: 'Nguyễn Văn A' },
  { key: 'assigneeEmail',   label: 'Email người thực hiện', required: false, example: 'nguyen.a@vsn.com.vn' },
  { key: 'supervisorName',  label: 'Người giám sát',      required: false, example: 'Trần Thị B' },
  { key: 'supervisorEmail', label: 'Email người giám sát', required: false, example: 'tran.b@vsn.com.vn' },
  { key: 'description',     label: 'Mô tả chi tiết',     required: false, example: 'Hướng dẫn khách ra vào cổng B' },
  { key: 'isCompulsory',    label: 'Bắt buộc',             required: false, example: 'Bắt buộc', validationList: ['Bắt buộc', 'Không bắt buộc'] },
  { key: 'leadtimeDays',    label: 'Lead time (ngày)',    required: false, example: '1' },
  { key: 'isActive',        label: 'Trạng thái',            required: false, example: 'Hoạt động', validationList: ['Hoạt động', 'Ngưng hoạt động'] },
];


export default function TaskConfigPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDest, setSelectedDest] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [locations, setLocations] = useState([]);
  const [copyModalVisible, setCopyModalVisible] = useState(false);
  const [copyFromDest, setCopyFromDest] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState({
    destination: '', taskName: '', description: '',
    assigneeName: '', assigneeEmail: '',
    supervisorName: '', supervisorEmail: '',
    isCompulsory: false, leadtimeDays: 1, isActive: true
  });

  useEffect(() => {
    fetchEmployees();
    fetchTasks();
    fetchLocations();
  }, []);

  useEffect(() => { fetchTasks(); }, [selectedDest]);

  const fetchLocations = async () => {
    try {
      const res = await fetch(window.location.origin + '/api/system-config/locations');
      const data = await res.json();
      if (data.success) setLocations(data.data.filter(l => l.IsActive).map(l => l.Name));
    } catch {}
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch(window.location.origin + '/api/employees?q=');
      const data = await res.json();
      setEmployees((data.data || []).map(e => ({ label: e.FullName, email: e.Email, value: e.MNV })));
    } catch {}
  };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const url = selectedDest
        ? `/api/system-config/task-configs?destination=${encodeURIComponent(selectedDest)}`
        : window.location.origin + '/api/system-config/task-configs';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) setTasks(data.data);
    } catch { toast.error('Lỗi tải cấu hình công việc'); }
    finally { setLoading(false); }
  };

  const openNew = () => {
    setEditingId(0);
    setForm({
      destination: selectedDest, taskName: '', description: '',
      assigneeName: '', assigneeEmail: '',
      supervisorName: '', supervisorEmail: '',
      isCompulsory: false, leadtimeDays: 1, isActive: true
    });
  };

  const openEdit = (t) => {
    setEditingId(t.Id);
    setForm({
      destination: t.Destination, taskName: t.TaskName, description: t.Description || '',
      assigneeName: t.AssigneeName || '', assigneeEmail: t.AssigneeEmail || '',
      supervisorName: t.SupervisorName || '', supervisorEmail: t.SupervisorEmail || '',
      isCompulsory: !!t.IsCompulsory, leadtimeDays: t.LeadtimeDays || 1, isActive: !!t.IsActive
    });
  };

  const handleSave = async () => {
    if (!form.destination || !form.taskName) return toast.error('Vui lòng nhập Địa điểm và Tên công việc');
    try {
      const res = await fetch(window.location.origin + '/api/system-config/task-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, ...form, isCompulsory: form.isCompulsory ? 1 : 0, isActive: form.isActive ? 1 : 0 })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Lưu công việc thành công');
        setEditingId(null);
        fetchTasks();
      } else toast.error(data.error || 'Lỗi khi lưu');
    } catch { toast.error('Lỗi kết nối'); }
  };

  const handleCopy = async () => {
    if (!copyFromDest) return toast.error('Vui lòng chọn địa điểm nguồn');
    if (!selectedDest) return toast.error('Vui lòng chọn địa điểm đích ở bộ lọc');
    if (copyFromDest === selectedDest) return toast.error('Địa điểm nguồn và đích phải khác nhau');
    
    try {
      const res = await fetch(window.location.origin + '/api/system-config/task-configs/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromDest: copyFromDest, toDest: selectedDest })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Sao chép thành công');
        setCopyModalVisible(false);
        fetchTasks();
      } else {
        toast.error(data.error || 'Có lỗi xảy ra');
      }
    } catch { toast.error('Lỗi kết nối'); }
  };

  const handleImport = async (rows) => {
    try {
      const res = await fetch(window.location.origin + '/api/system-config/task-configs/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        if (data.errors?.length > 0) data.errors.forEach(e => toast.error(e, { duration: 6000 }));
        setShowImport(false);
        fetchTasks();
      } else toast.error(data.error || 'Lỗi khi import');
    } catch { toast.error('Lỗi kết nối'); }
  };


  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="w-full relative">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-end mb-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface mb-1">Cấu Hình Công Việc</h1>
        </div>
      </div>

      <div className="card mb-4">
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-end">
          <div className="form-group" style={{ flex: 1 }}>
            <label>Lọc theo địa điểm</label>
            <select value={selectedDest} onChange={e => setSelectedDest(e.target.value)}>
              <option value="">-- Tất cả địa điểm --</option>
              {locations.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          {selectedDest && (
            <button className="btn btn-outline" onClick={() => setCopyModalVisible(true)}>
              <span className="material-symbols-outlined text-[18px]">content_copy</span> Sao chép công việc
            </button>
          )}
          <button className="btn btn-outline gap-1" onClick={() => setShowImport(true)}>
            <span className="material-symbols-outlined text-[16px]">upload_file</span>
            Import Excel
          </button>
          <button className="btn btn-primary" onClick={openNew}>+ Thêm công việc</button>
        </div>
      </div>

      {copyModalVisible && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface p-6 rounded-2xl w-[400px]">
            <h3 className="font-bold text-lg mb-2">Sao chép cấu hình công việc</h3>
            <p className="text-sm text-muted mb-4">
              Sao chép toàn bộ công việc từ một địa điểm khác sang <strong className="text-primary">{selectedDest}</strong>.
            </p>
            <div className="form-group mb-6">
              <label>Từ địa điểm (Nguồn)</label>
              <select value={copyFromDest} onChange={e => setCopyFromDest(e.target.value)}>
                <option value="">-- Chọn địa điểm nguồn --</option>
                {locations.filter(d => d !== selectedDest).map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <button className="btn btn-ghost" onClick={() => setCopyModalVisible(false)}>Huỷ</button>
              <button className="btn btn-primary" onClick={handleCopy}>Xác nhận sao chép</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6">
        <div className="card overflow-hidden flex flex-col" style={{ flex: 1 }}>
          <div className="overflow-x-auto overflow-y-auto custom-scrollbar max-h-[calc(100vh-340px)]">
            {loading ? <p className="p-4">Đang tải...</p> : (
              <table className="data-table border-collapse">
                <thead>
                  <tr>
                    <th className="sticky top-0 z-10 bg-white">Địa điểm</th>
                    <th className="sticky top-0 z-10 bg-white">Tên công việc</th>
                    <th className="sticky top-0 z-10 bg-white">Người đảm nhiệm</th>
                    <th className="sticky top-0 z-10 bg-white">Leadtime (ngày)</th>
                    <th className="sticky top-0 z-10 bg-white">Bắt buộc</th>
                    <th className="sticky top-0 z-10 bg-white">Trạng thái</th>
                    <th className="sticky top-0 z-10 bg-white" style={{ width: 70 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map(t => (
                    <tr key={t.Id}>
                      <td><span className="badge badge-info">{t.Destination}</span></td>
                      <td className="font-medium">{t.TaskName}</td>
                      <td className="text-sm text-muted">{t.AssigneeName || '—'}</td>
                      <td className="text-center">{t.LeadtimeDays} ngày</td>
                      <td className="text-center">{t.IsCompulsory ? '✅' : '—'}</td>
                      <td><span className={t.IsActive ? 'badge badge-success' : 'badge badge-danger'}>{t.IsActive ? 'Hoạt động' : 'Dừng'}</span></td>
                      <td><button className="btn btn-ghost btn-sm" onClick={() => openEdit(t)}>Sửa</button></td>
                    </tr>
                  ))}
                  {!tasks.length && <tr><td colSpan="7" className="text-center text-muted">Chưa có dữ liệu. Hãy thêm cấu hình công việc.</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {editingId !== null && (
          <div className="card" style={{ width: '100%', maxWidth: '420px', flexShrink: 0 }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold">{editingId === 0 ? 'Thêm công việc' : 'Chỉnh sửa'}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>Đóng</button>
            </div>

            <div className="form-group mb-3">
              <label>Địa điểm <span className="required">*</span></label>
              <select value={form.destination} onChange={e => set('destination', e.target.value)}>
                <option value="">-- Chọn địa điểm --</option>
                {locations.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-group mb-3">
              <label>Tên công việc <span className="required">*</span></label>
              <input value={form.taskName} onChange={e => set('taskName', e.target.value)} placeholder="VD: Chuẩn bị bảng chào..." />
            </div>
            <div className="form-group mb-3">
              <label>Mô tả</label>
              <textarea rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Chi tiết công việc..." />
            </div>

            <div className="section-title" style={{ marginBottom: 8 }}>Người đảm nhiệm mặc định</div>
            <div className="form-group mb-2">
              <label>Họ tên</label>
              <AutocompleteInput
                value={form.assigneeName}
                onChange={v => set('assigneeName', v)}
                onSelect={item => setForm(f => ({ ...f, assigneeName: item.label, assigneeEmail: item.email || '' }))}
                staticList={employees}
                placeholder="Tìm nhân viên..."
              />
            </div>
            <div className="form-group mb-3">
              <label>Email</label>
              <input type="email" value={form.assigneeEmail} onChange={e => set('assigneeEmail', e.target.value)} placeholder="email@vietsun..." />
            </div>

            <div className="section-title" style={{ marginBottom: 8 }}>Người giám sát mặc định</div>
            <div className="form-group mb-2">
              <label>Họ tên</label>
              <AutocompleteInput
                value={form.supervisorName}
                onChange={v => set('supervisorName', v)}
                onSelect={item => setForm(f => ({ ...f, supervisorName: item.label, supervisorEmail: item.email || '' }))}
                staticList={employees}
                placeholder="Tìm nhân viên..."
              />
            </div>
            <div className="form-group mb-3">
              <label>Email</label>
              <input type="email" value={form.supervisorEmail} onChange={e => set('supervisorEmail', e.target.value)} placeholder="email@vietsun..." />
            </div>

            <div className="form-grid-2 mb-4">
              <div className="form-group">
                <label>Leadtime (số ngày trước)</label>
                <input type="number" min="0" value={form.leadtimeDays} onChange={e => set('leadtimeDays', parseInt(e.target.value) || 0)} />
              </div>
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: 8 }}>Tùy chọn</label>
                  <div className="flex flex-col gap-3">
                    <Field orientation="horizontal" className="items-center">
                      <Checkbox 
                        id="isCompulsory" 
                        checked={form.isCompulsory} 
                        onCheckedChange={checked => set('isCompulsory', checked)} 
                      />
                      <FieldLabel htmlFor="isCompulsory" className="cursor-pointer font-normal">
                        Bắt buộc
                      </FieldLabel>
                    </Field>
                    <Field orientation="horizontal" className="items-center">
                      <Checkbox 
                        id="isActive" 
                        checked={form.isActive} 
                        onCheckedChange={checked => set('isActive', checked)} 
                      />
                      <FieldLabel htmlFor="isActive" className="cursor-pointer font-normal">
                        Hoạt động
                      </FieldLabel>
                    </Field>
                  </div>
              </div>
            </div>

            <button className="btn btn-primary w-full justify-center" onClick={handleSave}>Lưu công việc</button>
          </div>
        )}
      </div>

      {showImport && (
        <ExcelImportModal
          title="Import danh sách công việc"
          templateName="template_cong_viec.xlsx"
          columns={TASK_COLUMNS}
          onImport={handleImport}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
