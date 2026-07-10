// src/components/ui/AutocompleteInput.jsx
import { useState, useRef, useEffect, useCallback } from 'react';
import { searchEmployees } from '../../services/api';

export default function AutocompleteInput({
  value = '',
  onChange,
  onSelect,
  placeholder = 'Tìm kiếm...',
  staticList = null, // array of { label, value, email?, ... } OR array of strings
  id,
  clearAfterSelect = false, // clear input after selecting (dùng cho thêm nhiều)
}) {
  const [query,   setQuery]   = useState(value);
  const [options, setOptions] = useState([]);
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const ref   = useRef(null);
  const timer = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Sync external value
  useEffect(() => { if (!clearAfterSelect) setQuery(value); }, [value, clearAfterSelect]);

  const search = useCallback(async (q) => {
    if (!q.trim()) { setOptions([]); setOpen(false); return; }

    if (staticList) {
      // Support both string arrays and object arrays
      const normalized = staticList.map(s =>
        typeof s === 'string' ? { label: s, value: s } : s
      );
      const filtered = normalized
        .filter(s => s.label.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 30);
      setOptions(filtered);
      setOpen(filtered.length > 0);
      return;
    }

    setLoading(true);
    try {
      const res = await searchEmployees(q);
      const items = (res.data || []).map(e => ({
        label: e.FullName,
        value: e.MNV,
        email: e.Email,
      }));
      setOptions(items);
      setOpen(items.length > 0);
    } catch { setOptions([]); }
    finally { setLoading(false); }
  }, [JSON.stringify(staticList?.slice(0, 5))]);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    onChange?.(val);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => search(val), 200);
  };

  const handleSelect = (item) => {
    if (clearAfterSelect) {
      setQuery('');
    } else {
      setQuery(item.label);
      onChange?.(item.label);
    }
    setOpen(false);
    onSelect?.(item);
  };

  const handleFocus = () => {
    if (query) search(query);
    else if (staticList) {
      // Hiển thị tất cả khi focus vào ô trống (nếu có staticList)
      const normalized = staticList.map(s =>
        typeof s === 'string' ? { label: s, value: s } : s
      ).slice(0, 30);
      setOptions(normalized);
      setOpen(normalized.length > 0);
    }
  };

  return (
    <div className="autocomplete-wrapper" ref={ref}>
      <input
        id={id}
        type="text"
        value={query}
        onChange={handleChange}
        onFocus={handleFocus}
        placeholder={placeholder}
        autoComplete="off"
      />
      {loading && (
        <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
          <div className="spinner" style={{ width: 14, height: 14 }} />
        </div>
      )}
      {open && options.length > 0 && (
        <div className="autocomplete-dropdown">
          {options.map((item, i) => (
            <div key={i} className="autocomplete-item" onMouseDown={() => handleSelect(item)}>
              <span className="autocomplete-name">{item.label}</span>
              {item.email && <span className="autocomplete-email">{item.email}</span>}
            </div>
          ))}
        </div>
      )}
      {open && options.length === 0 && !loading && (
        <div className="autocomplete-dropdown">
          <div className="autocomplete-empty">Không tìm thấy kết quả</div>
        </div>
      )}
    </div>
  );
}
