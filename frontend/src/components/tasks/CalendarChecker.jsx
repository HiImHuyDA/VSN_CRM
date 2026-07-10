// src/components/tasks/CalendarChecker.jsx
import { useState } from 'react';
import { checkCalendar } from '../../services/api';

export default function CalendarChecker({ roomEmail, roomName, date, startTime, endTime }) {
  const [events, setEvents] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const check = async () => {
    setLoading(true); setError(''); setEvents(null);
    try {
      const res = await checkCalendar(roomEmail, date);
      if (res.warning) {
        setError(res.warning);
      } else {
        setEvents(res.data || []);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const isOverlap = (evStart, evEnd, selStart, selEnd) => {
    if (!selStart || !selEnd) return false;
    return (selStart < evEnd && selEnd > evStart);
  };

  let conflictEvents = [];
  let otherEvents = [];
  if (events !== null) {
    events.forEach(ev => {
      if (isOverlap(ev.startLocal, ev.endLocal, startTime, endTime)) {
        conflictEvents.push(ev);
      } else {
        otherEvents.push(ev);
      }
    });
  }

  const hasTimeSelected = !!(startTime && endTime);

  return (
    <div style={{ background: 'rgba(91,106,240,0.06)', borderRadius: 8, padding: 12 }}>
      <div className="flex items-center gap-3 mb-4">
        <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          🗓️ Kiểm tra lịch: <strong>{roomName}</strong>
        </span>
        <button className="btn btn-outline btn-sm" onClick={check} disabled={loading}>
          {loading ? <><div className="spinner" style={{ width: 12, height: 12 }} /> Đang kiểm tra...</> : 'Kiểm tra lịch trống'}
        </button>
      </div>
      
      {error && <p className="error-msg text-sm text-error">{error}</p>}
      
      {/* KHÔNG CÓ LỊCH NÀO TRONG NGÀY */}
      {events !== null && events.length === 0 && (
        <p style={{ color: 'var(--color-success)', fontSize: 13, fontWeight: 'bold' }}>
          ✅ Phòng trống trong ngày này
        </p>
      )}

      {/* CÓ LỊCH TRONG NGÀY, CÓ XÉT GIỜ */}
      {events !== null && events.length > 0 && hasTimeSelected && (
        <>
          {conflictEvents.length > 0 ? (
            <div style={{ background: 'rgba(255,0,0,0.1)', border: '1px solid rgba(255,0,0,0.3)', borderRadius: 6, padding: '8px 10px', marginBottom: 8 }}>
              <p style={{ color: 'red', fontSize: 13, fontWeight: 'bold', marginBottom: 4 }}>
                ❌ Phòng ĐÃ BỊ BOOK trùng giờ:
              </p>
              {conflictEvents.map((ev, i) => (
                <div key={i} style={{ fontSize: 12, color: 'red' }}>
                  🕐 {ev.startLocal} – {ev.endLocal} | {ev.subject}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--color-success)', fontSize: 13, fontWeight: 'bold', marginBottom: 8 }}>
              ✅ Phòng trống trong khoảng thời gian ({startTime} - {endTime})
            </p>
          )}

          {otherEvents.length > 0 && (
            <div>
              <p style={{ color: 'var(--color-warning)', fontSize: 12, marginBottom: 4 }}>
                ⚠️ Các lịch khác trong ngày:
              </p>
              {otherEvents.map((ev, i) => (
                <div key={i} style={{
                  background: 'rgba(240,160,91,0.1)', border: '1px solid rgba(240,160,91,0.3)',
                  borderRadius: 6, padding: '4px 8px', marginBottom: 4, fontSize: 12
                }}>
                  🕐 {ev.startLocal} – {ev.endLocal} | {ev.subject}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* CÓ LỊCH TRONG NGÀY, NHƯNG CHƯA CHỌN GIỜ */}
      {events !== null && events.length > 0 && !hasTimeSelected && (
        <div>
          <p style={{ color: 'var(--color-warning)', fontSize: 13, marginBottom: 6, fontWeight: 'bold' }}>
            ⚠️ Phòng đã có {events.length} lịch trong ngày (vui lòng chọn giờ để kiểm tra trùng):
          </p>
          {events.map((ev, i) => (
            <div key={i} style={{
              background: 'rgba(240,160,91,0.1)', border: '1px solid rgba(240,160,91,0.3)',
              borderRadius: 6, padding: '6px 10px', marginBottom: 4, fontSize: 12
            }}>
              🕐 {ev.startLocal} – {ev.endLocal} | {ev.subject}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
