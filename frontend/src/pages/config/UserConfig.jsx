import { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { ComboboxMultiple } from '../../components/ui/combobox';
import ExcelImportModal from '../../components/ui/ExcelImportModal';

const USER_COLUMNS = [
  { key: 'mnv', label: 'Mã nhân viên (MNV)', required: true, example: 'VSN001' },
  { key: 'fullName', label: 'Họ và tên', required: true, example: 'Nguyễn Văn A' },
  { key: 'email', label: 'Email', required: false, example: 'nguyen.a@vsn.com.vn' },
  { key: 'role', label: 'Vai trò (Admin/BOD/PRD/User)', required: false, example: 'User', validationList: ['Admin', 'BOD', 'PRD', 'User'] },
  { key: 'department', label: 'Phòng ban', required: false, example: 'Phòng Nhân sự' },
  { key: 'password', label: 'Mật khẩu', required: false, example: 'Aa@123456' },
  { key: 'isActive', label: 'Trạng thái', required: false, example: 'Hoạt động', validationList: ['Hoạt động', 'Ngưng hoạt động'] },
];


export default function UserConfig() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState(null);
  const [showImport, setShowImport] = useState(false);

  // Slicer States
  const [selectedMnvs, setSelectedMnvs] = useState([]);
  const [selectedDepts, setSelectedDepts] = useState([]);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUser, setNewUser] = useState({
    MNV: '',
    Password: '',
    FullName: '',
    Email: '',
    Role: 'User',
    Department: '',
    IsActive: true
  });
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadUsers();
    loadSyncStatus();
  }, []);

  const loadSyncStatus = async () => {
    try {
      const res = await api.get('/employees/sync-status');
      if (res.success) {
        setSyncStatus(res.data);
        setIsSyncing(res.isSyncing);
      }
    } catch (err) {
      console.error('Error loading sync status', err);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResults(null);
    toast.loading('Đang đồng bộ nhân viên...', { id: 'sync' });
    try {
      const res = await api.post('/employees/sync');
      if (res.success) {
        toast.success(`Đồng bộ thành công ${res.data.rowsAffected} nhân viên`, { id: 'sync' });
        loadSyncStatus();
        loadUsers(); // reload users after sync

        setSyncResults({
          missing: res.data.missingEmployees || [],
          new: res.data.newEmployees || []
        });
      } else {
        toast.error(res.error || 'Lỗi đồng bộ', { id: 'sync' });
      }
    } catch (err) {
      toast.error('Lỗi khi gọi API đồng bộ', { id: 'sync' });
    } finally {
      setIsSyncing(false);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      if (res.success) {
        setUsers(res.data);
      } else {
        toast.error(res.message || 'Lỗi khi tải danh sách');
      }
    } catch (err) {
      toast.error('Lỗi kết nối API');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (mnv) => {
    if (!window.confirm(`Bạn có chắc muốn reset mật khẩu của tài khoản ${mnv} về mặc định (Aa@123456)?`)) return;
    try {
      const res = await api.post(`/users/${mnv}/reset-password`);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error('Lỗi reset mật khẩu');
    }
  };

  const handleUpdateUser = async (userId, field, value, userRow) => {
    const updatedUser = {
      MNV: userRow.MNV,
      FullName: userRow.FullName,
      Email: userRow.Email,
      Role: field === 'Role' ? value : userRow.Role,
      IsActive: field === 'IsActive' ? value : userRow.IsActive
    };

    try {
      const res = await api.put(`/users/${userId}`, updatedUser);
      if (res.success) {
        toast.success('Cập nhật thành công');
        setUsers(users.map(u => u.UserId === userId ? { ...u, [field]: value } : u));
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error('Lỗi khi cập nhật');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const res = await api.post('/users', newUser);
      if (res.success) {
        toast.success('Tạo tài khoản thành công');
        setShowCreateModal(false);
        setNewUser({ MNV: '', Password: '', FullName: '', Email: '', Role: 'User', Department: '', IsActive: true });
        loadUsers();
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi tạo tài khoản');
    } finally {
      setIsCreating(false);
    }
  };

  const handleImport = async (rows) => {
    try {
      const res = await api.post('/users/batch', { rows });
      if (res.success) {
        toast.success(res.message);
        if (res.errors?.length > 0) res.errors.forEach(e => toast.error(e, { duration: 6000 }));
        setShowImport(false);
        loadUsers();
      } else {
        toast.error(res.message || 'Lỗi khi import');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi kết nối API');
    }
  };


  // Slicer Options
  const mnvOptions = useMemo(() => [...new Set(users.map(u => u.MNV).filter(Boolean))], [users]);
  const deptOptions = useMemo(() => [...new Set(users.map(u => u.Department).filter(Boolean))], [users]);
  const roleOptions = useMemo(() => [...new Set(users.map(u => u.Role).filter(Boolean))], [users]);
  const statusOptions = ['Hoạt động', 'Ngưng hoạt động'];

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (selectedMnvs.length > 0 && !selectedMnvs.includes(u.MNV)) return false;
      if (selectedDepts.length > 0 && !selectedDepts.includes(u.Department)) return false;
      if (selectedRoles.length > 0 && !selectedRoles.includes(u.Role)) return false;

      const userStatus = u.IsActive ? 'Hoạt động' : 'Ngưng hoạt động';
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(userStatus)) return false;

      return true;
    });
  }, [users, selectedMnvs, selectedDepts, selectedRoles, selectedStatuses]);

  return (
    <div className="w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-end mb-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface mb-1">Danh sách Tài khoản</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-start md:justify-end">
          {syncStatus && (
            <div className="text-left md:text-right text-xs text-muted">
              <div>Số nhân viên: <span className="font-bold text-color-text">{syncStatus.employeeCount}</span></div>
              <div>Lần đồng bộ cuối: {syncStatus.lastSyncAt ? new Date(syncStatus.lastSyncAt).toLocaleString('vi-VN') : 'Chưa có'}</div>
            </div>
          )}
          <button
            onClick={() => setShowImport(true)}
            className="btn btn-outline gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">upload_file</span>
            Import Excel
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-outline"
          >
            Tạo tài khoản
          </button>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="btn btn-primary"
          >
            {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ nhân viên'}
          </button>
        </div>
      </div>

      {/* SYNC RESULTS */}
      {syncResults && (
        <div className="card mb-6" style={{ borderColor: '#91CAFF', backgroundColor: '#E6F7FF' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg" style={{ color: '#0958D9' }}>Kết quả Đồng bộ</h3>
            <button onClick={() => setSyncResults(null)} className="btn btn-ghost btn-sm">✕ Đóng</button>
          </div>

          <div className="mb-6">
            <h4 className="font-bold mb-2" style={{ color: '#CF1322' }}>
              - Không tìm thấy {syncResults.missing.length} nhân viên từ danh bạ
            </h4>
            {syncResults.missing.length > 0 && (
              <div className="overflow-x-auto" style={{ maxHeight: '250px' }}>
                <table className="data-table text-sm bg-white">
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#FFF' }}>
                    <tr>
                      <th className="py-2">MNV</th>
                      <th className="py-2">Họ tên</th>
                      <th className="py-2">Phòng ban</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncResults.missing.map(emp => (
                      <tr key={emp.MNV} style={{ backgroundColor: '#FFF1F0' }}>
                        <td className="py-1">{emp.MNV}</td>
                        <td className="py-1">{emp.FullName}</td>
                        <td className="py-1">{emp.Department}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h4 className="font-bold mb-2" style={{ color: '#389E0D' }}>
              - Tìm thấy {syncResults.new.length} nhân viên mới
            </h4>
            {syncResults.new.length > 0 && (
              <div className="overflow-x-auto" style={{ maxHeight: '250px' }}>
                <table className="data-table text-sm bg-white">
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#FFF' }}>
                    <tr>
                      <th className="py-2">MNV</th>
                      <th className="py-2">Họ tên</th>
                      <th className="py-2">Phòng ban</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncResults.new.map(emp => (
                      <tr key={emp.MNV} style={{ backgroundColor: '#F6FFED' }}>
                        <td className="py-1">{emp.MNV}</td>
                        <td className="py-1">{emp.FullName}</td>
                        <td className="py-1">{emp.Department}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SLICERS */}
      <div className="card mb-6">
        <h3 className="font-bold mb-4">Bộ lọc</h3>
        <div className="form-grid-4">
          <div className="form-group">
            <label>MNV</label>
            <ComboboxMultiple
              options={mnvOptions}
              selected={selectedMnvs}
              onChange={setSelectedMnvs}
              placeholder="Tất cả MNV"
            />
          </div>

          <div className="form-group">
            <label>Phòng ban</label>
            <ComboboxMultiple
              options={deptOptions}
              selected={selectedDepts}
              onChange={setSelectedDepts}
              placeholder="Tất cả phòng ban"
            />
          </div>

          <div className="form-group">
            <label>Phân quyền</label>
            <ComboboxMultiple
              options={roleOptions}
              selected={selectedRoles}
              onChange={setSelectedRoles}
              placeholder="Tất cả quyền"
            />
          </div>

          <div className="form-group">
            <label>Trạng thái</label>
            <ComboboxMultiple
              options={statusOptions}
              selected={selectedStatuses}
              onChange={setSelectedStatuses}
              placeholder="Tất cả trạng thái"
            />
          </div>
        </div>
      </div>

      <div className="card overflow-hidden flex flex-col">
        <div className="overflow-x-auto overflow-y-auto custom-scrollbar max-h-[calc(100vh-340px)]">
          {loading ? (
            <div className="p-8 text-center text-muted">Đang tải dữ liệu...</div>
          ) : (
            <table className="data-table border-collapse">
              <thead>
                <tr>
                  <th className="sticky top-0 z-10 bg-white">User Name</th>
                  <th className="sticky top-0 z-10 bg-white">Phân quyền</th>
                  <th className="sticky top-0 z-10 bg-white">Họ tên</th>
                  <th className="sticky top-0 z-10 bg-white">Email</th>
                  <th className="sticky top-0 z-10 bg-white">Phòng ban</th>
                  <th className="sticky top-0 z-10 bg-white">Trạng thái</th>
                  <th className="sticky top-0 z-10 bg-white" style={{ width: '120px' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => (
                  <tr key={user.UserId}>
                    <td className="font-medium">{user.MNV}</td>
                    <td>
                      <select
                        value={user.Role || ''}
                        onChange={(e) => handleUpdateUser(user.UserId, 'Role', e.target.value, user)}
                        style={{
                          fontWeight: '600',
                          color: user.Role === 'Admin' ? '#FF4D4F' : user.Role === 'BOD' ? '#1677FF' : user.Role === 'PRD' ? '#FA8C16' : '#595959',
                          backgroundColor: user.Role === 'Admin' ? '#FFF1F0' : user.Role === 'BOD' ? '#E6F7FF' : user.Role === 'PRD' ? '#FFFBE6' : '#F5F5F5',
                          borderColor: user.Role === 'Admin' ? '#FFA39E' : user.Role === 'BOD' ? '#91CAFF' : user.Role === 'PRD' ? '#FFE58F' : '#D9D9D9'
                        }}
                      >
                        <option value="Admin">Admin</option>
                        <option value="BOD">BOD</option>
                        <option value="PRD">PRD</option>
                        <option value="User">User</option>
                      </select>
                    </td>
                    <td>{user.FullName}</td>
                    <td>{user.Email}</td>
                    <td>{user.Department}</td>
                    <td>
                      <select
                        value={user.IsActive ? '1' : '0'}
                        onChange={(e) => handleUpdateUser(user.UserId, 'IsActive', e.target.value === '1', user)}
                        style={{
                          fontWeight: '600',
                          color: user.IsActive ? '#52C41A' : '#FF4D4F',
                          backgroundColor: user.IsActive ? '#F6FFED' : '#FFF1F0',
                          borderColor: user.IsActive ? '#B7EB8F' : '#FFA39E'
                        }}
                      >
                        <option value="1">Hoạt động</option>
                        <option value="0">Ngưng hoạt động</option>
                      </select>
                    </td>
                    <td>
                      <button
                        onClick={() => handleResetPassword(user.MNV)}
                        className="btn btn-sm"
                        style={{
                          backgroundColor: '#FFFBE6',
                          color: '#FA8C16',
                          borderColor: '#FFE58F',
                          fontWeight: '600'
                        }}
                      >
                        Reset Pass
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan="7" className="text-center text-muted p-6">Không tìm thấy tài khoản nào phù hợp</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Tạo tài khoản mới</h3>
              <button onClick={() => setShowCreateModal(false)} className="btn btn-ghost btn-icon">✕</button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className="form-group mb-4">
                <label>User Name (MNV) <span className="required">*</span></label>
                <input required type="text" value={newUser.MNV} onChange={e => setNewUser({ ...newUser, MNV: e.target.value })} />
              </div>
              <div className="form-group mb-4">
                <label>Mật khẩu <span className="required">*</span></label>
                <input required type="text" value={newUser.Password} onChange={e => setNewUser({ ...newUser, Password: e.target.value })} placeholder="Vd: Aa@123456" />
              </div>
              <div className="form-group mb-4">
                <label>Họ tên <span className="required">*</span></label>
                <input required type="text" value={newUser.FullName} onChange={e => setNewUser({ ...newUser, FullName: e.target.value })} />
              </div>
              <div className="form-group mb-4">
                <label>Email</label>
                <input type="email" value={newUser.Email} onChange={e => setNewUser({ ...newUser, Email: e.target.value })} />
              </div>
              <div className="form-grid-2 mb-4">
                <div className="form-group">
                  <label>Phân quyền</label>
                  <select value={newUser.Role} onChange={e => setNewUser({ ...newUser, Role: e.target.value })}>
                    <option value="Admin">Admin</option>
                    <option value="BOD">BOD</option>
                    <option value="PRD">PRD</option>
                    <option value="User">User</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Phòng ban</label>
                  <input type="text" value={newUser.Department} onChange={e => setNewUser({ ...newUser, Department: e.target.value })} />
                </div>
              </div>
              <div className="form-group mb-6">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" style={{ width: '16px' }} checked={newUser.IsActive} onChange={e => setNewUser({ ...newUser, IsActive: e.target.checked })} />
                  Tài khoản đang hoạt động
                </label>
              </div>

              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-outline">Hủy</button>
                <button type="submit" disabled={isCreating} className="btn btn-primary">
                  {isCreating ? 'Đang tạo...' : 'Tạo tài khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImport && (
        <ExcelImportModal
          title="Import danh sách tài khoản"
          templateName="template_tai_khoan.xlsx"
          columns={USER_COLUMNS}
          onImport={handleImport}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
