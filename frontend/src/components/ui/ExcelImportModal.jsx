// src/components/ui/ExcelImportModal.jsx
// Generic Excel import modal — reusable across all config pages
import { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { downloadTemplate, parseExcelFile } from '../../utils/excelUtils';

/**
 * @param {string}   title          — Modal title e.g. "Import địa điểm"
 * @param {string}   templateName   — filename for downloaded template e.g. "template_dia_diem.xlsx"
 * @param {Array}    columns        — [{key, label, required, example}]
 * @param {Function} onImport(rows) — async callback; receives parsed row objects
 * @param {Function} onClose        — close modal
 */
export default function ExcelImportModal({ title, templateName, columns, onImport, onClose }) {
  const [parsedRows, setParsedRows] = useState(null);
  const [parseErrors, setParseErrors] = useState([]);
  const [fileName, setFileName] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Vui lòng chọn file .xlsx hoặc .xls');
      return;
    }
    setFileName(file.name);
    setIsParsing(true);
    setParsedRows(null);
    setParseErrors([]);
    try {
      const { rows, errors } = await parseExcelFile(file, columns);
      setParsedRows(rows);
      setParseErrors(errors);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirm = async () => {
    if (!parsedRows || parsedRows.length === 0) return;
    setIsImporting(true);
    try {
      await onImport(parsedRows);
    } finally {
      setIsImporting(false);
    }
  };

  const previewRows = parsedRows ? parsedRows.slice(0, 10) : [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 py-10 px-4 overflow-y-auto">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-outline-variant">
          <div>
            <h2 className="text-xl font-bold">{title}</h2>
            <p className="text-sm text-on-surface-variant mt-0.5">
              Tải template, điền dữ liệu rồi upload để import hàng loạt
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Step 1: Download template */}
          <div className="flex items-start gap-4 p-4 rounded-xl border border-outline-variant bg-surface-container">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold shrink-0">1</div>
            <div className="flex-1">
              <p className="font-semibold text-sm mb-1">Tải file template</p>
              <p className="text-xs text-on-surface-variant mb-3">
                File Excel mẫu có đầy đủ cột và dữ liệu ví dụ. Các cột có dấu <code className="bg-surface-container-high px-1 rounded">(*)</code> là bắt buộc.
              </p>
              <button
                onClick={() => downloadTemplate(columns, templateName)}
                className="btn btn-outline btn-sm gap-2"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                Tải template ({templateName})
              </button>
            </div>
          </div>

          {/* Step 2: Upload file */}
          <div className="flex items-start gap-4 p-4 rounded-xl border border-outline-variant bg-surface-container">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold shrink-0">2</div>
            <div className="flex-1">
              <p className="font-semibold text-sm mb-1">Upload file đã điền</p>
              <p className="text-xs text-on-surface-variant mb-3">Chỉ hỗ trợ file .xlsx hoặc .xls</p>
              <div className="flex items-center gap-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="btn btn-outline btn-sm gap-2"
                  disabled={isParsing}
                >
                  <span className="material-symbols-outlined text-[16px]">upload_file</span>
                  {isParsing ? 'Đang đọc file...' : 'Chọn file Excel'}
                </button>
                {fileName && (
                  <span className="text-sm text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-success">check_circle</span>
                    {fileName}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Parse errors */}
          {parseErrors.length > 0 && (
            <div className="rounded-xl border border-danger/30 bg-danger/5 p-4">
              <p className="font-semibold text-sm text-danger mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">warning</span>
                {parseErrors.length} dòng bị bỏ qua do thiếu thông tin bắt buộc
              </p>
              <ul className="text-xs text-danger/80 space-y-1 max-h-32 overflow-y-auto">
                {parseErrors.map((e, i) => <li key={i}>• {e}</li>)}
              </ul>
            </div>
          )}

          {/* Preview table */}
          {parsedRows !== null && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-sm">
                  Xem trước dữ liệu
                  <span className="ml-2 badge badge-success">{parsedRows.length} dòng hợp lệ</span>
                  {parseErrors.length > 0 && (
                    <span className="ml-2 badge badge-danger">{parseErrors.length} dòng lỗi</span>
                  )}
                </p>
                {parsedRows.length > 10 && (
                  <span className="text-xs text-on-surface-variant">Hiển thị 10 / {parsedRows.length} dòng</span>
                )}
              </div>

              {parsedRows.length === 0 ? (
                <div className="text-center py-8 text-on-surface-variant text-sm">
                  Không có dòng dữ liệu hợp lệ nào
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-outline-variant">
                  <table className="data-table text-xs">
                    <thead>
                      <tr>
                        <th className="w-8">#</th>
                        {columns.map(col => (
                          <th key={col.key}>
                            {col.label}
                            {col.required && <span className="text-danger ml-1">*</span>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, i) => (
                        <tr key={i}>
                          <td className="text-on-surface-variant">{i + 1}</td>
                          {columns.map(col => (
                            <td key={col.key} style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {row[col.key] || <span className="text-on-surface-variant/40">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-outline-variant">
          <button onClick={onClose} className="btn btn-outline" disabled={isImporting}>Hủy</button>
          <button
            onClick={handleConfirm}
            className="btn btn-primary px-8 gap-2"
            disabled={!parsedRows || parsedRows.length === 0 || isImporting}
          >
            {isImporting
              ? <><span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span> Đang import...</>
              : <><span className="material-symbols-outlined text-[16px]">upload</span> Xác nhận import {parsedRows?.length || 0} dòng</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
