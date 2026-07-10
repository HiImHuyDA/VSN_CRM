// src/components/form/GeneralInfoForm.jsx
import { useEffect, useState, useCallback } from 'react';
import AutocompleteInput from '../ui/AutocompleteInput';
import { getSuppliers, getCustomers, searchEmployees } from '../../services/api';

const CUSTOMER_TYPES = [
  { value: 'Brand', label: 'Brand' },
  { value: 'Supplier', label: 'Nhà cung cấp' },
  { value: 'Partner', label: 'Partner' },
  { value: 'Khách vãng lai', label: 'Khách vãng lai' },
  { value: 'Ứng viên phỏng vấn', label: 'Ứng viên phỏng vấn' }
];
const SALUTATIONS    = ['Mr', 'Ms', 'Dr', 'Prof'];

export default function GeneralInfoForm({ data, onChange, mode }) {
  const filteredCustomerTypes = CUSTOMER_TYPES.filter(t => {
    if (mode === 'brand') return t.value === 'Brand';
    if (mode === 'guest') return t.value !== 'Brand';
    return true;
  });
  const [brandList,    setBrandList]    = useState([]);
  const [partnerList,  setPartnerList]  = useState([]);
  const [supplierRepsList, setSupplierRepsList] = useState([]);
  const [supplierList, setSupplierList] = useState([]);
  const [employees,    setEmployees]    = useState([]);
  const [loadingSupp,  setLoadingSupp]  = useState(false);
  const [showAddRepDropdown, setShowAddRepDropdown] = useState(false);

  /* ─── Load danh sách khách hàng từ DB ─────────────────────── */
  useEffect(() => {
    getCustomers('Brand').then(r   => setBrandList((r.data || []).filter(c => c.IsActive))).catch(() => {});
    getCustomers('Partner').then(r => setPartnerList((r.data || []).filter(c => c.IsActive))).catch(() => {});
    getCustomers('Supplier').then(r => setSupplierRepsList((r.data || []).filter(c => c.IsActive))).catch(() => {});
  }, []);

  /* ─── Load Supplier từ Bravo_TRE khi chọn loại Supplier ───── */
  useEffect(() => {
    if (data.customerType === 'Supplier' && !supplierList.length) {
      setLoadingSupp(true);
      getSuppliers().then(r => setSupplierList(r.data || [])).catch(() => {}).finally(() => setLoadingSupp(false));
    }
  }, [data.customerType]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClose = () => setShowAddRepDropdown(false);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

  /* ─── Load Employees cho autocomplete ──────────────────────── */
  useEffect(() => {
    searchEmployees('').then(r => {
      setEmployees((r.data || []).map(e => ({ label: e.FullName, email: e.Email, value: e.MNV })));
    }).catch(() => {});
  }, []);

  const set = (key, val) => onChange({ ...data, [key]: val });

  const autoSemicolon = (val, prevVal = '') => {
    if (!val) return val;
    if (val.length < prevVal.length) return val;
    const lower = val.toLowerCase();
    if ((lower.endsWith('.com') && !prevVal.toLowerCase().endsWith('.com')) ||
        (lower.endsWith('.vn') && !prevVal.toLowerCase().endsWith('.vn'))) {
      return val + '; ';
    }
    return val;
  };

  // Sync isExisting flags for loaded reps
  useEffect(() => {
    if (!data.customerName || !data.guestReps || data.guestReps.length === 0) return;
    
    let matchedConfig = null;
    if (data.customerType === 'Supplier') {
      matchedConfig = supplierRepsList.find(c => c.Name === data.customerName);
    } else if (data.customerType === 'Brand') {
      matchedConfig = brandList.find(c => c.Name === data.customerName);
    } else if (data.customerType === 'Partner') {
      matchedConfig = partnerList.find(c => c.Name === data.customerName);
    }
    
    let dbReps = [];
    if (matchedConfig && matchedConfig.JsonData) {
      try { dbReps = JSON.parse(matchedConfig.JsonData) || []; } catch(e){}
    }
    
    let hasChanges = false;
    const updatedReps = data.guestReps.map(r => {
      if (r.isExisting !== undefined) return r;
      const exists = dbReps.some(dbRep => (dbRep.name || '').toLowerCase().trim() === (r.name || '').toLowerCase().trim());
      hasChanges = true;
      return { ...r, isExisting: exists };
    });
    
    if (hasChanges) {
      onChange({ ...data, guestReps: updatedReps });
    }
  }, [data.customerName, data.customerType, brandList, partnerList, supplierRepsList, data.guestReps]);

  /* ─── Lấy list khách hàng theo loại ────────────────────────── */
  const getCustomerList = () => {
    if (data.customerType === 'Brand')    return brandList.map(c => ({ label: c.Name, value: c.Id, jsonData: c.JsonData }));
    if (data.customerType === 'Supplier') return supplierList.map(s => ({ label: s.TenKhachHang || s.Name || s, value: s.Id || s }));
    if (data.customerType === 'Partner')  return partnerList.map(c => ({ label: c.Name, value: c.Id, jsonData: c.JsonData }));
    return [];
  };

  /* ─── Khi chọn Khách hàng: tự động load Đại diện mặc định ─── */
  const handleCustomerSelect = (item) => {
    let reps = [];
    let matchedConfig = null;
    
    if (data.customerType === 'Supplier') {
      matchedConfig = supplierRepsList.find(c => c.Name === item.label);
    } else {
      const list = data.customerType === 'Brand' ? brandList : partnerList;
      matchedConfig = list.find(c => c.Name === item.label);
    }
    
    if (matchedConfig && matchedConfig.JsonData) {
      try {
        reps = JSON.parse(matchedConfig.JsonData);
      } catch (e) {}
    }
    
    onChange({
      ...data,
      customerName: item.label,
      guestReps: reps.map(r => ({ ...r, isExisting: true })),
    });
  };

  /* ─── Quản lý Đại diện khách (guestReps array) ─────────────── */
  const reps = data.guestReps || [];

  const addRep = () => {
    onChange({ ...data, guestReps: [...reps, { salutation: 'Mr', name: '', email: '', title: '', mealNote: '', extraNote: '', isExisting: false }] });
  };

  const removeRep = (idx) => {
    onChange({ ...data, guestReps: reps.filter((_, i) => i !== idx) });
  };

  const updateRep = (idx, field, val) => {
    const updated = reps.map((r, i) => i === idx ? { ...r, [field]: val } : r);
    onChange({ ...data, guestReps: updated });
  };

  const getAddRepOptions = () => {
    let matchedConfig = null;
    if (data.customerType === 'Supplier') {
      matchedConfig = supplierRepsList.find(c => c.Name === data.customerName);
    } else if (data.customerType === 'Brand') {
      matchedConfig = brandList.find(c => c.Name === data.customerName);
    } else if (data.customerType === 'Partner') {
      matchedConfig = partnerList.find(c => c.Name === data.customerName);
    }
    
    let dbReps = [];
    if (matchedConfig && matchedConfig.JsonData) {
      try { dbReps = JSON.parse(matchedConfig.JsonData) || []; } catch(e){}
    }
    
    const currentNames = (data.guestReps || []).map(r => (r.name || '').toLowerCase().trim());
    return dbReps.filter(dbRep => dbRep.name && !currentNames.includes(dbRep.name.toLowerCase().trim()));
  };

  /* ─── Autocomplete tìm tên người tham dự VSN ───────────────── */
  const attendeesList = employees;

  const handleAttendeeSelect = (item) => {
    const names  = (data.attendees      || '').split(',').map(s => s.trim()).filter(Boolean);
    const emails = (data.attendeesEmail || '').split(';').map(s => s.trim()).filter(Boolean);
    if (!names.includes(item.label)) {
      names.push(item.label);
      if (item.email) emails.push(item.email);
    }
    onChange({ ...data, attendees: names.join(', '), attendeesEmail: emails.join('; ') });
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-icon">📝</div>
        <h2 className="card-title">Thông Tin Chung</h2>
      </div>

      {/* ── Người trình duyệt ───────────────────────────── */}
      <div className="section-title" style={{ fontWeight: 800, fontSize: '14px', color: 'var(--color-text)' }}>
        <span>Người trình duyệt</span>
      </div>
      <div className="form-grid mb-6">
        <div className="form-group">
          <label htmlFor="submitterName">Họ và tên <span className="required">*</span></label>
          <input
            id="submitterName"
            value={data.submitterName || ''}
            readOnly
            style={{ background: 'var(--color-bg)', cursor: 'not-allowed' }}
          />
        </div>
        <div className="form-group">
          <label htmlFor="submitterEmail">Email <span className="required">*</span></label>
          <input id="submitterEmail" type="email" value={data.submitterEmail || ''} readOnly style={{ background: 'var(--color-bg)', cursor: 'not-allowed' }} />
        </div>
        <div className="form-group">
          <label htmlFor="submitterMNV">Mã nhân viên</label>
          <input id="submitterMNV" value={data.submitterMNV || ''} onChange={e => set('submitterMNV', e.target.value)} placeholder="VD: VSN001" readOnly style={{ background: 'var(--color-bg)', cursor: 'default' }} />
        </div>
      </div>

      {/* ── Thông tin khách hàng ────────────────────────── */}
      <div className="section-title" style={{ fontWeight: 800, fontSize: '14px', color: 'var(--color-text)' }}>Thông tin khách hàng</div>
      <div className="form-grid mb-4">
        <div className="form-group">
          <label htmlFor="customerType">Loại khách <span className="required">*</span></label>
          <select 
            id="customerType" 
            value={data.customerType || ''} 
            onChange={e => {
              const customerType = e.target.value;
              const isInterview = customerType === 'Ứng viên phỏng vấn';
              onChange({ 
                ...data, 
                customerType, 
                customerName: isInterview ? 'Ứng viên phỏng vấn' : '', 
                meetingTopic: isInterview ? 'Phỏng vấn' : '', 
                guestReps: [] 
              });
            }}
          >
            <option value="">-- Chọn loại khách --</option>
            {filteredCustomerTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        {data.customerType !== 'Ứng viên phỏng vấn' && (
          <div className="form-group">
            <label htmlFor="customerName">Tên khách hàng <span className="required">*</span></label>
            {loadingSupp ? <div className="input-placeholder">Đang tải dữ liệu nhà cung cấp...</div> : (
              <AutocompleteInput
                id="customerName"
                value={data.customerName || ''}
                onChange={v => set('customerName', v)}
                onSelect={handleCustomerSelect}
                staticList={getCustomerList()}
                placeholder={data.customerType ? 'Tìm hoặc nhập tên...' : 'Chọn loại khách trước'}
              />
            )}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="meetingTopic">
            {data.customerType === 'Ứng viên phỏng vấn' ? 'Nội dung chính' : 'Chủ đề tiếp đón'} <span className="required" style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <input 
            id="meetingTopic" 
            value={data.meetingTopic || ''} 
            onChange={e => set('meetingTopic', e.target.value)} 
            placeholder={data.customerType === 'Ứng viên phỏng vấn' ? 'Nội dung...' : 'Mục đích chuyến thăm...'} 
            readOnly={data.customerType === 'Ứng viên phỏng vấn'}
            style={data.customerType === 'Ứng viên phỏng vấn' ? { background: 'var(--color-bg)', cursor: 'not-allowed' } : {}}
          />
        </div>
      </div>

      {/* ── Đại diện khách hàng (Dynamic) ──────────────── */}
      <div className="section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, fontWeight: 800, fontSize: '14px', color: 'var(--color-text)' }}>
        <span>{data.customerType === 'Ứng viên phỏng vấn' ? 'Thông tin ứng viên' : 'Đại diện khách hàng'}</span>
        <div style={{ position: 'relative' }}>
          <button 
            className="btn btn-outline btn-sm" 
            onClick={(e) => {
              e.stopPropagation();
              setShowAddRepDropdown(!showAddRepDropdown);
            }}
          >
            {data.customerType === 'Ứng viên phỏng vấn' ? '+ Thêm ứng viên' : '+ Thêm đại diện'}
          </button>
          
          {showAddRepDropdown && (
            <div 
              className="autocomplete-dropdown" 
              style={{ 
                right: 0, 
                left: 'auto', 
                width: '240px', 
                padding: '4px 0', 
                display: 'flex', 
                flexDirection: 'column', 
                boxShadow: 'var(--shadow-md)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--r-md)',
                background: '#fff',
                zIndex: 100
              }}
            >
              {getAddRepOptions().map((dbRep, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    onChange({
                      ...data,
                      guestReps: [...reps, { ...dbRep, isExisting: true }]
                    });
                    setShowAddRepDropdown(false);
                  }}
                  className="autocomplete-item"
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    textAlign: 'left', 
                    width: '100%', 
                    padding: '8px 16px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    display: 'block'
                  }}
                >
                  {dbRep.salutation ? `${dbRep.salutation}. ` : ''}{dbRep.name}
                </button>
              ))}
              <button
                onClick={() => {
                  onChange({
                    ...data,
                    guestReps: [...reps, { salutation: 'Mr', name: '', email: '', title: '', mealNote: '', extraNote: '', isExisting: false }]
                  });
                  setShowAddRepDropdown(false);
                }}
                className="autocomplete-item"
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  textAlign: 'left', 
                  width: '100%', 
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  color: 'var(--color-primary)',
                  borderTop: getAddRepOptions().length > 0 ? '1px solid var(--color-border)' : 'none',
                  display: 'block'
                }}
              >
                + Thêm mới
              </button>
            </div>
          )}
        </div>
      </div>

      {reps.length === 0 ? (
        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--color-text-dimmed)', fontSize: 13, border: '1px dashed var(--color-border)', borderRadius: 8, marginBottom: 16 }}>
          {data.customerType === 'Ứng viên phỏng vấn' 
            ? 'Chưa có ứng viên nào. Nhấn "+ Thêm ứng viên" để bắt đầu.'
            : (data.customerName
                ? 'Chưa có đại diện. Nhấn "+ Thêm đại diện" hoặc cấu hình sẵn trong Danh mục Khách hàng.'
                : 'Chọn Khách hàng để tự động điền đại diện mặc định.')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {reps.map((rep, idx) => (
            <div key={idx} style={{ padding: '12px 16px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>
                  {data.customerType === 'Ứng viên phỏng vấn' ? `Ứng viên ${idx + 1}` : `Đại diện ${idx + 1}`} {rep.isExisting && <span style={{ color: 'var(--color-primary)', fontSize: '11px', marginLeft: '6px' }}>(Đã lưu)</span>}
                </span>
                <button onClick={() => removeRep(idx)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 13 }}>✕ Xóa</button>
              </div>
              <div className="form-grid-3">
                <div className="form-group">
                  <label>Xưng hô</label>
                  <select 
                    value={rep.salutation || 'Mr'} 
                    onChange={e => updateRep(idx, 'salutation', e.target.value)}
                    disabled={rep.isExisting === true}
                    style={rep.isExisting === true ? { background: 'var(--color-bg)', cursor: 'not-allowed' } : {}}
                  >
                    {SALUTATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Họ và Tên</label>
                  <input 
                    value={rep.name} 
                    onChange={e => updateRep(idx, 'name', e.target.value)} 
                    placeholder="Nhập họ và tên..." 
                    readOnly={rep.isExisting === true}
                    style={rep.isExisting === true ? { background: 'var(--color-bg)', cursor: 'not-allowed' } : {}}
                  />
                </div>
                <div className="form-group">
                  <label>Email đại diện</label>
                  <input 
                    type="email"
                    value={rep.email || ''} 
                    onChange={e => updateRep(idx, 'email', e.target.value)} 
                    placeholder="Nhập email..." 
                    readOnly={rep.isExisting === true}
                    style={rep.isExisting === true ? { background: 'var(--color-bg)', cursor: 'not-allowed' } : {}}
                  />
                </div>
              </div>
              <div className="form-grid-3">
                <div className="form-group">
                  <label>Chức vụ</label>
                  <input 
                    value={rep.title || ''} 
                    onChange={e => updateRep(idx, 'title', e.target.value)} 
                    placeholder="Giám đốc, Trưởng phòng..." 
                    readOnly={rep.isExisting === true}
                    style={rep.isExisting === true ? { background: 'var(--color-bg)', cursor: 'not-allowed' } : {}}
                  />
                </div>
                <div className="form-group">
                  <label>Lưu ý bữa ăn</label>
                  <input 
                    value={rep.mealNote || ''} 
                    onChange={e => updateRep(idx, 'mealNote', e.target.value)} 
                    placeholder="Ăn chay, dị ứng..." 
                    readOnly={rep.isExisting === true}
                    style={rep.isExisting === true ? { background: 'var(--color-bg)', cursor: 'not-allowed' } : {}}
                  />
                </div>
                <div className="form-group">
                  <label>Sở thích / Ghi chú</label>
                  <input 
                    value={rep.extraNote || ''} 
                    onChange={e => updateRep(idx, 'extraNote', e.target.value)} 
                    placeholder="Thích cà phê đen..." 
                    readOnly={rep.isExisting === true}
                    style={rep.isExisting === true ? { background: 'var(--color-bg)', cursor: 'not-allowed' } : {}}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Người tham dự VSN ───────────────────────────── */}
      {data.customerType === 'Brand' && (
        <>
          <div className="section-title" style={{ fontWeight: 800, fontSize: '14px', color: 'var(--color-text)' }}>
            Người tham dự (phía VSN) <span className="required" style={{ color: 'var(--color-danger)' }}>*</span>
          </div>
          <div className="mb-6">
            <div className="form-group mb-2">
              <label>Tìm và thêm người tham dự <span className="required" style={{ color: 'var(--color-danger)' }}>*</span></label>
              <AutocompleteInput
                value=""
                onChange={() => {}}
                onSelect={handleAttendeeSelect}
                staticList={attendeesList}
                placeholder="Gõ tên nhân viên để thêm..."
                clearAfterSelect
              />
            </div>
            {(data.attendees || data.attendeesEmail) && (
              <div style={{ padding: '10px 12px', background: 'var(--color-bg)', borderRadius: 8, fontSize: 13 }}>
                <div style={{ marginBottom: 4 }}><strong>Người tham dự:</strong> {data.attendees || '—'}</div>
                <div style={{ color: 'var(--color-text-muted)' }}><strong>Email:</strong> {data.attendeesEmail || '—'}</div>
              </div>
            )}
            <div className="form-grid mt-3">
              <div className="form-group">
                <label>Danh sách tên (phân cách bằng dấu ,) <span className="required" style={{ color: 'var(--color-danger)' }}>*</span></label>
                <input value={data.attendees || ''} onChange={e => set('attendees', e.target.value)} placeholder="Nguyễn Văn A, Trần Thị B, ..." />
              </div>
              <div className="form-group">
                <label>Email (phân cách bằng dấu ;)</label>
                <input 
                  value={data.attendeesEmail || ''} 
                  onChange={e => {
                    const newVal = autoSemicolon(e.target.value, data.attendeesEmail || '');
                    set('attendeesEmail', newVal);
                  }} 
                  placeholder="a@vietsun.com; b@vietsun.com" 
                />
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── File Agenda ─────────────────────────────────── */}
      {data.customerType === 'Brand' && (
        <>
          <div className="section-title" style={{ fontWeight: 800, fontSize: '14px', color: 'var(--color-text)' }}>File Agenda đính kèm {data.customerType === 'Brand' && <span className="required">*</span>}</div>
          <div className="form-group">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <input 
                type="file" 
                id="agendaFileInput"
                accept=".pdf,.doc,.docx,.xlsx,.pptx" 
                onChange={e => onChange({ ...data, agendaFile: e.target.files[0] })} 
                style={{ display: 'none' }} 
              />
              <button 
                type="button" 
                className="btn btn-outline" 
                onClick={() => document.getElementById('agendaFileInput').click()}
              >
                Chọn file...
              </button>
              
              <span style={{ fontSize: 13, color: data.agendaFile ? 'var(--color-primary)' : 'var(--color-text-muted)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {data.agendaFile ? `Đã chọn: ${data.agendaFile.name}` : (data.agendaAttachUrl ? 'Đã có file đính kèm trên hệ thống' : (data.customerType === 'Brand' ? 'Chưa chọn file nào' : 'Chưa chọn file nào (không bắt buộc)'))}
              </span>

              {data.agendaAttachUrl && !data.agendaFile && (
                <a 
                  href={data.agendaAttachUrl.startsWith('/api/') 
                    ? (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : '') + data.agendaAttachUrl 
                    : data.agendaAttachUrl} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="btn btn-ghost btn-sm"
                >
                  👁 Xem file
                </a>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
