import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  getVehicleTypes,
  saveVehicleType,
  getVehicles,
  saveVehicle,
  getDrivers,
  saveDriver
} from '../../services/fleetApi';
import { Checkbox } from '../../components/ui/checkbox';
import { Field, FieldGroup, FieldLabel } from '../../components/ui/field';

export default function VehicleConfig() {
  const [activeTab, setActiveTab] = useState('vehicles'); // vehicles, drivers, types
  const [loading, setLoading] = useState(false);

  // Lists
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [types, setTypes] = useState([]);

  // Edit states
  const [editingId, setEditingId] = useState(null);

  // Form states - Vehicle
  const [vPlateNumber, setVPlateNumber] = useState('');
  const [vBrand, setVBrand] = useState('');
  const [vModel, setVModel] = useState('');
  const [vTypeId, setVTypeId] = useState('');
  const [vSeats, setVSeats] = useState(4);
  const [vColor, setVColor] = useState('');
  const [vFuelType, setVFuelType] = useState('Xăng');
  const [vStatus, setVStatus] = useState('Sẵn sàng');
  const [vNotes, setVNotes] = useState('');
  const [vActive, setVActive] = useState(true);

  // Form states - Driver
  const [dFullName, setDFullName] = useState('');
  const [dPhone, setDPhone] = useState('');
  const [dLicenseNumber, setDLicenseNumber] = useState('');
  const [dLicenseClass, setDLicenseClass] = useState('');
  const [dStatus, setDStatus] = useState('Sẵn sàng');
  const [dNotes, setDNotes] = useState('');
  const [dActive, setDActive] = useState(true);

  // Form states - Type
  const [tTypeName, setTTypeName] = useState('');
  const [tDescription, setTDescription] = useState('');
  const [tActive, setTActive] = useState(true);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    setEditingId(null);
    try {
      if (activeTab === 'vehicles') {
        const [vRes, tRes] = await Promise.all([getVehicles(), getVehicleTypes()]);
        if (vRes.success) setVehicles(vRes.data);
        if (tRes.success) setTypes(tRes.data);
      } else if (activeTab === 'drivers') {
        const dRes = await getDrivers();
        if (dRes.success) setDrivers(dRes.data);
      } else if (activeTab === 'types') {
        const tRes = await getVehicleTypes();
        if (tRes.success) setTypes(tRes.data);
      }
    } catch (err) {
      toast.error('Lỗi khi tải dữ liệu cấu hình: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- ACTIONS ---
  const handleEditVehicle = (v) => {
    setEditingId(v.Id);
    setVPlateNumber(v.PlateNumber);
    setVBrand(v.Brand);
    setVModel(v.Model || '');
    setVTypeId(v.TypeId || '');
    setVSeats(v.Seats);
    setVColor(v.Color || '');
    setVFuelType(v.FuelType || 'Xăng');
    setVStatus(v.Status || 'Sẵn sàng');
    setVNotes(v.Notes || '');
    setVActive(!!v.IsActive);
  };

  const handleAddNewVehicle = () => {
    setEditingId(0);
    setVPlateNumber('');
    setVBrand('');
    setVModel('');
    setVTypeId(types[0]?.Id || '');
    setVSeats(4);
    setVColor('');
    setVFuelType('Xăng');
    setVStatus('Sẵn sàng');
    setVNotes('');
    setVActive(true);
  };

  const handleSaveVehicle = async () => {
    if (!vPlateNumber.trim()) return toast.error('Vui lòng nhập biển số xe');
    if (!vBrand.trim()) return toast.error('Vui lòng nhập hãng xe');

    try {
      const res = await saveVehicle({
        id: editingId,
        plateNumber: vPlateNumber,
        brand: vBrand,
        model: vModel,
        typeId: vTypeId || null,
        seats: vSeats,
        color: vColor,
        fuelType: vFuelType,
        status: vStatus,
        notes: vNotes,
        isActive: vActive
      });
      if (res.success) {
        toast.success('Đã lưu thông tin xe');
        setEditingId(null);
        loadData();
      }
    } catch (err) {
      toast.error(err.message || 'Lỗi khi lưu');
    }
  };

  const handleEditDriver = (d) => {
    setEditingId(d.Id);
    setDFullName(d.FullName);
    setDPhone(d.Phone || '');
    setDLicenseNumber(d.LicenseNumber || '');
    setDLicenseClass(d.LicenseClass || '');
    setDStatus(d.Status || 'Sẵn sàng');
    setDNotes(d.Notes || '');
    setDActive(!!d.IsActive);
  };

  const handleAddNewDriver = () => {
    setEditingId(0);
    setDFullName('');
    setDPhone('');
    setDLicenseNumber('');
    setDLicenseClass('');
    setDStatus('Sẵn sàng');
    setDNotes('');
    setDActive(true);
  };

  const handleSaveDriver = async () => {
    if (!dFullName.trim()) return toast.error('Vui lòng nhập tên tài xế');

    try {
      const res = await saveDriver({
        id: editingId,
        fullName: dFullName,
        phone: dPhone,
        licenseNumber: dLicenseNumber,
        licenseClass: dLicenseClass,
        status: dStatus,
        notes: dNotes,
        isActive: dActive
      });
      if (res.success) {
        toast.success('Đã lưu thông tin tài xế');
        setEditingId(null);
        loadData();
      }
    } catch (err) {
      toast.error(err.message || 'Lỗi khi lưu');
    }
  };

  const handleEditType = (t) => {
    setEditingId(t.Id);
    setTTypeName(t.TypeName);
    setTDescription(t.Description || '');
    setTActive(!!t.IsActive);
  };

  const handleAddNewType = () => {
    setEditingId(0);
    setTTypeName('');
    setTDescription('');
    setTActive(true);
  };

  const handleSaveType = async () => {
    if (!tTypeName.trim()) return toast.error('Vui lòng nhập tên loại xe');

    try {
      const res = await saveVehicleType({
        id: editingId,
        typeName: tTypeName,
        description: tDescription,
        isActive: tActive
      });
      if (res.success) {
        toast.success('Đã lưu loại xe');
        setEditingId(null);
        loadData();
      }
    } catch (err) {
      toast.error(err.message || 'Lỗi khi lưu');
    }
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-on-surface mb-1">Cấu Hình Xe & Tài Xế</h1>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="tabs mb-6 flex border-b border-border">
        <button
          className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all ${activeTab === 'vehicles' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          onClick={() => setActiveTab('vehicles')}
        >
          🚗 Danh Sách Xe
        </button>
        <button
          className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all ${activeTab === 'drivers' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          onClick={() => setActiveTab('drivers')}
        >
          👨‍✈️ Tài Xế
        </button>
        <button
          className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all ${activeTab === 'types' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          onClick={() => setActiveTab('types')}
        >
          📋 Loại Xe
        </button>
      </div>

      {/* Main Content Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Table Lists */}
        <div className="lg:col-span-2 card p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-md font-bold text-on-surface">
              {activeTab === 'vehicles' && 'Danh sách xe hiện có'}
              {activeTab === 'drivers' && 'Danh sách tài xế'}
              {activeTab === 'types' && 'Danh mục các loại xe'}
            </h2>
            {editingId === null && (
              <button
                className="btn btn-primary btn-sm flex items-center gap-1"
                onClick={() => {
                  if (activeTab === 'vehicles') handleAddNewVehicle();
                  if (activeTab === 'drivers') handleAddNewDriver();
                  if (activeTab === 'types') handleAddNewType();
                }}
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Thêm mới
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-8 text-center text-on-surface-variant">Đang tải dữ liệu...</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-gray-50">
                    {activeTab === 'vehicles' && (
                      <>
                        <th className="p-3 text-left">Biển số</th>
                        <th className="p-3 text-left">Hiệu xe / Dòng</th>
                        <th className="p-3 text-left">Loại xe / Ghế</th>
                        <th className="p-3 text-left">Trạng thái</th>
                        <th className="p-3 text-center">Hành động</th>
                      </>
                    )}
                    {activeTab === 'drivers' && (
                      <>
                        <th className="p-3 text-left">Họ tên</th>
                        <th className="p-3 text-left">Số điện thoại</th>
                        <th className="p-3 text-left">Hạng bằng</th>
                        <th className="p-3 text-left">Trạng thái</th>
                        <th className="p-3 text-center">Hành động</th>
                      </>
                    )}
                    {activeTab === 'types' && (
                      <>
                        <th className="p-3 text-left">Tên loại xe</th>
                        <th className="p-3 text-left">Mô tả</th>
                        <th className="p-3 text-left">Hoạt động</th>
                        <th className="p-3 text-center">Hành động</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {activeTab === 'vehicles' && vehicles.map((v) => (
                    <tr key={v.Id} className="border-b border-border hover:bg-gray-50/50">
                      <td className="p-3 font-semibold text-primary">{v.PlateNumber}</td>
                      <td className="p-3">{v.Brand} {v.Model}</td>
                      <td className="p-3">
                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs mr-2">{v.TypeName || 'Chưa phân loại'}</span>
                        <span className="text-xs text-on-surface-variant">{v.Seats} chỗ</span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${v.Status === 'Sẵn sàng' ? 'bg-green-100 text-green-700' :
                            v.Status === 'Bảo dưỡng' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                          {v.Status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button className="btn btn-ghost btn-sm text-primary" onClick={() => handleEditVehicle(v)}>Sửa</button>
                      </td>
                    </tr>
                  ))}

                  {activeTab === 'drivers' && drivers.map((d) => (
                    <tr key={d.Id} className="border-b border-border hover:bg-gray-50/50">
                      <td className="p-3 font-semibold text-on-surface">{d.FullName}</td>
                      <td className="p-3">{d.Phone || '—'}</td>
                      <td className="p-3">
                        <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">{d.LicenseClass || '—'}</span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${d.Status === 'Sẵn sàng' ? 'bg-green-100 text-green-700' :
                            d.Status === 'Nghỉ' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                          {d.Status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button className="btn btn-ghost btn-sm text-primary" onClick={() => handleEditDriver(d)}>Sửa</button>
                      </td>
                    </tr>
                  ))}

                  {activeTab === 'types' && types.map((t) => (
                    <tr key={t.Id} className="border-b border-border hover:bg-gray-50/50">
                      <td className="p-3 font-semibold text-on-surface">{t.TypeName}</td>
                      <td className="p-3">{t.Description || '—'}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${t.IsActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {t.IsActive ? 'Hoạt động' : 'Khóa'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button className="btn btn-ghost btn-sm text-primary" onClick={() => handleEditType(t)}>Sửa</button>
                      </td>
                    </tr>
                  ))}

                  {((activeTab === 'vehicles' && vehicles.length === 0) ||
                    (activeTab === 'drivers' && drivers.length === 0) ||
                    (activeTab === 'types' && types.length === 0)) && !loading && (
                      <tr>
                        <td colSpan="5" className="p-8 text-center text-on-surface-variant">Không có dữ liệu nào.</td>
                      </tr>
                    )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Side: Form Editor */}
        <div className="card p-4">
          {editingId === null ? (
            <div className="h-full flex flex-col justify-center items-center text-center p-8 text-on-surface-variant border border-dashed border-border rounded-xl">
              <span className="material-symbols-outlined text-[36px] mb-2 opacity-50">edit_note</span>
              <p className="text-sm">Chọn một dòng để sửa thông tin hoặc bấm "Thêm mới" để nhập mới.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center border-b border-border pb-2 mb-2">
                <h3 className="font-bold text-on-surface">
                  {editingId === 0 ? 'Thêm mới' : 'Cập nhật'} {
                    activeTab === 'vehicles' ? 'xe' :
                      activeTab === 'drivers' ? 'tài xế' : 'loại xe'
                  }
                </h3>
                <button className="text-xs text-on-surface-variant hover:text-on-surface" onClick={() => setEditingId(null)}>Hủy</button>
              </div>

              {/* Form Vehicle */}
              {activeTab === 'vehicles' && (
                <>
                  <div className="form-group">
                    <label className="text-xs font-semibold">Biển Số Xe <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="w-full text-sm p-2 border border-border rounded-md"
                      placeholder="VD: 51F-12345"
                      value={vPlateNumber}
                      onChange={(e) => setVPlateNumber(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="form-group">
                      <label className="text-xs font-semibold">Hãng Xe <span className="text-danger">*</span></label>
                      <input
                        type="text"
                        className="w-full text-sm p-2 border border-border rounded-md"
                        placeholder="Toyota, Ford..."
                        value={vBrand}
                        onChange={(e) => setVBrand(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="text-xs font-semibold">Dòng Xe</label>
                      <input
                        type="text"
                        className="w-full text-sm p-2 border border-border rounded-md"
                        placeholder="Camry, Transit..."
                        value={vModel}
                        onChange={(e) => setVModel(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="form-group">
                      <label className="text-xs font-semibold">Phân Loại Xe</label>
                      <select
                        className="w-full text-sm p-2 border border-border rounded-md"
                        value={vTypeId}
                        onChange={(e) => setVTypeId(e.target.value)}
                      >
                        <option value="">-- Chọn loại xe --</option>
                        {types.map(t => <option key={t.Id} value={t.Id}>{t.TypeName}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="text-xs font-semibold">Số Chỗ Ngồi</label>
                      <input
                        type="number"
                        className="w-full text-sm p-2 border border-border rounded-md"
                        value={vSeats}
                        onChange={(e) => setVSeats(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="form-group">
                      <label className="text-xs font-semibold">Nhiên Liệu</label>
                      <select
                        className="w-full text-sm p-2 border border-border rounded-md"
                        value={vFuelType}
                        onChange={(e) => setVFuelType(e.target.value)}
                      >
                        <option value="Xăng">Xăng</option>
                        <option value="Dầu">Dầu Diesel</option>
                        <option value="Điện">Điện</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="text-xs font-semibold">Màu Sắc</label>
                      <input
                        type="text"
                        className="w-full text-sm p-2 border border-border rounded-md"
                        placeholder="Trắng, Đen..."
                        value={vColor}
                        onChange={(e) => setVColor(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="text-xs font-semibold">Trạng Thái Điều Phối</label>
                    <select
                      className="w-full text-sm p-2 border border-border rounded-md"
                      value={vStatus}
                      onChange={(e) => setVStatus(e.target.value)}
                    >
                      <option value="Sẵn sàng">Sẵn sàng hoạt động</option>
                      <option value="Bảo dưỡng">Đang bảo dưỡng</option>
                      <option value="Ngưng hoạt động">Ngưng hoạt động</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="text-xs font-semibold">Ghi Chú</label>
                    <textarea
                      rows="2"
                      className="w-full text-sm p-2 border border-border rounded-md"
                      placeholder="Thông tin thêm..."
                      value={vNotes}
                      onChange={(e) => setVNotes(e.target.value)}
                    />
                  </div>
                  <FieldGroup className="mt-2">
                    <Field orientation="horizontal">
                      <Checkbox
                        id="vActive"
                        checked={vActive}
                        onCheckedChange={(checked) => setVActive(!!checked)}
                      />
                      <FieldLabel htmlFor="vActive" className="text-xs font-semibold select-none cursor-pointer">
                        Kích hoạt tài sản
                      </FieldLabel>
                    </Field>
                  </FieldGroup>
                  <button className="btn btn-primary w-full mt-4" onClick={handleSaveVehicle}>Lưu Thông Tin</button>
                </>
              )}

              {/* Form Driver */}
              {activeTab === 'drivers' && (
                <>
                  <div className="form-group">
                    <label className="text-xs font-semibold">Họ Và Tên <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="w-full text-sm p-2 border border-border rounded-md"
                      placeholder="VD: Nguyễn Văn A"
                      value={dFullName}
                      onChange={(e) => setDFullName(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-xs font-semibold">Số Điện Thoại</label>
                    <input
                      type="text"
                      className="w-full text-sm p-2 border border-border rounded-md"
                      placeholder="VD: 0987654321"
                      value={dPhone}
                      onChange={(e) => setDPhone(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="form-group">
                      <label className="text-xs font-semibold">Số Bằng Lái</label>
                      <input
                        type="text"
                        className="w-full text-sm p-2 border border-border rounded-md"
                        value={dLicenseNumber}
                        onChange={(e) => setDLicenseNumber(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="text-xs font-semibold">Hạng Bằng</label>
                      <input
                        type="text"
                        className="w-full text-sm p-2 border border-border rounded-md"
                        placeholder="B2, C, D..."
                        value={dLicenseClass}
                        onChange={(e) => setDLicenseClass(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="text-xs font-semibold">Trạng Thái Làm Việc</label>
                    <select
                      className="w-full text-sm p-2 border border-border rounded-md"
                      value={dStatus}
                      onChange={(e) => setDStatus(e.target.value)}
                    >
                      <option value="Sẵn sàng">Sẵn sàng nhận chuyến</option>
                      <option value="Nghỉ">Đang nghỉ phép</option>
                      <option value="Ngưng hoạt động">Ngưng hoạt động</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="text-xs font-semibold">Ghi Chú</label>
                    <textarea
                      rows="2"
                      className="w-full text-sm p-2 border border-border rounded-md"
                      value={dNotes}
                      onChange={(e) => setDNotes(e.target.value)}
                    />
                  </div>
                  <FieldGroup className="mt-2">
                    <Field orientation="horizontal">
                      <Checkbox
                        id="dActive"
                        checked={dActive}
                        onCheckedChange={(checked) => setDActive(!!checked)}
                      />
                      <FieldLabel htmlFor="dActive" className="text-xs font-semibold select-none cursor-pointer">
                        Kích hoạt tài xế
                      </FieldLabel>
                    </Field>
                  </FieldGroup>
                  <button className="btn btn-primary w-full mt-4" onClick={handleSaveDriver}>Lưu Thông Tin</button>
                </>
              )}

              {/* Form Type */}
              {activeTab === 'types' && (
                <>
                  <div className="form-group">
                    <label className="text-xs font-semibold">Tên Loại Xe <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="w-full text-sm p-2 border border-border rounded-md"
                      placeholder="VD: SUV 7 chỗ"
                      value={tTypeName}
                      onChange={(e) => setTTypeName(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-xs font-semibold">Mô Tả</label>
                    <textarea
                      rows="3"
                      className="w-full text-sm p-2 border border-border rounded-md"
                      value={tDescription}
                      onChange={(e) => setTDescription(e.target.value)}
                    />
                  </div>
                  <FieldGroup className="mt-2">
                    <Field orientation="horizontal">
                      <Checkbox
                        id="tActive"
                        checked={tActive}
                        onCheckedChange={(checked) => setTActive(!!checked)}
                      />
                      <FieldLabel htmlFor="tActive" className="text-xs font-semibold select-none cursor-pointer">
                        Kích hoạt loại xe
                      </FieldLabel>
                    </Field>
                  </FieldGroup>
                  <button className="btn btn-primary w-full mt-4" onClick={handleSaveType}>Lưu Loại Xe</button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
