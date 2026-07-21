import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Checkbox } from '../../components/ui/checkbox';
import { Field, FieldLabel } from '../../components/ui/field';
import ExcelImportModal from '../../components/ui/ExcelImportModal';

const CATEGORIES = [
  { value: 'DinnerRestaurant', label: '🍽️ Nhà hàng ăn tối' },
  { value: 'LunchMenu', label: '🥗 Menu bữa trưa' },
];

const RESTAURANT_LEVELS = [
  'CEO/Director/COO',
  'Director/Head Manager/Senior Staff',
  'Director/Head Manager/Staff',
  'Manager/Senior Staff',
  'Manager/Senior Staff/Staff'
];

const DINNER_COLUMNS = [
  { key: 'name', label: 'Tên nhà hàng', required: true, example: 'Việt-Cơm Niêu Sài Gòn' },
  { key: 'level', label: 'Phân loại Level', required: false, example: 'CEO/Director/COO', validationList: RESTAURANT_LEVELS },
  { key: 'cuisine', label: 'Ẩm thực', required: false, example: 'Việt', validationList: ['Việt', 'Âu', 'Nhật', 'Chay', 'Khác'] },
  { key: 'price4Pax', label: 'Giá 4 người (ước tính)', required: false, example: '~2.500.000 - 3.600.000' },
  { key: 'space', label: 'Không gian', required: false, example: 'Phòng VIP' },
  { key: 'isActive', label: 'Trạng thái', required: false, example: 'Hoạt động', validationList: ['Hoạt động', 'Ngưng hoạt động'] },
];

const LUNCH_COLUMNS = [
  { key: 'name', label: 'Tên thực đơn', required: true, example: 'Cơm tấm sườn + chả giò' },
  { key: 'isActive', label: 'Trạng thái', required: false, example: 'Hoạt động', validationList: ['Hoạt động', 'Ngưng hoạt động'] },
];

export default function RestaurantConfig() {
  const [activeTab, setActiveTab] = useState('DinnerRestaurant');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editLevel, setEditLevel] = useState('CEO/Director/COO');
  const [editCuisine, setEditCuisine] = useState('Việt');
  const [editPrice4Pax, setEditPrice4Pax] = useState('');
  const [editSpace, setEditSpace] = useState('');
  const [showImport, setShowImport] = useState(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('csr_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  };

  useEffect(() => { fetchItems(activeTab); }, [activeTab]);

  const fetchItems = async (cat) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/system-config/lists?category=${cat}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) setItems(data.data);
    } catch { toast.error('Lỗi tải dữ liệu'); }
    finally { setLoading(false); }
  };

  const handleAddNew = () => {
    setEditingId(0);
    setEditName('');
    setEditActive(true);
    setEditLevel('CEO/Director/COO');
    setEditCuisine('Việt');
    setEditPrice4Pax('');
    setEditSpace('');
  };
  const handleEdit = (item) => {
    setEditingId(item.Id);
    setEditName(item.Name);
    setEditActive(!!item.IsActive);
    let meta = {};
    try {
      meta = item.JsonData ? JSON.parse(item.JsonData) : {};
    } catch {
      meta = {};
    }
    setEditLevel(meta.level || 'CEO/Director/COO');
    setEditCuisine(meta.cuisine || 'Việt');
    setEditPrice4Pax(meta.price4Pax || '');
    setEditSpace(meta.space || '');
  };

  const handleSave = async () => {
    if (!editName.trim()) return toast.error('Vui lòng nhập tên');
    try {
      const payload = {
        id: editingId,
        category: activeTab,
        name: editName,
        isActive: editActive ? 1 : 0
      };
      if (activeTab === 'DinnerRestaurant') {
        payload.jsonData = {
          level: editLevel,
          cuisine: editCuisine,
          price4Pax: editPrice4Pax ? String(editPrice4Pax).trim() : '',
          space: editSpace
        };
      }
      const res = await fetch(window.location.origin + '/api/system-config/lists', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Đã lưu thành công');
        setEditingId(null);
        fetchItems(activeTab);
      } else toast.error(data.error || 'Lỗi khi lưu');
    } catch { toast.error('Lỗi kết nối'); }
  };

  const handleImport = async (rows) => {
    try {
      const res = await fetch(window.location.origin + '/api/system-config/lists/batch', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ rows, category: activeTab })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        if (data.errors?.length > 0) data.errors.forEach(e => toast.error(e, { duration: 6000 }));
        setShowImport(false);
        fetchItems(activeTab);
      } else toast.error(data.error || 'Lỗi khi import');
    } catch { toast.error('Lỗi kết nối'); }
  };


  return (
    <div className="w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-end mb-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface mb-1">Danh Mục Ăn Uống</h1>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 mb-6">
        {CATEGORIES.map(cat => (
          <button
            key={cat.value}
            className={`btn ${activeTab === cat.value ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => { setActiveTab(cat.value); setEditingId(null); }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="card overflow-hidden flex flex-col" style={{ flex: 1 }}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold">{CATEGORIES.find(c => c.value === activeTab)?.label}</h3>
            <div className="flex gap-2">
              <button className="btn btn-outline btn-sm gap-1" onClick={() => setShowImport(true)}>
                <span className="material-symbols-outlined text-[16px]">upload_file</span>
                Import Excel
              </button>
              <button className="btn btn-primary" onClick={handleAddNew}>+ Thêm mới</button>
            </div>
          </div>
          <div className="overflow-x-auto overflow-y-auto custom-scrollbar max-h-[calc(100vh-340px)]">
            {loading ? <p className="p-4">Đang tải...</p> : (
              <table className="data-table border-collapse">
              <thead>
                <tr>
                  <th className="sticky top-0 z-10 bg-white">Tên</th>
                  {activeTab === 'DinnerRestaurant' && (
                    <>
                      <th className="sticky top-0 z-10 bg-white">Phân loại Level</th>
                      <th className="sticky top-0 z-10 bg-white">Ẩm thực</th>
                      <th className="sticky top-0 z-10 bg-white">Giá 4 người (ước tính)</th>
                      <th className="sticky top-0 z-10 bg-white">Đánh giá TB</th>
                    </                    >
                  )}
                  <th className="sticky top-0 z-10 bg-white">Trạng thái</th>
                  <th className="sticky top-0 z-10 bg-white" style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  let meta = {};
                  try {
                    meta = item.JsonData ? JSON.parse(item.JsonData) : {};
                  } catch {
                    meta = {};
                  }
                  return (
                    <tr key={item.Id}>
                      <td className="font-medium">{item.Name}</td>
                      {activeTab === 'DinnerRestaurant' && (
                        <>
                          <td className="text-sm">{meta.level || '—'}</td>
                          <td className="text-sm">{meta.cuisine || '—'}</td>
                          <td className="text-sm">
                            {meta.price4Pax ? (
                              !isNaN(meta.price4Pax) && !isNaN(parseFloat(meta.price4Pax))
                                ? `${Number(meta.price4Pax).toLocaleString('vi-VN')} VND`
                                : String(meta.price4Pax)
                            ) : '—'}
                          </td>
                          <td className="text-sm font-bold text-amber-500">
                            {item.avgRating ? `★ ${item.avgRating} (${item.reviewCount})` : '—'}
                          </td>
                        </>
                      )}
                      <td>
                        <span className={item.IsActive ? 'badge badge-success' : 'badge badge-danger'}>
                          {item.IsActive ? 'Hoạt động' : 'Dừng'}
                        </span>
                      </td>
                      <td><button className="btn btn-ghost btn-sm" onClick={() => handleEdit(item)}>Sửa</button></td>
                    </tr>
                  );
                })}
                {!items.length && <tr><td colSpan={activeTab === 'DinnerRestaurant' ? 7 : 3} className="text-center text-muted">Chưa có dữ liệu. Dữ liệu sẽ được import từ cấu hình tĩnh.</td></tr>}
              </tbody>
            </table>
            )}
          </div>
        </div>

        {editingId !== null && (
          <div className="card" style={{ width: '100%', maxWidth: '390px', flexShrink: 0 }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold">{editingId === 0 ? 'Thêm mới' : 'Chỉnh sửa'}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>Đóng</button>
            </div>
            <div className="form-group mb-4">
              <label>Tên <span className="required">*</span></label>
              <textarea
                rows={3}
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder={activeTab === 'DinnerRestaurant' ? 'VD: Việt-Cơm Niêu Sài Gòn-27 Tú Xương, Q3...' : 'VD: Cơm tấm sườn + chả giò...'}
              />
            </div>

            {activeTab === 'DinnerRestaurant' && (
              <>
                <div className="form-group mb-4">
                  <label>Phân loại Level <span className="required">*</span></label>
                  <select value={editLevel} onChange={e => setEditLevel(e.target.value)}>
                    {RESTAURANT_LEVELS.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
                  </select>
                </div>
                <div className="form-group mb-4">
                  <label>Ẩm thực</label>
                  <select value={editCuisine} onChange={e => setEditCuisine(e.target.value)}>
                    {['Việt', 'Âu', 'Nhật', 'Chay', 'Khác'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group mb-4">
                  <label>Giá 4 người (ước tính)</label>
                  <input
                    type="text"
                    value={editPrice4Pax}
                    onChange={e => setEditPrice4Pax(e.target.value)}
                    placeholder="Ví dụ: ~2.500.000 - 3.600.000"
                  />
                </div>
                <div className="form-group mb-4">
                  <label>Không gian</label>
                  <input
                    type="text"
                    value={editSpace}
                    onChange={e => setEditSpace(e.target.value)}
                    placeholder="Ví dụ: Ngoài trời, Phòng VIP..."
                  />
                </div>
              </>
            )}

            <Field orientation="horizontal" className="mb-4 items-center">
              <Checkbox id="rest-active" checked={editActive} onCheckedChange={setEditActive} />
              <FieldLabel htmlFor="rest-active" className="cursor-pointer">Đang hoạt động</FieldLabel>
            </Field>
            <button className="btn btn-primary w-full justify-center mb-4" onClick={handleSave}>Lưu</button>

            {editingId > 0 && activeTab === 'DinnerRestaurant' && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <h4 className="font-bold text-gray-800 text-sm mb-3">Đánh giá & Phản hồi</h4>

                <div className="flex gap-4 items-center mb-4 bg-gray-50 p-3 rounded-xl">
                  <div className="text-center border-r border-gray-200 pr-4">
                    <div className="text-2xl font-black text-primary">
                      {items.find(x => x.Id === editingId)?.avgRating ? `⭐ ${items.find(x => x.Id === editingId).avgRating}` : '—'}
                    </div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">Điểm TB</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-800">
                      {items.find(x => x.Id === editingId)?.reviewCount || 0} lượt đánh giá
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      Đã sử dụng {items.find(x => x.Id === editingId)?.usageCount || 0} lần
                    </div>
                  </div>
                </div>

                <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block font-bold mb-2">Bình luận</span>
                  {!items.find(x => x.Id === editingId)?.comments || items.find(x => x.Id === editingId).comments.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Chưa có bình luận nào.</p>
                  ) : (
                    items.find(x => x.Id === editingId).comments.map((c, i) => (
                      <div key={i} className="p-2.5 bg-gray-50/50 border border-gray-100 rounded-lg space-y-1">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="font-bold text-gray-700">{c.reviewerName || 'Ẩn danh'}</span>
                          <span className="text-gray-400">{new Date(c.createdAt).toLocaleDateString('vi-VN')}</span>
                        </div>
                        <div className="text-xs text-amber-500 font-bold">
                          {'★'.repeat(c.rating)}{'☆'.repeat(5 - c.rating)}
                        </div>
                        <p className="text-xs text-gray-600 italic">"{c.comment}"</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showImport && (
        <ExcelImportModal
          title={activeTab === 'DinnerRestaurant' ? 'Import danh sách nhà hàng' : 'Import danh sách thực đơn bữa trưa'}
          templateName={activeTab === 'DinnerRestaurant' ? 'template_nha_hang.xlsx' : 'template_thuc_don.xlsx'}
          columns={activeTab === 'DinnerRestaurant' ? DINNER_COLUMNS : LUNCH_COLUMNS}
          onImport={handleImport}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
