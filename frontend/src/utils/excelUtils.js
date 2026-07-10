// src/utils/excelUtils.js
// Utility functions for Excel import/export using exceljs
import ExcelJS from 'exceljs';

/**
 * Download a template Excel file with headers, an example row, and Data Validation.
 * @param {Array<{key, label, required, example, validationList}>} columns
 * @param {string} filename  e.g. 'template_dia_diem.xlsx'
 */
export async function downloadTemplate(columns, filename) {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data');

    // Row 1: Headers
    const headerRow = columns.map(c => c.required ? `${c.label} (*)` : c.label);
    worksheet.addRow(headerRow);

    // Row 2: Example data
    const exampleRow = columns.map(c => c.example ?? '');
    worksheet.addRow(exampleRow);

    // Format columns and widths
    worksheet.columns = columns.map((col, idx) => ({
      key: col.key,
      width: 25
    }));

    // Style headers: bold, light blue background, border
    const firstRow = worksheet.getRow(1);
    firstRow.font = { bold: true, color: { argb: 'FF000000' } };
    firstRow.alignment = { vertical: 'middle', horizontal: 'center' };
    
    // Fill background for headers
    columns.forEach((col, colIdx) => {
      const cell = firstRow.getCell(colIdx + 1);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE6F7FF' } // light blue
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
      };
    });

    // Add Data Validation list (combobox dropdown)
    columns.forEach((col, colIdx) => {
      if (col.validationList && col.validationList.length > 0) {
        const colLetter = String.fromCharCode(65 + colIdx); // A, B, C...
        
        // Apply validation to rows 2 through 100
        for (let r = 2; r <= 100; r++) {
          const cell = worksheet.getCell(`${colLetter}${r}`);
          cell.dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: [`"${col.validationList.join(',')}"`],
            showErrorMessage: true,
            errorTitle: 'Dữ liệu không hợp lệ',
            error: 'Vui lòng chọn giá trị có sẵn trong danh sách.'
          };
        }
      }
    });

    // Write to buffer and trigger download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  } catch (err) {
    console.error('Error generating Excel template:', err);
    throw new Error('Lỗi khi sinh file mẫu: ' + err.message);
  }
}

/**
 * Parse an uploaded Excel file into an array of objects.
 * @param {File} file
 * @param {Array<{key, label, required}>} columns  — defines expected headers
 * @returns {Promise<{rows: Array, errors: Array<string>}>}
 */
export function parseExcelFile(file, columns) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const buffer = e.target.result;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        
        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
          return resolve({ rows: [], errors: ['File Excel không có sheet nào'] });
        }

        const rawRows = [];
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          const rowValues = [];
          // ExcelJS is 1-based, we extract up to the column count
          for (let colIdx = 1; colIdx <= columns.length; colIdx++) {
            const cell = row.getCell(colIdx);
            rowValues.push(cell.value !== null && cell.value !== undefined ? cell.value : '');
          }
          rawRows.push({ values: rowValues, rowNum: rowNumber });
        });

        if (rawRows.length < 2) {
          return resolve({ rows: [], errors: ['File không có dữ liệu (cần ít nhất 1 dòng dữ liệu bên dưới header)'] });
        }

        // Header Row
        const headerRow = rawRows[0].values.map(h => {
          if (h && typeof h === 'object' && h.richText) {
            return h.richText.map(t => t.text).join('').trim();
          }
          return String(h || '').trim();
        });

        // Mapping from header label → column key
        const labelToKey = {};
        columns.forEach(col => {
          const cleanLabel = col.label.replace(/\s*\(\*\)\s*$/, '').trim();
          labelToKey[cleanLabel] = col.key;
          labelToKey[`${cleanLabel} (*)`] = col.key;
          labelToKey[col.label] = col.key;
        });

        const headerKeys = headerRow.map(h => {
          const clean = h.replace(/\s*\(\*\)\s*$/, '').trim();
          return labelToKey[h] || labelToKey[clean] || null;
        });

        const rows = [];
        const errors = [];

        // Data Rows starting from index 1 (row 2 in sheet)
        const dataRows = rawRows.slice(1);

        dataRows.forEach((rawRow) => {
          const obj = {};
          headerKeys.forEach((key, colIdx) => {
            if (key) {
              const cellVal = rawRow.values[colIdx];
              // Handle ExcelJS hyperlink / formula / rich text / regular values
              let cleanVal = '';
              if (cellVal !== null && cellVal !== undefined) {
                if (typeof cellVal === 'object') {
                  if (cellVal.result !== undefined) {
                    cleanVal = String(cellVal.result);
                  } else if (cellVal.text !== undefined) {
                    cleanVal = String(cellVal.text);
                  } else if (cellVal.richText !== undefined) {
                    cleanVal = cellVal.richText.map(t => t.text).join('');
                  } else {
                    cleanVal = JSON.stringify(cellVal);
                  }
                } else {
                  cleanVal = String(cellVal);
                }
              }
              obj[key] = cleanVal.trim();
            }
          });

          // Validate required fields
          const missingRequired = columns
            .filter(c => c.required)
            .filter(c => !obj[c.key] || obj[c.key] === '');

          if (missingRequired.length > 0) {
            errors.push(`Dòng ${rawRow.rowNum}: Thiếu trường bắt buộc: ${missingRequired.map(c => c.label).join(', ')}`);
          } else {
            rows.push(obj);
          }
        });

        resolve({ rows, errors });
      } catch (err) {
        reject(new Error('Không thể đọc file Excel: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('Lỗi đọc file'));
    reader.readAsArrayBuffer(file);
  });
}
