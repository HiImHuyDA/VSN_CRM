// src/components/tasks/TaskCard.jsx
// Component render 1 task - hiển thị các field tương ứng với loại task
import { useState, useEffect } from 'react';
import AutocompleteInput from '../ui/AutocompleteInput';
import CalendarChecker from './CalendarChecker';

// Mapping tên task → icon
const TASK_ICONS = {
  'Bảng chào': '🪧',
  'Chuẩn bị xe': '🚗',
  'Chuẩn bị xe (từ sân bay)': '🚗',
  'Chuẩn bị xe (Từ VSN đi VSN-NT)': '🚗',
  'Book vé máy bay': '✈️',
  'Book Phòng Họp': '🏢',
  'Phòng họp': '🏢',
  'Chuẩn bị phòng họp': '🏢',
  'Chuẩn bị cơm trưa': '🍱',
  'Book nhà hàng ăn tối': '🍽️',
  'Chuẩn bị nội dung họp/Sample': '📄',
  'Chuẩn bị Mẫu theo nội dung họp': '📦',
  'Trình bày profile VSN': '📊',
  'Trình bày profile VDC': '📊',
  'Trình bày profile VSDN': '📊',
  'Trình bày profile VAC': '📊',
  'Trình bày profile VSN-NT': '📊',
  'Chuẩn bị hiện trường': '🏭',
  'Chuẩn bị khác': '📌',
};

// Task nào dùng field đặc biệt
// isCarTask: các task "Chuẩn bị xe..." CẦN khai báo loại phương tiện + số người đi,
// NGOẠI TRỪ "Chuẩn bị xe (từ sân bay)" - task này không cần khai báo 2 field đó.
const isCarTask = n => (n.includes('xe') || n.includes('Xe')) && !n.includes('từ sân bay');
const isFlightTask = n => n.includes('vé máy bay') || n.includes('Vé máy bay');
const isMealTask = n => n.includes('cơm trưa') || n.includes('nhà hàng');
// isBookRoomTask: CHỈ áp dụng cho task "Book Phòng Họp" - có chọn phòng, giờ họp, check lịch trống.
// "Chuẩn bị phòng họp" / "Phòng họp" (task khác) KHÔNG cần các field này.
const isBookRoomTask = n => n.includes('Book Phòng Họp') || n.includes('Book phòng họp');

// Danh sách loại phương tiện cho combobox "Chuẩn bị xe"
const VEHICLE_TYPES = [
  'Xe công ty',
  'Máy bay',
  'Tàu hỏa',
  'Xe khách',
  'Xe thuê ngoài (Grab/Taxi)',
  'Tự túc',
];

export default function TaskCard({
  task,
  onChange,
  onRemove,
  configLists = {},
  onboardDate,
  customerName,
  guestReps,
}) {
  const set = (key, val) => onChange({ ...task, [key]: val });
  const icon = TASK_ICONS[task.taskName] || '📌';
  const isCompulsory = task.compulsory === 'Y';

  const [historyBooks, setHistoryBooks] = useState([]);

  // Fetch lịch sử book nhà hàng của khách hàng này
  useEffect(() => {
    const isDinner = task.taskName && task.taskName.includes('nhà hàng');
    const isLunchEatOut = task.taskName && task.taskName.includes('cơm trưa') && task.eatOut;
    if ((isDinner || isLunchEatOut) && customerName) {
      fetch(`/api/submissions/recommend-restaurants?customerName=${encodeURIComponent(customerName)}`)
        .then(res => res.json())
        .then(res => {
          if (res.success) {
            setHistoryBooks(res.data || []);
          }
        })
        .catch(err => console.error('Lỗi lấy lịch sử đặt nhà hàng:', err));
    }
  }, [customerName, task.taskName, task.eatOut]);

  // Lấy các đề xuất nhà hàng ăn tối
  const getRecommendedRestaurants = () => {
    if (!configLists.dinnerRaw) return [];

    // 1. Phân loại Level từ chức vụ
    const getLevelFromTitle = (title) => {
      if (!title) return 3;
      const t = title.toLowerCase().trim();
      const level1Aliases = ['ceo', 'founder', 'chairman', 'president', 'bod', 'chief executive officer', 'chủ tịch', 'tổng giám đốc'];
      const level2Aliases = [
        'director', 'vp', 'vice president', 'coo', 'chief operation officer', 'chief operating officer',
        'head', 'head manager', 'giám đốc kinh doanh', 'giám đốc', 'trưởng bộ phận', 'cdo', 'cfo', 'cto'
      ];
      if (level1Aliases.some(alias => t.includes(alias))) return 1;
      if (level2Aliases.some(alias => t.includes(alias))) return 2;
      return 3;
    };

    let reps = [];
    if (guestReps) {
      if (typeof guestReps === 'string') {
        try { reps = JSON.parse(guestReps); } catch (e) { }
      } else if (Array.isArray(guestReps)) {
        reps = guestReps;
      }
    }

    const maxLevel = reps.length > 0
      ? Math.min(...reps.map(r => getLevelFromTitle(r.title)))
      : 3;

    // 2. Phân loại Ẩm thực mong muốn từ Lưu ý ăn uống
    const cuisinesWanted = [];
    reps.forEach(r => {
      const note = String(r.mealNote || '').toLowerCase();
      if (note.includes('âu') || note.includes('tây') || note.includes('western')) cuisinesWanted.push('Âu');
      if (note.includes('việt') || note.includes('ta') || note.includes('vietnam')) cuisinesWanted.push('Việt');
      if (note.includes('nhật') || note.includes('sushi') || note.includes('japan')) cuisinesWanted.push('Nhật');
      if (note.includes('chay') || note.includes('vegan') || note.includes('vegetarian')) cuisinesWanted.push('Chay');
    });

    // 3. Parse thông tin nhà hàng và tính toán độ khớp
    const parsedRestaurants = configLists.dinnerRaw.map(item => {
      let meta = {};
      try { meta = item.JsonData ? JSON.parse(item.JsonData) : {}; } catch (e) { }

      const rName = item.Name;
      const rLevel = String(meta.level || '').toLowerCase();
      const rCuisine = meta.cuisine || '';
      const rating = parseFloat(meta.rating) || parseFloat(item.avgRating) || 5.0;

      // Check level match
      let levelMatch = false;
      if (maxLevel === 1 && rLevel.includes('ceo')) levelMatch = true;
      if (maxLevel === 2 && (rLevel.includes('director') || rLevel.includes('head') || rLevel.includes('coo'))) levelMatch = true;
      if (maxLevel === 3 && (rLevel.includes('manager') || rLevel.includes('staff'))) levelMatch = true;

      // Check cuisine match
      const cuisineMatch = cuisinesWanted.length > 0 && cuisinesWanted.includes(rCuisine);

      // Check book history
      const hist = historyBooks.find(h => h.MealOption === rName);
      const isBookedBefore = !!hist;
      const bookCount = hist ? hist.BookCount : 0;

      return {
        name: rName,
        meta,
        levelMatch,
        cuisineMatch,
        isBookedBefore,
        bookCount,
        rating
      };
    });

    // 4. Phân nhóm và sắp xếp
    const group1 = parsedRestaurants.filter(r => r.isBookedBefore).sort((a, b) => b.bookCount - a.bookCount);
    const group2 = parsedRestaurants.filter(r => !r.isBookedBefore && r.levelMatch && r.cuisineMatch).sort((a, b) => b.rating - a.rating);
    const group3 = parsedRestaurants.filter(r => !r.isBookedBefore && r.levelMatch && !r.cuisineMatch).sort((a, b) => b.rating - a.rating);
    const group4 = parsedRestaurants.filter(r => !r.isBookedBefore && !r.levelMatch).sort((a, b) => b.rating - a.rating);

    return [...group1, ...group2, ...group3, ...group4].slice(0, 5); // Lấy Top 5 đề xuất
  };

  const recommendations = (task.taskName.includes('nhà hàng') || (task.taskName.includes('trưa') && task.eatOut)) ? getRecommendedRestaurants() : [];

  const selectedRestaurant = (task.taskName.includes('nhà hàng') || (task.taskName.includes('trưa') && task.eatOut)) && task.mealOption
    ? (configLists.dinnerRaw || []).find(r => r.Name === task.mealOption)
    : null;

  let restMeta = {};
  if (selectedRestaurant && selectedRestaurant.JsonData) {
    try { restMeta = JSON.parse(selectedRestaurant.JsonData); } catch (e) { }
  }

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

  return (
    <div className={`task-card${isCompulsory ? ' compulsory' : ''}`}>
      {/* Header */}
      <div className="task-card-header">
        <div className="task-card-title" style={{ cursor: 'pointer' }} onClick={onRemove}>
          <input
            type="checkbox"
            checked={true}
            onChange={() => { }} // onClick on container handles it
            style={{ width: 'auto', marginRight: 8, cursor: 'pointer' }}
          />
          <span>{icon}</span>
          <span>{task.taskName}</span>
          {isCompulsory && <span className="badge badge-compulsory">Bắt buộc</span>}
        </div>
        <button className="btn btn-icon btn-danger btn-sm" onClick={onRemove} title="Xóa task">✕</button>
      </div>

      <div className="form-grid">
        {/* Chi tiết công việc */}
        <div className="form-group full-width">
          <label>Chi tiết công việc</label>
          <textarea
            rows={2}
            value={task.taskDetail || ''}
            onChange={e => set('taskDetail', e.target.value)}
            placeholder="Mô tả chi tiết..."
          />
        </div>

        {/* --- Block Assignee, Supervisor, Attendees --- */}
        {(() => {
          const renderPersonInput = (label, nameField, emailField, isMultiple = false) => (
            <div className="form-group full-width" style={{ background: 'rgba(0,0,0,0.02)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--color-outline-variant)' }}>
              <div style={{ fontWeight: 600, marginBottom: 12, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>person</span>
                {label}
              </div>

              <div className="form-group mb-3">
                <label style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Tìm kiếm từ danh bạ VSN (tự điền tên & email)</label>
                <AutocompleteInput
                  value=""
                  onChange={() => { }}
                  onSelect={item => {
                    if (isMultiple) {
                      const names = (task[nameField] || '').split(',').map(s => s.trim()).filter(Boolean);
                      const emails = (task[emailField] || '').split(';').map(s => s.trim()).filter(Boolean);
                      if (!names.includes(item.label)) {
                        names.push(item.label);
                        if (item.email) emails.push(item.email);
                      }
                      onChange({ ...task, [nameField]: names.join(', '), [emailField]: emails.join('; ') });
                    } else {
                      onChange({ ...task, [nameField]: item.label, [emailField]: item.email || task[emailField] });
                    }
                  }}
                  staticList={configLists.employees}
                  placeholder="Gõ tên nhân viên để chọn..."
                  clearAfterSelect
                />
              </div>

              <div className="form-grid-2" style={{ gap: 12 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Tên {isMultiple ? '(phân cách bằng dấu phẩy)' : '(nhập tay nếu ngoài VSN)'}</label>
                  <input
                    type="text"
                    value={task[nameField] || ''}
                    onChange={e => set(nameField, e.target.value)}
                    placeholder={isMultiple ? "Nguyễn Văn A, Trần Thị B..." : "Họ và tên..."}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Email {isMultiple ? '(phân cách bằng dấu chấm phẩy)' : ''}</label>
                  <input
                    type="text"
                    value={task[emailField] || ''}
                    onChange={e => {
                      const newVal = autoSemicolon(e.target.value, task[emailField] || '');
                      set(emailField, newVal);
                    }}
                    placeholder={isMultiple ? "a@vietsun.com; b@vietsun.com" : "Email..."}
                  />
                </div>
              </div>
            </div>
          );

          return (
            <div className="flex flex-col full-width" style={{ gap: 16, gridColumn: '1 / -1' }}>
              {renderPersonInput('Người đảm nhiệm', 'assignee', 'assigneeEmail', true)}
              {renderPersonInput('Giám sát', 'supervisor', 'supervisorEmail', true)}
              {renderPersonInput('Người tham gia (riêng Task này)', 'taskAttendees', 'taskAttendeesEmail', true)}
            </div>
          );
        })()}

        {/* ── Fields đặc biệt theo loại task ── */}

        {/* Chuẩn bị xe */}
        {isCarTask(task.taskName) && (<>
          <div className="form-group">
            <label>Loại phương tiện</label>
            <select value={task.vehicle || ''}
              onChange={e => set('vehicle', e.target.value)}>
              <option value="">-- Chọn --</option>
              {VEHICLE_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Số người đi</label>
            <input type="text" value={task.passengerCount || ''}
              onChange={e => set('passengerCount', e.target.value)}
              placeholder="VD: 4" />
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={!!task.includeGuests}
                onChange={e => set('includeGuests', e.target.checked)}
                style={{ width: 'auto', marginRight: 6 }} />
              Khách đi cùng xe
            </label>
          </div>
        </>)}

        {/* Book vé máy bay */}
        {isFlightTask(task.taskName) && (<>
          <div className="form-group">
            <label>Chặng bay</label>
            <input type="text" value={task.flightRoute || ''}
              onChange={e => set('flightRoute', e.target.value)}
              placeholder="VD: SGN → HAN" />
          </div>
          <div className="form-group">
            <label>Số vé / người</label>
            <input type="text" value={task.passengerCount || ''}
              onChange={e => set('passengerCount', e.target.value)}
              placeholder="VD: 2 vé" />
          </div>
          <div className="form-group">
            <label>Ngày về</label>
            <input type="date" value={task.returnDate || ''}
              onChange={e => set('returnDate', e.target.value)} />
          </div>
        </>)}

        {/* Bữa ăn */}
        {isMealTask(task.taskName) && (
          <div className="form-group full-width">
            <label>Thực đơn / Nhà hàng</label>

            {task.taskName.includes('trưa') && (
              <div className="flex items-center space-x-2 mb-2.5">
                <input
                  type="checkbox"
                  id={`eat-out-${task._id}`}
                  checked={!!task.eatOut}
                  onChange={e => {
                    const checked = e.target.checked;
                    // Reset mealOption khi đổi loại hình ăn uống
                    onChange({ ...task, eatOut: checked, mealOption: '' });
                  }}
                  className="w-4 h-4 text-primary focus:ring-primary border-outline rounded cursor-pointer"
                  style={{ width: 'auto', marginRight: 6 }}
                />
                <label htmlFor={`eat-out-${task._id}`} className="text-xs font-semibold text-primary cursor-pointer select-none">
                  🍽️ Ăn ngoài với khách (sử dụng danh sách nhà hàng ăn tối)
                </label>
              </div>
            )}

            <select value={task.mealOption || ''}
              onChange={e => set('mealOption', e.target.value)}>
              <option value="">-- Chọn --</option>
              {((task.taskName.includes('trưa') && !task.eatOut)
                ? configLists.lunchList
                : configLists.dinnerList
              )?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>

            {/* Hiển thị danh sách đề xuất quick select nếu là nhà hàng tối hoặc trưa ăn ngoài */}
            {recommendations.length > 0 && (
              <div className="mt-2.5">
                <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                  ⭐ Gợi ý hàng đầu (Khớp Level & lịch sử):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {recommendations.map(r => (
                    <button
                      key={r.name}
                      type="button"
                      onClick={() => set('mealOption', r.name)}
                      className={`px-2.5 py-1 text-xs rounded-full border transition-all cursor-pointer font-medium ${task.mealOption === r.name
                          ? 'bg-primary/10 border-primary text-primary font-bold'
                          : 'bg-white hover:bg-surface-container-low border-outline-variant text-on-surface'
                        }`}
                    >
                      {r.name.split('-')[1] || r.name} {/* Chỉ hiển thị tên ngắn gọn */}
                      {r.isBookedBefore && <span className="ml-1 text-[10px] text-primary/80">({r.bookCount}L)</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Panel hiển thị thông tin chi tiết nhà hàng được chọn */}
            {selectedRestaurant && (
              <div className="mt-3 bg-surface-container rounded-xl p-3 border border-outline-variant text-xs space-y-2" style={{ backgroundColor: '#f3f4f6', borderRadius: '12px', padding: '12px', border: '1px solid #e5e7eb' }}>
                <div className="flex justify-between border-b border-outline-variant/60 pb-1.5 mb-1.5" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #d1d5db', paddingBottom: '6px', marginBottom: '6px' }}>
                  <span className="font-bold text-[13px] text-primary" style={{ fontWeight: 'bold', color: '#2563eb' }}>{selectedRestaurant.Name}</span>
                  {restMeta.rating && <span className="text-amber-500 font-bold" style={{ color: '#f59e0b', fontWeight: 'bold' }}>★ {restMeta.rating}</span>}
                </div>
                <div className="grid grid-cols-2 gap-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div><strong>Phân loại Level:</strong> {restMeta.level || 'CEO/Director/COO'}</div>
                  <div><strong>Ẩm thực:</strong> {restMeta.cuisine || 'Chưa phân loại'}</div>
                  <div><strong>Không gian:</strong> {restMeta.space || '—'}</div>
                  <div><strong>Giá 4 pax (ước tính):</strong> {restMeta.price4Pax || '—'}</div>
                </div>
                {restMeta.feedback && (
                  <div className="pt-1.5 border-t border-outline-variant/60" style={{ paddingTop: '6px', borderTop: '1px solid #e5e7eb' }}>
                    <strong>Đánh giá & Phản hồi:</strong> {restMeta.feedback}
                  </div>
                )}
                {restMeta.comments && (
                  <div className="pt-1 border-t border-outline-variant/60 italic text-on-surface-variant" style={{ paddingTop: '4px', borderTop: '1px solid #e5e7eb', fontStyle: 'italic', color: '#4b5563' }}>
                    " {restMeta.comments} "
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Phòng họp - CHỈ áp dụng cho task "Book Phòng Họp", không áp dụng cho "Chuẩn bị phòng họp" */}
        {isBookRoomTask(task.taskName) && (<>
          <div className="form-group">
            <label>Phòng họp</label>
            <select value={task.meetingRoom || ''}
              onChange={e => {
                const room = e.target.value;
                const email = configLists.meetingRoomEmails?.[room] || '';
                onChange({ ...task, meetingRoom: room, meetingRoomEmail: email });
              }}>
              {configLists.meetingRooms?.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Giờ bắt đầu</label>
            <input type="time" value={task.meetingStartTime || ''}
              onChange={e => set('meetingStartTime', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Giờ kết thúc</label>
            <input type="time" value={task.meetingEndTime || ''}
              onChange={e => set('meetingEndTime', e.target.value)} />
          </div>
          {/* Kiểm tra lịch phòng họp */}
          {task.meetingRoomEmail && onboardDate && (
            <div className="form-group full-width">
              <CalendarChecker
                roomEmail={task.meetingRoomEmail}
                roomName={task.meetingRoom}
                date={onboardDate}
                startTime={task.meetingStartTime}
                endTime={task.meetingEndTime}
              />
            </div>
          )}
        </>)}

        {/* Lead time info */}
        <div className="form-group full-width">
          <p className="text-muted text-sm" style={{ marginTop: 4 }}>
            ⏰ Deadline sẽ được SQL Server tính tự động: <strong>{onboardDate || '(chọn ngày tiếp đón)'}</strong> − {task.leadTime || 1} ngày làm việc
          </p>
        </div>
      </div>
    </div>
  );
}
