// src/components/agenda/AgendaSection.jsx
import { useState } from 'react';
import { generateUUID } from '../../utils/helpers';

const CONTENT_TYPES = [
  'Đón khách', 'Trả khách', 'Di chuyển', 'Ăn sáng', 'Ăn trưa', 'Ăn tối',
  'Họp / Thảo luận', 'Trình bày Profile công ty', 'Tham quan nhà máy',
  'Tham quan showroom', 'Ký kết hợp đồng', 'Nghỉ ngơi',
  'Check-in khách sạn', 'Check-out khách sạn', 'Vui chơi / Giải trí', 'Khác'
];

const CANDIDATE_CONTENT_TYPES = ['Vào cổng', 'Trao đổi', 'Phỏng vấn', 'Ra cổng'];

const newItem = (destination, isCandidate) => ({
  _id: generateUUID(),
  destination,
  timeStart: '08:00',
  timeEnd: '09:00',
  contentType: isCandidate ? 'Phỏng vấn' : 'Họp / Thảo luận',
  detail: '',
  location: '',
  note: '',
});

function TimeInput({ value, onChange }) {
  return (
    <input
      type="time"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-2 py-1.5 bg-surface border border-outline-variant rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
    />
  );
}

function AgendaItem({ item, onChange, onRemove, isCandidate }) {
  const set = (k, v) => onChange({ ...item, [k]: v });
  const types = isCandidate ? CANDIDATE_CONTENT_TYPES : CONTENT_TYPES;
  return (
    <div className="grid grid-cols-[100px_100px_220px_1fr_40px] gap-3 items-center py-2 border-b border-outline-variant last:border-0 hover:bg-surface-container/30 px-2 -mx-2 rounded transition-colors">
      <TimeInput value={item.timeStart} onChange={v => set('timeStart', v)} />
      <TimeInput value={item.timeEnd}   onChange={v => set('timeEnd',   v)} />

      <select 
        value={item.contentType} 
        onChange={e => set('contentType', e.target.value)}
        className="w-full px-2 py-1.5 bg-surface border border-outline-variant rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
      >
        {types.map(t => <option key={t} value={t}>{t}</option>)}
      </select>

      <input
        value={item.detail}
        onChange={e => set('detail', e.target.value)}
        placeholder="Chi tiết, ghi chú thêm..."
        className="w-full px-3 py-1.5 bg-surface border border-outline-variant rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none placeholder:text-on-surface-variant/50"
      />

      <button
        onClick={onRemove}
        className="w-8 h-8 flex items-center justify-center text-error hover:bg-error/10 rounded-lg transition-colors ml-auto"
        title="Xóa dòng này"
      >
        <span className="material-symbols-outlined text-[20px]">delete</span>
      </button>
    </div>
  );
}

export default function AgendaSection({ day, activeDest, onChange, isCandidate }) {
  const items = day.agenda[activeDest] || [];

  const updateAgenda = (newItems) => {
    onChange({
      agenda: {
        ...day.agenda,
        [activeDest]: newItems
      }
    });
  };

  const addItem = () => updateAgenda([...items, newItem(activeDest, isCandidate)]);
  const updateItem = (id, updated) => updateAgenda(items.map(i => i._id === id ? updated : i));
  const removeItem = (id) => updateAgenda(items.filter(i => i._id !== id));

  if (!activeDest) {
    return (
      <div className="flex flex-col items-center justify-center text-on-surface-variant p-8 text-center bg-surface border border-dashed border-outline-variant rounded-xl">
        <span className="material-symbols-outlined text-4xl mb-2 opacity-30">view_agenda</span>
        <p className="text-sm">Vui lòng chọn địa điểm tiếp đón ở cột trái trước.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-primary/5 p-3 rounded-lg border border-primary/20">
        <div className="font-semibold text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">location_on</span>
          Lịch trình tại {activeDest}
        </div>
        <button onClick={addItem} className="btn btn-primary btn-sm flex items-center gap-1">
          <span className="material-symbols-outlined text-[18px]">add</span>
          Thêm dòng
        </button>
      </div>

      <div className="bg-surface border border-outline-variant rounded-xl p-4 shadow-sm">
        {items.length > 0 ? (
          <>
            <div className="grid grid-cols-[100px_100px_220px_1fr_40px] gap-3 mb-2 px-2 pb-2 border-b border-outline-variant/50">
              {['Bắt đầu', 'Kết thúc', 'Nội dung chính', 'Chi tiết / Ghi chú', ''].map((h, i) => (
                <div key={i} className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                  {h}
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-1">
              {items.map(item => (
                <AgendaItem
                  key={item._id}
                  item={item}
                  onChange={updated => updateItem(item._id, updated)}
                  onRemove={() => removeItem(item._id)}
                  isCandidate={isCandidate}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="py-8 flex flex-col items-center text-center">
             <div className="w-12 h-12 bg-surface-container rounded-full flex items-center justify-center mb-3">
               <span className="material-symbols-outlined text-on-surface-variant text-[24px]">calendar_add_on</span>
             </div>
             <p className="text-on-surface-variant font-medium">Chưa có lịch trình nào cho địa điểm này</p>
             <p className="text-sm text-on-surface-variant/70 mt-1">Nhấn "Thêm dòng" để bắt đầu lên lịch trình.</p>
          </div>
        )}
      </div>
    </div>
  );
}
