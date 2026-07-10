import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { ComboboxMultiple } from '../../components/ui/combobox';
import { Checkbox } from '../../components/ui/checkbox';
import { Field, FieldLabel } from '../../components/ui/field';

// ─── SVG Icon Components ─────────────────────────────────────────────────────
const Icon = ({ d, size = 16, strokeWidth = 1.75 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const Icons = {
  Bold: () => <Icon d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />,
  Italic: () => <Icon d="M19 4h-9M14 20H5M15 4 9 20" />,
  Underline: () => <Icon d="M6 4v6a6 6 0 0 0 12 0V4M4 20h16" />,
  Strike: () => <Icon d="M16 4H9a3 3 0 0 0-2.83 4M4 20h16M14 20a3 3 0 0 0 .83-4H9" />,
  AlignLeft: () => <Icon d="M3 6h18M3 12h12M3 18h15" />,
  AlignCenter: () => <Icon d="M3 6h18M6 12h12M4 18h16" />,
  AlignRight: () => <Icon d="M3 6h18M9 12h12M6 18h15" />,
  ListBullet: () => <Icon d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  ListOrdered: () => <Icon d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10H3M6 10H5M3 20v-2.5a2 2 0 1 1 4 0V20H3" />,
  Link: () => <Icon d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />,
  Image: () => <Icon d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7M16 5h6M19 2v6M9 15l3.5-4.5 2.5 3 1.5-2 2.5 3.5H6" />,
  Attach: () => <Icon d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />,
};

const IndentIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 6H9M21 12H9M21 18H9M7 8l-4 4 4 4" />
  </svg>
);
const OutdentIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 6H9M21 12H9M21 18H9M3 8l4 4-4 4" />
  </svg>
);

// ─── Toolbar Button ───────────────────────────────────────────────────────────
function ToolBtn({ onClick, title, active, children }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 30, height: 30, borderRadius: 6, border: 'none', cursor: 'pointer',
        background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
        color: active ? '#6366f1' : '#374151',
        transition: 'all 0.15s',
        flexShrink: 0,
      }}
      onMouseEnter={e => !active && (e.currentTarget.style.background = '#f3f4f6')}
      onMouseLeave={e => !active && (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </button>
  );
}

// ─── Divider ─────────────────────────────────────────────────────────────────
const Divider = () => (
  <div style={{ width: 1, height: 20, background: '#e5e7eb', margin: '0 4px', flexShrink: 0 }} />
);

// ─── Color Picker Popover ─────────────────────────────────────────────────────
const TEXT_COLORS = [
  { label: 'Đen', value: '#111827' },
  { label: 'Xám đậm', value: '#4B5563' },
  { label: 'Đỏ', value: '#DC2626' },
  { label: 'Cam', value: '#D97706' },
  { label: 'Vàng', value: '#CA8A04' },
  { label: 'Xanh lá', value: '#16A34A' },
  { label: 'Teal', value: '#0D9488' },
  { label: 'Xanh', value: '#2563EB' },
  { label: 'Indigo', value: '#4F46E5' },
  { label: 'Tím', value: '#7C3AED' },
  { label: 'Hồng', value: '#DB2777' },
  { label: 'Nâu', value: '#92400E' },
];
const BG_COLORS = [
  { label: 'Không màu', value: 'transparent' },
  { label: 'Vàng nhạt', value: '#FEF9C3' },
  { label: 'Xanh lá nhạt', value: '#DCFCE7' },
  { label: 'Xanh nhạt', value: '#DBEAFE' },
  { label: 'Hồng nhạt', value: '#FCE7F3' },
  { label: 'Cam nhạt', value: '#FFEDD5' },
  { label: 'Tím nhạt', value: '#EDE9FE' },
  { label: 'Xám nhạt', value: '#F3F4F6' },
  { label: 'Teal nhạt', value: '#CCFBF1' },
];

function ColorPicker({ onSelect, colors, label, currentColor }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        title={label}
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 3, padding: '0 6px',
          height: 30, borderRadius: 6, border: 'none', cursor: 'pointer',
          background: open ? 'rgba(99,102,241,0.1)' : 'transparent',
          color: '#374151', fontSize: 11, fontWeight: 500,
          transition: 'background 0.15s', flexShrink: 0,
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = '#f3f4f6'; }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{
          width: 14, height: 14, borderRadius: 3, flexShrink: 0, border: '1px solid #d1d5db',
          background: currentColor && currentColor !== 'transparent'
            ? currentColor
            : 'linear-gradient(135deg, #f87171 50%, #60a5fa 50%)',
        }} />
        <span style={{ userSelect: 'none' }}>{label}</span>
        <span style={{ fontSize: 8, marginTop: 1 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 1000, marginTop: 4,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
          padding: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 5,
          width: 180,
        }}>
          {colors.map(c => (
            <button
              key={c.value}
              type="button"
              title={c.label}
              onClick={() => { onSelect(c.value); setOpen(false); }}
              style={{
                width: 22, height: 22, borderRadius: 5, cursor: 'pointer',
                border: c.value === 'transparent' ? '1px dashed #9ca3af' : '1.5px solid rgba(0,0,0,0.1)',
                background: c.value === 'transparent'
                  ? 'repeating-conic-gradient(#e5e7eb 0% 25%, white 0% 50%) 0/8px 8px'
                  : c.value,
                transition: 'transform 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.2)'; e.currentTarget.style.zIndex = 2; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.zIndex = 1; }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Toolbar Select ───────────────────────────────────────────────────────────
function ToolSelect({ value, onChange, options, width = 100 }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        height: 28, borderRadius: 6, border: '1px solid #e5e7eb',
        background: '#fff', color: '#374151', fontSize: 12,
        padding: '0 6px', cursor: 'pointer', outline: 'none',
        width, flexShrink: 0,
      }}
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ─── PLACEHOLDERS ────────────────────────────────────────────────────────────
const PLACEHOLDERS = [
  { label: 'Khách hàng', value: '{{Khách Hàng}}' },
  { label: 'Chủ đề tiếp đón', value: '{{Chủ Đề Tiếp Đón}}' },
  { label: 'Địa điểm tiếp đón', value: '{{Địa Điểm Tiếp Đón}}' },
  { label: 'Ngày tiếp đón', value: '{{Ngày Tiếp Đón}}' },
  { label: 'Người gửi', value: '{{Người Gửi}}' },
];

const convertToChips = (html) => {
  if (!html) return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      for (const ph of PLACEHOLDERS) {
        if (text.includes(ph.value)) {
          const span = doc.createElement('span');
          const parts = text.split(ph.value);
          parts.forEach((part, index) => {
            if (part) span.appendChild(doc.createTextNode(part));
            if (index < parts.length - 1) {
              const chip = doc.createElement('span');
              chip.className = 'ph-chip';
              chip.setAttribute('contenteditable', 'false');
              chip.setAttribute('data-ph', ph.value);

              const delBtn = doc.createElement('span');
              delBtn.className = 'ph-chip-del';
              delBtn.innerHTML = '×';

              chip.appendChild(delBtn);
              chip.appendChild(doc.createTextNode(ph.label));
              span.appendChild(chip);
            }
          });
          node.parentNode.replaceChild(span, node);
          break;
        }
      }
    } else {
      if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('ph-chip')) {
        return;
      }
      const children = Array.from(node.childNodes);
      children.forEach(walk);
    }
  };

  walk(doc.body);
  return doc.body.innerHTML;
};

const convertFromChips = (html) => {
  if (!html) return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const chips = doc.querySelectorAll('.ph-chip');
  chips.forEach(chip => {
    const phValue = chip.getAttribute('data-ph');
    if (phValue) {
      const textNode = doc.createTextNode(phValue);
      chip.parentNode.replaceChild(textNode, chip);
    }
  });
  return doc.body.innerHTML;
};

// ─── CROP MODAL COMPONENT ──────────────────────────────────────────────────
function CropModal({ imageElement, onClose, onCropComplete }) {
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
  const [cropBox, setCropBox] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [cropping, setCropping] = useState(false);
  const modalImgRef = useRef(null);

  const handleImageLoad = (e) => {
    const { width, height } = e.target.getBoundingClientRect();
    setImgSize({ width, height });
    setCropBox({
      x: width * 0.1,
      y: height * 0.1,
      w: width * 0.8,
      h: height * 0.8,
    });
  };

  const handleDragStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startCrop = { ...cropBox };

    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      const newX = Math.max(0, Math.min(imgSize.width - startCrop.w, startCrop.x + deltaX));
      const newY = Math.max(0, Math.min(imgSize.height - startCrop.h, startCrop.y + deltaY));

      setCropBox(prev => ({ ...prev, x: newX, y: newY }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleResizeStart = (e, dir) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startCrop = { ...cropBox };

    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      let newX = startCrop.x;
      let newY = startCrop.y;
      let newW = startCrop.w;
      let newH = startCrop.h;

      if (dir === 'se') {
        newW = Math.max(20, Math.min(imgSize.width - startCrop.x, startCrop.w + deltaX));
        newH = Math.max(20, Math.min(imgSize.height - startCrop.y, startCrop.h + deltaY));
      } else if (dir === 'sw') {
        const potentialW = startCrop.w - deltaX;
        if (potentialW >= 20) {
          const maxLeftShift = startCrop.x;
          const shift = Math.max(-maxLeftShift, deltaX);
          newX = startCrop.x + shift;
          newW = startCrop.w - shift;
        }
        newH = Math.max(20, Math.min(imgSize.height - startCrop.y, startCrop.h + deltaY));
      } else if (dir === 'ne') {
        newW = Math.max(20, Math.min(imgSize.width - startCrop.x, startCrop.w + deltaX));
        const potentialH = startCrop.h - deltaY;
        if (potentialH >= 20) {
          const maxUpShift = startCrop.y;
          const shift = Math.max(-maxUpShift, deltaY);
          newY = startCrop.y + shift;
          newH = startCrop.h - shift;
        }
      } else if (dir === 'nw') {
        const potentialW = startCrop.w - deltaX;
        if (potentialW >= 20) {
          const maxLeftShift = startCrop.x;
          const shift = Math.max(-maxLeftShift, deltaX);
          newX = startCrop.x + shift;
          newW = startCrop.w - shift;
        }
        const potentialH = startCrop.h - deltaY;
        if (potentialH >= 20) {
          const maxUpShift = startCrop.y;
          const shift = Math.max(-maxUpShift, deltaY);
          newY = startCrop.y + shift;
          newH = startCrop.h - shift;
        }
      }

      setCropBox({ x: newX, y: newY, w: newW, h: newH });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const getHandleStyle = (dir) => {
    switch (dir) {
      case 'nw': return { top: -5, left: -5, cursor: 'nwse-resize' };
      case 'ne': return { top: -5, right: -5, cursor: 'nesw-resize' };
      case 'sw': return { bottom: -5, left: -5, cursor: 'nesw-resize' };
      case 'se': return { bottom: -5, right: -5, cursor: 'nwse-resize' };
      default: return {};
    }
  };

  const handleConfirmCrop = () => {
    if (!modalImgRef.current) return;
    setCropping(true);

    const img = modalImgRef.current;
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    const scaleX = naturalWidth / imgSize.width;
    const scaleY = naturalHeight / imgSize.height;

    const canvas = document.createElement('canvas');
    canvas.width = cropBox.w * scaleX;
    canvas.height = cropBox.h * scaleY;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(
      img,
      cropBox.x * scaleX,
      cropBox.y * scaleY,
      cropBox.w * scaleX,
      cropBox.h * scaleY,
      0, 0,
      canvas.width,
      canvas.height
    );

    canvas.toBlob(async (blob) => {
      if (!blob) {
        toast.error('Lỗi khi cắt ảnh');
        setCropping(false);
        return;
      }

      try {
        const formData = new FormData();
        formData.append('file', blob, 'cropped-image.png');

        const apiHost = import.meta.env.VITE_API_URL || '/api';
        let baseUrl = apiHost.endsWith('/api') ? apiHost.slice(0, -4) : apiHost;
        try {
          if (baseUrl.startsWith('http://') || baseUrl.startsWith('https://')) {
            const urlObj = new URL(baseUrl);
            urlObj.hostname = window.location.hostname;
            baseUrl = urlObj.origin;
          }
        } catch (e) {
          console.error('Failed to parse baseUrl:', e);
        }

        const uploadUrl = `${baseUrl}/api/files/upload`;
        const res = await fetch(uploadUrl, { method: 'POST', body: formData }).then(r => r.json());

        if (res.success) {
          const url = `${baseUrl}${res.data.file_url}`;
          onCropComplete(url);
        } else {
          toast.error('Không thể tải ảnh đã cắt lên máy chủ');
        }
      } catch (err) {
        console.error(err);
        toast.error('Lỗi khi tải ảnh đã cắt');
      } finally {
        setCropping(false);
      }
    }, 'image/png');
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[99999] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid #f3f4f6',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: '#f9fafb'
        }}>
          <h3 style={{ fontWeight: 700, fontSize: 16, color: '#111827', margin: 0 }}>✂️ Cắt ảnh</h3>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb',
              background: '#fff', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 16,
              color: '#6b7280'
            }}
          >×</button>
        </div>

        <div style={{
          padding: '24px',
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f3f4f6',
          minHeight: 300,
        }}>
          <div style={{
            position: 'relative',
            width: imgSize.width || 'auto',
            height: imgSize.height || 'auto',
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}>
            <img
              ref={modalImgRef}
              src={imageElement.src}
              onLoad={handleImageLoad}
              style={{
                maxWidth: '100%',
                maxHeight: '55vh',
                display: 'block',
                userSelect: 'none',
                pointerEvents: 'none'
              }}
            />
            {imgSize.width > 0 && (
              <>
                <div
                  style={{
                    position: 'absolute',
                    left: cropBox.x,
                    top: cropBox.y,
                    width: cropBox.w,
                    height: cropBox.h,
                    border: '2px dashed #6366f1',
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                    cursor: 'move',
                    zIndex: 10
                  }}
                  onMouseDown={handleDragStart}
                >
                  <div style={{
                    position: 'absolute',
                    top: 4,
                    left: 6,
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 'bold',
                    textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                    pointerEvents: 'none'
                  }}>
                    {Math.round(cropBox.w * (modalImgRef.current?.naturalWidth / imgSize.width))} x {Math.round(cropBox.h * (modalImgRef.current?.naturalHeight / imgSize.height))} px
                  </div>

                  {['nw', 'ne', 'sw', 'se'].map(dir => (
                    <div
                      key={dir}
                      onMouseDown={(e) => handleResizeStart(e, dir)}
                      style={{
                        position: 'absolute',
                        width: 10,
                        height: 10,
                        background: '#6366f1',
                        border: '2px solid #fff',
                        borderRadius: '50%',
                        zIndex: 20,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        ...getHandleStyle(dir),
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #f3f4f6',
          display: 'flex', justifyContent: 'flex-end', gap: 12,
          background: '#f9fafb'
        }}>
          <button className="btn btn-outline btn-sm" onClick={onClose} disabled={cropping}>Hủy</button>
          <button className="btn btn-primary btn-sm" onClick={handleConfirmCrop} disabled={cropping}>
            {cropping ? 'Đang cắt...' : 'Cắt ảnh'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SUBJECT EDITOR COMPONENT ────────────────────────────────────────────────
function SubjectEditor({ value, onChange }) {
  const editorRef = useRef(null);
  const [focused, setFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [caretRange, setCaretRange] = useState(null);

  useEffect(() => {
    if (editorRef.current) {
      const currentClean = convertFromChips(editorRef.current.innerHTML);
      if (currentClean !== value) {
        editorRef.current.innerHTML = convertToChips(value || '');
      }
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      let html = editorRef.current.innerHTML;
      html = html.replace(/<div[^>]*>/gi, '').replace(/<\/div>/gi, '');
      html = html.replace(/<br[^>]*>/gi, '');
      const cleanText = convertFromChips(html);
      onChange(cleanText);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
    }

    if (showSuggestions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSuggestionIndex(i => (i + 1) % PLACEHOLDERS.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSuggestionIndex(i => (i - 1 + PLACEHOLDERS.length) % PLACEHOLDERS.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertPlaceholder(PLACEHOLDERS[suggestionIndex].value);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowSuggestions(false);
      }
    }
  };

  const handleKeyUp = (e) => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const textNode = range.startContainer;
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        const offset = range.startOffset;
        const text = textNode.textContent || '';
        if (offset > 0 && text[offset - 1] === '/') {
          setCaretRange(range.cloneRange());
          setShowSuggestions(true);
          setSuggestionIndex(0);
          return;
        }
      }
    }
    setShowSuggestions(false);
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    const cleanText = text.replace(/[\r\n]+/g, ' ');
    document.execCommand('insertText', false, cleanText);
  };

  const insertPlaceholder = (placeholderText) => {
    if (caretRange) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(caretRange);

      const range = caretRange.cloneRange();
      range.setStart(caretRange.startContainer, caretRange.startOffset - 1);
      range.setEnd(caretRange.startContainer, caretRange.startOffset);
      sel.removeAllRanges();
      sel.addRange(range);

      document.execCommand('delete');

      const ph = PLACEHOLDERS.find(p => p.value === placeholderText);
      if (ph) {
        const chipHtml = `<span class="ph-chip" contenteditable="false" data-ph="${ph.value}"><span class="ph-chip-del">×</span>${ph.label}</span>&nbsp;`;
        document.execCommand('insertHTML', false, chipHtml);
      }

      setShowSuggestions(false);
      handleInput();
    }
  };

  const handleClick = (e) => {
    if (e.target.classList.contains('ph-chip-del')) {
      const chip = e.target.closest('.ph-chip');
      if (chip) {
        chip.remove();
        handleInput();
      }
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={() => { handleInput(); setFocused(false); }}
        onFocus={() => setFocused(true)}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onPaste={handlePaste}
        onClick={handleClick}
        style={{
          minHeight: 38,
          maxHeight: 100,
          overflowY: 'auto',
          outline: 'none',
          background: '#fff',
          border: focused ? '1.5px solid #6366f1' : '1.5px solid #e5e7eb',
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: '13.5px',
          color: '#1f2937',
          caretColor: '#6366f1',
          boxShadow: focused ? '0 0 0 3px rgba(99,102,241,0.12)' : '0 1px 3px rgba(0,0,0,0.06)',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          fontFamily: 'Inter, system-ui, sans-serif',
          whiteSpace: 'nowrap',
          overflowX: 'auto',
          display: 'flex',
          alignItems: 'center',
        }}
      />
      {!value && !focused && (
        <div style={{
          position: 'absolute',
          left: 13,
          top: '50%',
          transform: 'translateY(-50%)',
          color: '#9ca3af',
          fontSize: 13,
          pointerEvents: 'none',
          userSelect: 'none',
          fontFamily: 'Inter, system-ui, sans-serif'
        }}>
          Tiêu đề email...
        </div>
      )}

      {showSuggestions && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 1000,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)', width: '100%', marginTop: 2,
          maxHeight: 200, overflowY: 'auto', padding: '4px 0'
        }}>
          <div style={{ padding: '6px 12px', fontSize: 10, color: '#9ca3af', fontWeight: 600, borderBottom: '1px solid #f3f4f6' }}>
            CHÈN PLACEHOLDER ĐỘNG
          </div>
          {PLACEHOLDERS.map((ph, idx) => (
            <div
              key={ph.value}
              onClick={() => insertPlaceholder(ph.value)}
              style={{
                padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                background: idx === suggestionIndex ? '#f3f4f6' : '#fff',
                color: idx === suggestionIndex ? '#4f46e5' : '#374151',
                fontWeight: idx === suggestionIndex ? 600 : 400,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}
              onMouseEnter={() => setSuggestionIndex(idx)}
            >
              <span>{ph.label}</span>
              <code style={{ fontSize: 11, color: '#8b5cf6', background: '#f5f3ff', padding: '2px 6px', borderRadius: 4 }}>{ph.value}</code>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Rich Text Editor ─────────────────────────────────────────────────────────
function RichTextEditor({ value, onChange }) {
  const editorRef = useRef(null);
  const savedRange = useRef(null);
  const [textColor, setTextColor] = useState('#111827');
  const [bgColor, setBgColor] = useState('transparent');
  const [fontFamily, setFontFamily] = useState('Segoe UI, sans-serif');
  const [fontSize, setFontSize] = useState('3');
  const [focused, setFocused] = useState(false);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [caretRange, setCaretRange] = useState(null);

  const [activeImage, setActiveImage] = useState(null);
  const [cropTargetImage, setCropTargetImage] = useState(null);
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const handleScroll = () => {
      if (activeImage) forceUpdate({});
    };
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [activeImage]);

  useEffect(() => {
    const handler = (e) => {
      if (editorRef.current && !editorRef.current.contains(e.target) &&
        !e.target.closest('.img-resizer-tool')) {
        setActiveImage(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleEditorClick = (e) => {
    if (e.target.tagName === 'IMG') {
      setActiveImage(e.target);
    } else {
      setActiveImage(null);
    }

    if (e.target.classList.contains('ph-chip-del')) {
      const chip = e.target.closest('.ph-chip');
      if (chip) {
        chip.remove();
        handleInput();
      }
    }
  };

  const getHandlePosition = () => {
    if (!activeImage || !editorRef.current) return { top: 0, left: 0, toolbarTop: 0, toolbarLeft: 0, visible: false };
    const rect = activeImage.getBoundingClientRect();
    const parentRect = editorRef.current.getBoundingClientRect();
    return {
      top: rect.bottom - parentRect.top - 8,
      left: rect.right - parentRect.left - 8,
      toolbarTop: Math.max(5, rect.top - parentRect.top - 40),
      toolbarLeft: Math.max(5, rect.left - parentRect.left + (rect.width - 350) / 2),
      visible: rect.top < parentRect.bottom && rect.bottom > parentRect.top
    };
  };

  const handleResizeStart = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const isLocked = activeImage.getAttribute('data-lock-ratio') !== 'false';
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = activeImage.offsetWidth;
    const startHeight = activeImage.offsetHeight;
    const startRatio = startWidth / startHeight;

    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      let newWidth = Math.max(50, startWidth + deltaX);
      let newHeight = Math.max(50, startHeight + deltaY);

      if (isLocked) {
        newHeight = newWidth / startRatio;
      }

      activeImage.style.width = `${newWidth}px`;
      activeImage.style.height = isLocked ? 'auto' : `${newHeight}px`;

      forceUpdate({});
      handleInput();
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleEditorKeyUp = (e) => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const textNode = range.startContainer;
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        const offset = range.startOffset;
        const text = textNode.textContent || '';
        if (offset > 0 && text[offset - 1] === '/') {
          setCaretRange(range.cloneRange());
          setShowSuggestions(true);
          setSuggestionIndex(0);
          return;
        }
      }
    }
    setShowSuggestions(false);
  };

  const handleEditorKeyDown = (e) => {
    if (showSuggestions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSuggestionIndex(i => (i + 1) % PLACEHOLDERS.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSuggestionIndex(i => (i - 1 + PLACEHOLDERS.length) % PLACEHOLDERS.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertEditorPlaceholder(PLACEHOLDERS[suggestionIndex].value);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowSuggestions(false);
      }
    }
  };

  const insertEditorPlaceholder = (placeholderText) => {
    if (caretRange) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(caretRange);

      const range = caretRange.cloneRange();
      range.setStart(caretRange.startContainer, caretRange.startOffset - 1);
      range.setEnd(caretRange.startContainer, caretRange.startOffset);
      sel.removeAllRanges();
      sel.addRange(range);

      document.execCommand('delete');

      const ph = PLACEHOLDERS.find(p => p.value === placeholderText);
      if (ph) {
        const chipHtml = `<span class="ph-chip" contenteditable="false" data-ph="${ph.value}"><span class="ph-chip-del">×</span>${ph.label}</span>&nbsp;`;
        document.execCommand('insertHTML', false, chipHtml);
      }

      setShowSuggestions(false);
      handleInput();
    }
  };

  useEffect(() => {
    if (editorRef.current) {
      const currentClean = convertFromChips(editorRef.current.innerHTML);
      if (currentClean !== value) {
        editorRef.current.innerHTML = convertToChips(value || '');
      }
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      const cleanHtml = convertFromChips(editorRef.current.innerHTML);
      onChange(cleanHtml);
    }
  };

  const saveRange = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const insertHTMLAtSavedRange = (html) => {
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (sel && savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    document.execCommand('insertHTML', false, html);
    handleInput();
  };

  const exec = (cmd, arg = null) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, arg);
    handleInput();
  };

  const getUploadUrls = () => {
    const apiHost = import.meta.env.VITE_API_URL || '/api';
    let baseUrl = apiHost.endsWith('/api') ? apiHost.slice(0, -4) : apiHost;
    try {
      if (baseUrl.startsWith('http://') || baseUrl.startsWith('https://')) {
        const urlObj = new URL(baseUrl);
        urlObj.hostname = window.location.hostname;
        baseUrl = urlObj.origin;
      }
    } catch (e) {
      console.error('Failed to parse baseUrl:', e);
    }
    return { uploadUrl: `${baseUrl}/api/files/upload`, baseUrl };
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (!file) continue;

        saveRange();

        const tempId = 'img-' + Date.now();
        const blobUrl = URL.createObjectURL(file);

        insertHTMLAtSavedRange(
          `<img id="${tempId}" src="${blobUrl}" style="max-width:100%;height:auto;display:block;margin:6px 0;opacity:0.6;" />`
        );

        try {
          toast.loading('Đang dán ảnh từ clipboard...', { id: 'paste-upload' });
          const formData = new FormData();
          formData.append('file', file);
          const { uploadUrl, baseUrl } = getUploadUrls();
          const res = await fetch(uploadUrl, { method: 'POST', body: formData }).then(r => r.json());
          if (res.success) {
            const url = `${baseUrl}${res.data.file_url}`;
            const tempImg = editorRef.current?.querySelector(`#${tempId}`);
            if (tempImg) {
              tempImg.src = url;
              tempImg.style.opacity = '1';
              tempImg.removeAttribute('id');
            }
            URL.revokeObjectURL(blobUrl);
            handleInput();
            toast.success('Đã dán ảnh thành công!', { id: 'paste-upload' });
          } else {
            const tempImg = editorRef.current?.querySelector(`#${tempId}`);
            if (tempImg) tempImg.remove();
            URL.revokeObjectURL(blobUrl);
            handleInput();
            toast.error('Lỗi tải ảnh', { id: 'paste-upload' });
          }
        } catch {
          const tempImg = editorRef.current?.querySelector(`#${tempId}`);
          if (tempImg) tempImg.remove();
          URL.revokeObjectURL(blobUrl);
          handleInput();
          toast.error('Lỗi kết nối khi dán ảnh', { id: 'paste-upload' });
        }
        break;
      }
    }
  };

  const handleFileUpload = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const tempId = (type === 'image' ? 'img-' : 'file-') + Date.now();
    let blobUrl = '';

    if (type === 'image') {
      blobUrl = URL.createObjectURL(file);
      insertHTMLAtSavedRange(
        `<img id="${tempId}" src="${blobUrl}" style="max-width:100%;height:auto;display:block;margin:6px 0;opacity:0.6;" />`
      );
    } else {
      const linkText = savedRange.current?.toString() || file.name;
      insertHTMLAtSavedRange(
        `<a id="${tempId}" href="#" onClick="return false;" style="color:#9CA3AF;text-decoration:underline;opacity:0.6;">Đang tải: ${linkText}</a>`
      );
    }

    try {
      toast.loading('Đang tải tệp lên...', { id: 'file-upload' });
      const formData = new FormData();
      formData.append('file', file);
      const { uploadUrl, baseUrl } = getUploadUrls();
      const res = await fetch(uploadUrl, { method: 'POST', body: formData }).then(r => r.json());
      if (res.success) {
        const url = `${baseUrl}${res.data.file_url}`;
        if (type === 'image') {
          const tempImg = editorRef.current?.querySelector(`#${tempId}`);
          if (tempImg) {
            tempImg.src = url;
            tempImg.style.opacity = '1';
            tempImg.removeAttribute('id');
          }
          URL.revokeObjectURL(blobUrl);
        } else {
          const tempLink = editorRef.current?.querySelector(`#${tempId}`);
          if (tempLink) {
            tempLink.href = url;
            tempLink.style.color = '#4F46E5';
            tempLink.style.opacity = '1';
            tempLink.removeAttribute('onClick');
            tempLink.removeAttribute('id');
          }
        }
        handleInput();
        toast.success('Tải lên thành công!', { id: 'file-upload' });
      } else {
        const tempEl = editorRef.current?.querySelector(`#${tempId}`);
        if (tempEl) tempEl.remove();
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        handleInput();
        toast.error('Lỗi upload', { id: 'file-upload' });
      }
    } catch {
      const tempEl = editorRef.current?.querySelector(`#${tempId}`);
      if (tempEl) tempEl.remove();
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      handleInput();
      toast.error('Lỗi kết nối khi tải tệp', { id: 'file-upload' });
    }
    e.target.value = '';
  };

  const fontOptions = [
    { value: 'Segoe UI, sans-serif', label: 'Segoe UI' },
    { value: 'Arial, sans-serif', label: 'Arial' },
    { value: 'Georgia, serif', label: 'Georgia' },
    { value: '"Times New Roman", serif', label: 'Times New Roman' },
    { value: '"Courier New", monospace', label: 'Courier New' },
  ];
  const sizeOptions = [
    { value: '1', label: 'Nhỏ (10px)' },
    { value: '2', label: 'Nhỏ hơn (13px)' },
    { value: '3', label: 'Vừa (16px)' },
    { value: '4', label: 'Hơi lớn (18px)' },
    { value: '5', label: 'Lớn (24px)' },
    { value: '6', label: 'Rất lớn (32px)' },
    { value: '7', label: 'Cực đại (48px)' },
  ];

  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleCropComplete = (newUrl) => {
    if (cropTargetImage) {
      cropTargetImage.src = newUrl;
      cropTargetImage.style.opacity = '1';
      cropTargetImage.style.width = '100%';
      cropTargetImage.style.height = 'auto';
      handleInput();
      setActiveImage(null);
      setCropTargetImage(null);
    }
  };

  return (
    <div style={{
      border: focused ? '1.5px solid #6366f1' : '1.5px solid #e5e7eb',
      borderRadius: 12, overflow: 'hidden', background: '#fff',
      boxShadow: focused ? '0 0 0 3px rgba(99,102,241,0.12)' : '0 1px 3px rgba(0,0,0,0.06)',
      transition: 'border-color 0.2s, box-shadow 0.2s',
    }}>

      {/* ── Toolbar ── */}
      <div style={{
        padding: '6px 10px', borderBottom: '1px solid #f3f4f6',
        background: '#fafafa', display: 'flex', flexWrap: 'wrap',
        alignItems: 'center', gap: 2,
      }}>
        <ToolSelect
          value={fontFamily} width={110}
          onChange={v => { setFontFamily(v); exec('fontName', v); }}
          options={fontOptions}
        />
        <div style={{ width: 6 }} />
        <ToolSelect
          value={fontSize} width={105}
          onChange={v => { setFontSize(v); exec('fontSize', v); }}
          options={sizeOptions}
        />

        <Divider />

        <ToolBtn onClick={() => exec('bold')} title="In đậm (Ctrl+B)"><Icons.Bold /></ToolBtn>
        <ToolBtn onClick={() => exec('italic')} title="In nghiêng (Ctrl+I)"><Icons.Italic /></ToolBtn>
        <ToolBtn onClick={() => exec('underline')} title="Gạch chân (Ctrl+U)"><Icons.Underline /></ToolBtn>
        <ToolBtn onClick={() => exec('strikeThrough')} title="Gạch ngang"><Icons.Strike /></ToolBtn>

        <Divider />

        <ColorPicker
          label="Màu chữ" colors={TEXT_COLORS} currentColor={textColor}
          onSelect={v => { setTextColor(v); exec('foreColor', v); }}
        />
        <div style={{ width: 2 }} />
        <ColorPicker
          label="Nền" colors={BG_COLORS} currentColor={bgColor}
          onSelect={v => { setBgColor(v); exec('hiliteColor', v); }}
        />

        <Divider />

        <ToolBtn onClick={() => exec('justifyLeft')} title="Canh trái"><Icons.AlignLeft /></ToolBtn>
        <ToolBtn onClick={() => exec('justifyCenter')} title="Canh giữa"><Icons.AlignCenter /></ToolBtn>
        <ToolBtn onClick={() => exec('justifyRight')} title="Canh phải"><Icons.AlignRight /></ToolBtn>

        <Divider />

        <ToolBtn onClick={() => exec('insertUnorderedList')} title="Danh sách bullet"><Icons.ListBullet /></ToolBtn>
        <ToolBtn onClick={() => exec('insertOrderedList')} title="Danh sách số"><Icons.ListOrdered /></ToolBtn>

        <Divider />

        <ToolBtn onClick={() => exec('outdent')} title="Giảm thụt lề"><OutdentIcon /></ToolBtn>
        <ToolBtn onClick={() => exec('indent')} title="Tăng thụt lề"><IndentIcon /></ToolBtn>

        <Divider />

        <ToolBtn
          title="Chèn liên kết"
          onClick={() => {
            const url = prompt('Nhập URL liên kết:');
            if (url) exec('createLink', url.startsWith('http') ? url : `https://${url}`);
          }}
        >
          <Icons.Link />
        </ToolBtn>

        <ToolBtn
          title="Chèn ảnh"
          onClick={() => { saveRange(); imageInputRef.current?.click(); }}
        >
          <Icons.Image />
        </ToolBtn>
        <input
          ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => handleFileUpload(e, 'image')}
        />

        <ToolBtn
          title="Đính kèm tệp"
          onClick={() => { saveRange(); fileInputRef.current?.click(); }}
        >
          <Icons.Attach />
        </ToolBtn>
        <input
          ref={fileInputRef} type="file" style={{ display: 'none' }}
          onChange={e => handleFileUpload(e, 'file')}
        />
      </div>

      {/* ── Editor Content Area ── */}
      <div style={{ position: 'relative', width: '100%' }}>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onBlur={() => { handleInput(); setFocused(false); }}
          onFocus={() => setFocused(true)}
          onPaste={handlePaste}
          onKeyUp={handleEditorKeyUp}
          onKeyDown={handleEditorKeyDown}
          onClick={handleEditorClick}
          style={{
            padding: '20px 24px',
            minHeight: 280,
            maxHeight: 420,
            overflowY: 'auto',
            outline: 'none',
            fontSize: 14,
            lineHeight: 1.75,
            color: '#1f2937',
            fontFamily: 'Segoe UI, system-ui, sans-serif',
            background: '#fff',
            caretColor: '#6366f1',
          }}
          data-placeholder="Soạn nội dung email tại đây..."
        />

        {showSuggestions && (
          <div style={{
            position: 'absolute', top: 10, left: 24, zIndex: 1000,
            background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)', width: 280,
            maxHeight: 220, overflowY: 'auto', padding: '4px 0',
          }}>
            <div style={{ padding: '6px 12px', fontSize: 10, color: '#9ca3af', fontWeight: 600, borderBottom: '1px solid #f3f4f6' }}>
              CHÈN PLACEHOLDER ĐỘNG
            </div>
            {PLACEHOLDERS.map((ph, idx) => (
              <div
                key={ph.value}
                onClick={() => insertEditorPlaceholder(ph.value)}
                style={{
                  padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                  background: idx === suggestionIndex ? '#f3f4f6' : '#fff',
                  color: idx === suggestionIndex ? '#4f46e5' : '#374151',
                  fontWeight: idx === suggestionIndex ? 600 : 400,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
                onMouseEnter={() => setSuggestionIndex(idx)}
              >
                <span>{ph.label}</span>
                <code style={{ fontSize: 11, color: '#8b5cf6', background: '#f5f3ff', padding: '2px 6px', borderRadius: 4 }}>{ph.value}</code>
              </div>
            ))}
          </div>
        )}

        {activeImage && getHandlePosition().visible && (
          <>
            {/* Resize handle (bottom right of the active image) */}
            <div
              className="img-resizer-tool"
              onMouseDown={handleResizeStart}
              style={{
                position: 'absolute',
                top: getHandlePosition().top,
                left: getHandlePosition().left,
                width: 12,
                height: 12,
                background: '#4f46e5',
                border: '2px solid #fff',
                borderRadius: '50%',
                cursor: 'se-resize',
                zIndex: 1010,
                boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
              }}
            />
            {/* Alignment and width preset toolbar */}
            {(() => {
              const isLocked = activeImage.getAttribute('data-lock-ratio') !== 'false';
              return (
                <div
                  className="img-resizer-tool"
                  style={{
                    position: 'absolute',
                    top: getHandlePosition().toolbarTop,
                    left: getHandlePosition().toolbarLeft,
                    background: '#1f2937',
                    color: '#fff',
                    padding: '4px 10px',
                    borderRadius: 8,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 11,
                    zIndex: 1010,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    userSelect: 'none',
                  }}
                >
                  <button
                    type="button"
                    className="img-resizer-tool"
                    onClick={() => { activeImage.style.width = '25%'; activeImage.style.height = 'auto'; handleInput(); }}
                    style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '2px 4px', fontWeight: 600 }}
                  >25%</button>
                  <button
                    type="button"
                    className="img-resizer-tool"
                    onClick={() => { activeImage.style.width = '50%'; activeImage.style.height = 'auto'; handleInput(); }}
                    style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '2px 4px', fontWeight: 600 }}
                  >50%</button>
                  <button
                    type="button"
                    className="img-resizer-tool"
                    onClick={() => { activeImage.style.width = '100%'; activeImage.style.height = 'auto'; handleInput(); }}
                    style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '2px 4px', fontWeight: 600 }}
                  >100%</button>
                  <span style={{ color: '#4b5563' }}>|</span>
                  <button
                    type="button"
                    className="img-resizer-tool"
                    onClick={() => { activeImage.style.display = 'block'; activeImage.style.margin = '6px auto 6px 0'; handleInput(); }}
                    style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '2px 4px', fontWeight: 600 }}
                  >Trái</button>
                  <button
                    type="button"
                    className="img-resizer-tool"
                    onClick={() => { activeImage.style.display = 'block'; activeImage.style.margin = '6px auto'; handleInput(); }}
                    style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '2px 4px', fontWeight: 600 }}
                  >Giữa</button>
                  <button
                    type="button"
                    className="img-resizer-tool"
                    onClick={() => { activeImage.style.display = 'block'; activeImage.style.margin = '6px 0 6px auto'; handleInput(); }}
                    style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '2px 4px', fontWeight: 600 }}
                  >Phải</button>
                  <span style={{ color: '#4b5563' }}>|</span>
                  <button
                    type="button"
                    className="img-resizer-tool"
                    onClick={() => {
                      activeImage.setAttribute('data-lock-ratio', isLocked ? 'false' : 'true');
                      forceUpdate({});
                      handleInput();
                    }}
                    style={{
                      background: isLocked ? 'rgba(99,102,241,0.25)' : 'none',
                      border: 'none',
                      color: isLocked ? '#a5b4fc' : '#fff',
                      cursor: 'pointer',
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    {isLocked ? '🔒 Khóa' : '🔓 Tự do'}
                  </button>
                  <button
                    type="button"
                    className="img-resizer-tool"
                    onClick={() => setCropTargetImage(activeImage)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#fff',
                      cursor: 'pointer',
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    ✂️ Cắt
                  </button>
                </div>
              );
            })()}
          </>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{
        padding: '6px 14px', borderTop: '1px solid #f3f4f6',
        background: '#fafafa', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>
          Hỗ trợ dán ảnh (Ctrl+V) • Nhập "/" để chèn nhanh placeholder động
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button" title="Hoàn tác (Ctrl+Z)" onClick={() => exec('undo')}
            style={{ fontSize: 11, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4 }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
          >↩ Hoàn tác</button>
          <button
            type="button" title="Làm lại (Ctrl+Y)" onClick={() => exec('redo')}
            style={{ fontSize: 11, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4 }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
          >↪ Làm lại</button>
        </div>
      </div>

      {cropTargetImage && (
        <CropModal
          imageElement={cropTargetImage}
          onClose={() => setCropTargetImage(null)}
          onCropComplete={handleCropComplete}
        />
      )}
    </div>
  );
}

// ─── MAIN PAGE COMPONENT ─────────────────────────────────────────────────────
export default function EmailCampaignConfig() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);

  const [locationOptions, setLocationOptions] = useState([]);
  const [customerOptions, setCustomerOptions] = useState([]);

  const [filterPurpose, setFilterPurpose] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchText, setSearchText] = useState('');

  const [showPopup, setShowPopup] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editPurpose, setEditPurpose] = useState('Chào đón khách');
  const [editTemplateName, setEditTemplateName] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editLocation, setEditLocation] = useState('');

  const [isAllCustomer, setIsAllCustomer] = useState(false);
  const [selectedCustomers, setSelectedCustomers] = useState([]);

  const [editSenderName, setEditSenderName] = useState('');
  const [editSenderEmail, setEditSenderEmail] = useState('');
  const [editRecipientName, setEditRecipientName] = useState('');
  const [editRecipientEmail, setEditRecipientEmail] = useState('');
  const [useRecipientLookup, setUseRecipientLookup] = useState(true);

  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editActive, setEditActive] = useState(true);

  // States cho tính năng Nhật ký & Gửi thử nghiệm
  const [activeTab, setActiveTab] = useState('templates'); // 'templates' | 'logs'
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [testProjectId, setTestProjectId] = useState('');
  const [testTemplateId, setTestTemplateId] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => { fetchFilters(); fetchTemplates(); }, []);
  useEffect(() => { fetchTemplates(); }, [filterPurpose, filterLocation, filterCustomer, filterStatus]);

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs();
      fetchSubmissions();
    }
  }, [activeTab]);

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch(window.location.origin + '/api/email-campaigns/logs').then(r => r.json());
      if (res.success) setLogs(res.data || []);
    } catch { toast.error('Lỗi tải nhật ký gửi email'); }
    finally { setLoadingLogs(false); }
  };

  const fetchSubmissions = async () => {
    try {
      const res = await fetch(window.location.origin + '/api/email-campaigns/brand-projects').then(r => r.json());
      if (res.success) setSubmissions(res.data || []);
    } catch { toast.error('Lỗi tải danh sách đơn tiếp đón Brand'); }
  };

  const handleSendTest = async () => {
    if (!testProjectId) return toast.error('Vui lòng chọn đơn tiếp khách');
    setSendingTest(true);
    try {
      const res = await fetch(window.location.origin + '/api/email-campaigns/trigger-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: testProjectId, templateId: testTemplateId || null })
      }).then(r => r.json());

      if (res.success) {
        toast.success(res.message || 'Đã kích hoạt gửi thử thành công!');
        fetchLogs();
      } else {
        toast.error(res.error || 'Gửi thử thất bại');
      }
    } catch (err) {
      toast.error('Lỗi kết nối khi gửi thử');
    } finally {
      setSendingTest(false);
    }
  };


  const fetchFilters = async () => {
    try {
      const [brandRes, partnerRes, locRes] = await Promise.all([
        fetch(window.location.origin + '/api/system-config/lists?category=Brand').then(r => r.json()),
        fetch(window.location.origin + '/api/system-config/lists?category=Partner').then(r => r.json()),
        fetch(window.location.origin + '/api/system-config/locations').then(r => r.json()),
      ]);
      setCustomerOptions([...(brandRes.data || []), ...(partnerRes.data || [])]);
      setLocationOptions(locRes.data || []);
    } catch { toast.error('Lỗi tải dữ liệu bộ lọc'); }
  };

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterPurpose) params.append('purpose', filterPurpose);
      if (filterLocation) params.append('location', filterLocation);
      if (filterCustomer) params.append('customer', filterCustomer);
      if (filterStatus) params.append('isActive', filterStatus);
      if (searchText) params.append('search', searchText);
      const res = await fetch(`/api/email-campaigns?${params}`);
      const data = await res.json();
      if (data.success) setTemplates(data.data);
    } catch { toast.error('Lỗi tải danh sách template'); }
    finally { setLoading(false); }
  };

  const handleAddNew = () => {
    setEditingId(0);
    setEditPurpose('Chào đón khách');
    setEditTemplateName(''); setEditStartDate(''); setEditEndDate('');
    setEditLocation(''); setIsAllCustomer(false); setSelectedCustomers([]);
    setEditSenderName(''); setEditSenderEmail('');
    setEditRecipientName(''); setEditRecipientEmail('');
    setUseRecipientLookup(true); setEditSubject(''); setEditBody('');
    setEditActive(true); setShowPopup(true);
  };

  const handleEdit = (temp) => {
    setEditingId(temp.Id);
    setEditPurpose(temp.Purpose);
    setEditTemplateName(temp.TemplateName);
    setEditStartDate(temp.StartDate ? temp.StartDate.split('T')[0] : '');
    setEditEndDate(temp.EndDate ? temp.EndDate.split('T')[0] : '');
    setEditLocation(temp.Location || '');
    setIsAllCustomer(!!temp.IsAllCustomer);

    let customersList = [];
    try { customersList = temp.Customers ? JSON.parse(temp.Customers) : []; } catch { customersList = []; }

    setSelectedCustomers(temp.IsAllCustomer
      ? ['Chọn tất cả', ...customerOptions.map(c => c.Name)]
      : customersList
    );
    setEditSenderName(temp.SenderName || '');
    setEditSenderEmail(temp.SenderEmail || '');
    setEditRecipientName(temp.RecipientName || '');
    setEditRecipientEmail(temp.RecipientEmail || '');
    setUseRecipientLookup(!temp.RecipientEmail || temp.RecipientEmail.toLowerCase() === 'lookup');
    setEditSubject(temp.EmailSubject || '');
    setEditBody(temp.EmailBody || '');
    setEditActive(!!temp.IsActive);
    setShowPopup(true);
  };

  const handleCopy = async (id) => {
    try {
      const res = await fetch(`/api/email-campaigns/${id}/copy`, { method: 'POST' }).then(r => r.json());
      if (res.success) { toast.success('Sao chép thành công!'); fetchTemplates(); }
      else toast.error(res.error || 'Lỗi sao chép');
    } catch { toast.error('Lỗi kết nối sao chép'); }
  };

  const handleCustomerChange = (newSelected) => {
    const wasAll = selectedCustomers.includes('Chọn tất cả');
    const isAll = newSelected.includes('Chọn tất cả');
    if (isAll && !wasAll) {
      setSelectedCustomers(['Chọn tất cả', ...customerOptions.map(c => c.Name)]);
      setIsAllCustomer(true);
    } else if (!isAll && wasAll) {
      setSelectedCustomers([]); setIsAllCustomer(false);
    } else {
      const filtered = newSelected.filter(x => x !== 'Chọn tất cả');
      if (filtered.length === customerOptions.length) {
        setSelectedCustomers(['Chọn tất cả', ...filtered]); setIsAllCustomer(true);
      } else {
        setSelectedCustomers(filtered); setIsAllCustomer(false);
      }
    }
  };

  const handleSave = async () => {
    if (!editTemplateName.trim()) return toast.error('Vui lòng nhập tên template');
    if (!editSubject.trim()) return toast.error('Vui lòng nhập tiêu đề email');
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!useRecipientLookup && editRecipientEmail && !emailRe.test(editRecipientEmail.trim()))
      return toast.error('Email người nhận không hợp lệ');
    if (editSenderEmail.trim() && !emailRe.test(editSenderEmail.trim()))
      return toast.error('Email người gửi không hợp lệ');

    try {
      const payload = {
        id: editingId, purpose: editPurpose, templateName: editTemplateName,
        startDate: editStartDate || null, endDate: editEndDate || null,
        location: editLocation || null, isAllCustomer,
        customers: isAllCustomer ? [] : selectedCustomers.filter(c => c !== 'Chọn tất cả'),
        senderName: editSenderName, senderEmail: editSenderEmail,
        recipientName: useRecipientLookup ? 'Lookup' : editRecipientName,
        recipientEmail: useRecipientLookup ? 'Lookup' : editRecipientEmail,
        emailSubject: editSubject, emailBody: editBody, isActive: editActive,
      };
      const res = await fetch(window.location.origin + '/api/email-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(r => r.json());
      if (res.success) { toast.success('Lưu template thành công'); setShowPopup(false); fetchTemplates(); }
      else toast.error(res.error || 'Lỗi khi lưu');
    } catch { toast.error('Lỗi kết nối đến máy chủ'); }
  };

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Email Campaign Marketing</h1>
        </div>
      </div>

      {/* TAB SELECTOR */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 pb-2">
        <button
          className={`px-4 py-2 font-bold text-sm transition-all border-b-2 ${
            activeTab === 'templates' 
              ? 'border-indigo-600 text-indigo-600 font-semibold' 
              : 'border-transparent text-gray-500 hover:text-gray-700 font-normal'
          }`}
          onClick={() => setActiveTab('templates')}
        >
          📁 Mẫu Email Campaigns
        </button>
        <button
          className={`px-4 py-2 font-bold text-sm transition-all border-b-2 ${
            activeTab === 'logs' 
              ? 'border-indigo-600 text-indigo-600 font-semibold' 
              : 'border-transparent text-gray-500 hover:text-gray-700 font-normal'
          }`}
          onClick={() => setActiveTab('logs')}
        >
          📋 Nhật ký & Gửi thử nghiệm
        </button>
      </div>

      {activeTab === 'templates' ? (
        <>


      {/* SEARCH FILTERS */}
      <div className="card mb-6">
        <form onSubmit={(e) => { e.preventDefault(); fetchTemplates(); }}
          className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="form-group">
            <label className="text-sm font-semibold">Địa điểm</label>
            <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)}>
              <option value="">Tất cả địa điểm</option>
              {locationOptions.map(l => <option key={l.Id} value={l.Name}>{l.Name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="text-sm font-semibold">Khách hàng</label>
            <select value={filterCustomer} onChange={e => setFilterCustomer(e.target.value)}>
              <option value="">Tất cả khách hàng</option>
              {customerOptions.map(c => <option key={c.Id} value={c.Name}>{c.Name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="text-sm font-semibold">Mục đích</label>
            <select value={filterPurpose} onChange={e => setFilterPurpose(e.target.value)}>
              <option value="">Tất cả mục đích</option>
              <option value="Chào đón khách">Chào đón khách</option>
              <option value="Mời sự kiện">Mời sự kiện</option>
            </select>
          </div>
          <div className="form-group">
            <label className="text-sm font-semibold">Trạng thái</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">Tất cả trạng thái</option>
              <option value="1">Đang hoạt động</option>
              <option value="0">Ngưng hoạt động</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-outline flex-1 justify-center">Lọc</button>
            <button type="button" className="btn btn-primary" onClick={handleAddNew}>+ Thêm</button>
          </div>
        </form>
      </div>

      {/* TEMPLATES TABLE */}
      <div className="card">
        {loading ? (
          <p className="text-center py-8 text-muted">Đang tải...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tên Template</th>
                  <th>Mục đích</th>
                  <th>Địa điểm</th>
                  <th>Khách hàng</th>
                  <th>Trạng thái</th>
                  <th>Hiệu lực</th>
                  <th>Kết thúc</th>
                  <th style={{ width: 160 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {templates.map(temp => {
                  let customersText = '';
                  if (temp.IsAllCustomer) {
                    customersText = 'Tất cả khách hàng';
                  } else {
                    try { customersText = (JSON.parse(temp.Customers || '[]')).join(', ') || '—'; }
                    catch { customersText = '—'; }
                  }
                  const fmt = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : 'Không giới hạn';
                  return (
                    <tr key={temp.Id}>
                      <td className="font-semibold">{temp.TemplateName}</td>
                      <td>
                        <span className={`badge ${temp.Purpose === 'Chào đón khách' ? 'badge-primary' : 'badge-success'}`}>
                          {temp.Purpose}
                        </span>
                      </td>
                      <td>{temp.Location || 'Tất cả'}</td>
                      <td className="text-sm max-w-[180px] truncate" title={customersText}>{customersText}</td>
                      <td>
                        <span className={`badge ${temp.IsActive ? 'badge-success' : 'badge-danger'}`}>
                          {temp.IsActive ? 'Đang hoạt động' : 'Ngưng'}
                        </span>
                      </td>
                      <td>{fmt(temp.StartDate)}</td>
                      <td>{fmt(temp.EndDate)}</td>
                      <td>
                        <div className="flex gap-2">
                          <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(temp)}>Sửa</button>
                          <button className="btn btn-outline btn-sm" onClick={() => handleCopy(temp.Id)}>Sao chép</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {templates.length === 0 && (
                  <tr>
                    <td colSpan="8" className="text-center text-muted py-8">
                      Không tìm thấy email template nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cột trái: Gửi thử nghiệm (1/3 width) */}
          <div className="card h-fit">
            <h3 className="font-bold text-lg mb-4 text-indigo-950 flex items-center gap-2">
              <span>✉️</span> Gửi thử nghiệm Email Campaign
            </h3>
            <p className="text-xs text-muted mb-4">
              Bỏ qua bộ lọc thời gian +7 ngày và chấp nhận cả đơn Nháp để kiểm tra tức thời luồng gửi thư qua Microsoft Graph API.
            </p>
            
            <div className="form-group mb-4">
              <label className="font-semibold text-sm">1. Chọn đơn tiếp đón Brand <span className="required">*</span></label>
              <select 
                value={testProjectId} 
                onChange={e => setTestProjectId(e.target.value)}
                className="w-full"
              >
                <option value="">-- Chọn đơn tiếp đón Brand đã duyệt --</option>
                {submissions.map(sub => {
                  const dateStr = sub.FirstOnboardDate
                    ? new Date(sub.FirstOnboardDate).toLocaleDateString('vi-VN')
                    : '';
                  return (
                    <option key={sub.Project_id} value={sub.Project_id}>
                      [{sub.Project_id}] {sub.CustomerName} — {sub.MeetingTopic || 'Không có chủ đề'}{dateStr ? ` (${dateStr})` : ''}
                    </option>
                  );
                })}
              </select>
              {submissions.length === 0 && (
                <span className="text-xs text-muted mt-1 block">Chưa có đơn Brand nào được BOD duyệt có ngày tiếp đón tương lai.</span>
              )}
            </div>

            <div className="form-group mb-6">
              <label className="font-semibold text-sm">2. Chọn Template Email (Tuỳ chọn)</label>
              <select 
                value={testTemplateId} 
                onChange={e => setTestTemplateId(e.target.value)}
                className="w-full"
              >
                <option value="">-- Tự động khớp theo quy tắc --</option>
                {templates.filter(t => t.IsActive).map(t => (
                  <option key={t.Id} value={t.Id}>
                    {t.TemplateName} ({t.Purpose})
                  </option>
                ))}
              </select>
            </div>

            <button 
              className="btn btn-primary w-full justify-center gap-2"
              onClick={handleSendTest}
              disabled={sendingTest}
            >
              {sendingTest ? (
                <>Đang gửi thử nghiệm...</>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">send</span>
                  Gửi thử ngay
                </>
              )}
            </button>
          </div>

          {/* Cột phải: Nhật ký Logs (2/3 width) */}
          <div className="card lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-indigo-950">📋 Nhật ký gửi chiến dịch</h3>
              <button className="btn btn-outline btn-sm gap-1" onClick={fetchLogs} disabled={loadingLogs}>
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                Tải lại
              </button>
            </div>

            {loadingLogs ? (
              <p className="text-center py-8 text-muted">Đang tải...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Thời gian gửi</th>
                      <th>Mẫu Email</th>
                      <th>Khách hàng</th>
                      <th>Mã đơn</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => {
                      const dateStr = log.SentAt ? new Date(log.SentAt).toLocaleString('vi-VN') : '—';
                      return (
                        <React.Fragment key={log.Id}>
                          <tr>
                            <td className="text-sm">{dateStr}</td>
                            <td className="font-semibold text-sm">{log.TemplateName || 'Mẫu đã bị xoá'}</td>
                            <td className="text-sm">{log.CustomerName || '—'}</td>
                            <td className="text-sm font-mono">{log.ProjectId}</td>
                            <td>
                              <span className={`badge ${log.Status === 'Success' ? 'badge-success' : 'badge-danger'}`}>
                                {log.Status === 'Success' ? 'Thành công' : 'Thất bại'}
                              </span>
                            </td>
                          </tr>
                          {log.Status === 'Failed' && log.ErrorMessage && (
                            <tr style={{ background: '#fff1f0' }}>
                              <td colSpan="5" className="text-xs text-danger font-mono px-4 py-2 border-t border-b border-red-100">
                                ❌ <strong>Lỗi chi tiết:</strong> {log.ErrorMessage}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                    {logs.length === 0 && (
                      <tr>
                        <td colSpan="5" className="text-center text-muted py-8">
                          Chưa có nhật ký gửi email nào.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}


      {/* POPUP */}
      {showPopup && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">

            {/* Modal Header */}
            <div style={{
              padding: '20px 28px 16px',
              borderBottom: '1px solid #f3f4f6',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'linear-gradient(to right, #f5f3ff, #eef2ff)',
              borderRadius: '12px 12px 0 0',
            }}>
              <div>
                <h2 style={{ fontWeight: 700, fontSize: 18, color: '#1e1b4b', margin: 0 }}>
                  {editingId === 0 ? '✉️  Thêm mới Email Template' : '✏️  Chỉnh sửa Email Template'}
                </h2>
                <p style={{ fontSize: 13, color: '#6b7280', margin: '3px 0 0' }}>
                  Thiết lập nội dung và điều kiện áp dụng cho mẫu email tự động
                </p>
              </div>
              <button
                onClick={() => setShowPopup(false)}
                style={{
                  width: 32, height: 32, borderRadius: 8, border: '1px solid #e5e7eb',
                  background: '#fff', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 18,
                  color: '#6b7280', lineHeight: 1,
                }}
              >×</button>
            </div>

            <div style={{ padding: '24px 28px' }} className="space-y-5">

              {/* Row 1 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="font-semibold">Mục đích Email <span className="required">*</span></label>
                  <select value={editPurpose} onChange={e => setEditPurpose(e.target.value)}>
                    <option value="Chào đón khách">Chào đón khách</option>
                    <option value="Mời sự kiện">Mời sự kiện</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="font-semibold">Địa điểm áp dụng</label>
                  <select value={editLocation} onChange={e => setEditLocation(e.target.value)}>
                    <option value="">Tất cả địa điểm</option>
                    {locationOptions.map(l => <option key={l.Id} value={l.Name}>{l.Name}</option>)}
                  </select>
                </div>
              </div>

              {/* Row 2 */}
              <div className="form-group">
                <label className="font-semibold">Tên Email Template <span className="required">*</span></label>
                <input value={editTemplateName} onChange={e => setEditTemplateName(e.target.value)}
                  placeholder="Ví dụ: Thư chào mừng khách Brand XYZ..." />
              </div>

              {/* Row 3 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="font-semibold">Ngày hiệu lực</label>
                  <input type="date" value={editStartDate} onChange={e => setEditStartDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="font-semibold">Ngày kết thúc</label>
                  <input type="date" value={editEndDate} onChange={e => setEditEndDate(e.target.value)} />
                </div>
              </div>

              {/* Row 4: Customers */}
              <div className="form-group">
                <label className="font-semibold">Khách hàng áp dụng <span className="required">*</span></label>
                <ComboboxMultiple
                  options={['Chọn tất cả', ...customerOptions.map(c => c.Name)]}
                  selected={selectedCustomers}
                  onChange={handleCustomerChange}
                  placeholder="Chọn khách hàng áp dụng..."
                />
                <span className="text-xs text-muted block mt-1">
                  Chọn khách hàng cụ thể hoặc "Chọn tất cả" để áp dụng cho mọi khách hàng.
                </span>
              </div>

              {/* Row 5: Sender */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="font-semibold">Tên người gửi (Sender Name)</label>
                  <input value={editSenderName} onChange={e => setEditSenderName(e.target.value)}
                    placeholder="Ví dụ: Ban Giám Đốc VSN" />
                </div>
                <div className="form-group">
                  <label className="font-semibold">Email người gửi (Sender Email)</label>
                  <input value={editSenderEmail} onChange={e => setEditSenderEmail(e.target.value)}
                    placeholder="Mặc định từ SENDER_EMAIL trong env" />
                </div>
              </div>

              {/* Row 6: Recipient */}
              <div style={{
                background: '#f8fafc', border: '1px solid #e2e8f0',
                borderRadius: 10, padding: '14px 16px',
              }}>
                <Field orientation="horizontal" className="items-center gap-2 mb-3">
                  <Checkbox id="use-lookup" checked={useRecipientLookup} onCheckedChange={setUseRecipientLookup} />
                  <FieldLabel htmlFor="use-lookup" className="font-semibold cursor-pointer text-sm">
                    Tự động lấy thông tin người nhận từ cấu hình Khách hàng
                  </FieldLabel>
                </Field>
                {!useRecipientLookup && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="font-semibold text-xs">Đến tên</label>
                      <input value={editRecipientName} onChange={e => setEditRecipientName(e.target.value)}
                        placeholder="Ví dụ: Đại diện Ban dự án" />
                    </div>
                    <div className="form-group">
                      <label className="font-semibold text-xs">Đến email</label>
                      <input value={editRecipientEmail} onChange={e => setEditRecipientEmail(e.target.value)}
                        placeholder="Ví dụ: rep@partner.com" />
                    </div>
                  </div>
                )}
              </div>

              {/* Row 7: Subject */}
              <div className="form-group">
                <label className="font-semibold">Tiêu đề Email <span className="required">*</span></label>
                <SubjectEditor value={editSubject} onChange={setEditSubject} />
                <span className="text-xs text-muted block mt-1">
                  Nhập "/" để chèn nhanh placeholder động vào tiêu đề
                </span>
              </div>

              {/* Row 8: Body */}
              <div className="form-group">
                <label className="font-semibold mb-2 block">Nội dung Email</label>
                <RichTextEditor value={editBody} onChange={setEditBody} />
              </div>

              {/* Active toggle */}
              <Field orientation="horizontal" className="items-center gap-2">
                <Checkbox id="template-active" checked={editActive} onCheckedChange={setEditActive} />
                <FieldLabel htmlFor="template-active" className="font-semibold cursor-pointer">
                  Kích hoạt template này (Đang hoạt động)
                </FieldLabel>
              </Field>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 28px', borderTop: '1px solid #f3f4f6',
              display: 'flex', justifyContent: 'flex-end', gap: 12,
              background: '#fafafa', borderRadius: '0 0 12px 12px',
            }}>
              <button className="btn btn-outline" onClick={() => setShowPopup(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={handleSave}>Lưu mẫu email</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
