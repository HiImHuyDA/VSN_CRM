// src/routes/export.js
// Export danh sách đơn ra file Excel (.xlsx)
const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const { getCsrPool, sql } = require('../config/database');

/**
 * GET /api/export/submissions
 * Query params giống hệt /api/submissions (tab, role, mnv, status, ...)
 * Trả về file .xlsx stream
 */
router.get('/submissions', async (req, res, next) => {
  try {
    const {
      search = '', status = '', role = '', mnv = '',
      tab = 'search',
      // Filter params (id, customer, location, year, month, dateFrom, dateTo)
    } = req.query;

    const pool = await getCsrPool();

    // Lấy tất cả (pageSize lớn) — export không phân trang
    const result = await pool.request()
      .input('SearchText', sql.NVarChar(200), search)
      .input('Status',     sql.NVarChar(50),  status)
      .input('ActorRole',  sql.NVarChar(50),  role)
      .input('ActorMNV',   sql.NVarChar(50),  mnv)
      .input('PageNumber', sql.Int,            1)
      .input('PageSize',   sql.Int,            9999)
      .input('Tab',        sql.NVarChar(50),  tab)
      .execute('usp_Submission_List');

    let rows = result.recordsets[0] || [];

    // ── Apply client-side filters (giống SubmissionList.jsx) ──
    const ids       = req.query.id        ? [].concat(req.query.id)       : [];
    const customers = req.query.customer  ? [].concat(req.query.customer) : [];
    const locations = req.query.location  ? [].concat(req.query.location) : [];
    const statuses  = req.query.status    ? [].concat(req.query.status)   : [];
    const years     = req.query.year      ? [].concat(req.query.year)     : [];
    const months    = req.query.month     ? [].concat(req.query.month)    : [];
    const dateFrom  = req.query.dateFrom  ? new Date(req.query.dateFrom)  : null;
    const dateTo    = req.query.dateTo    ? new Date(req.query.dateTo)    : null;

    const parseLocalDate = (str) => {
      if (!str || !str.trim()) return null;
      const parts = str.trim().split('-');
      if (parts.length !== 3) return null;
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    };

    if (ids.length)       rows = rows.filter(r => ids.includes(String(r.Project_id)));
    if (customers.length) rows = rows.filter(r => customers.includes(r.CustomerName));
    if (locations.length) rows = rows.filter(r => locations.some(l => (r.Destinations || '').includes(l)));
    if (statuses.length)  rows = rows.filter(r => statuses.includes(r.Status));
    if (years.length)     rows = rows.filter(r => years.some(y => (r.OnboardDates || '').includes(y)));
    if (months.length) {
      rows = rows.filter(r => {
        const dates = (r.OnboardDates || '').split(',');
        return months.some(m => {
          const num = m.replace('Tháng ', '').padStart(2, '0');
          return dates.some(d => d.trim().split('-')[1] === num);
        });
      });
    }
    if (dateFrom || dateTo) {
      rows = rows.filter(r => {
        const dates = (r.OnboardDates || '').split(',').map(d => parseLocalDate(d)).filter(Boolean);
        if (!dates.length) return true;
        return dates.some(d => {
          const from = dateFrom ? new Date(dateFrom.setHours(0,0,0,0)) : null;
          const to   = dateTo   ? new Date(dateTo.setHours(23,59,59,999)) : null;
          return (!from || d >= from) && (!to || d <= to);
        });
      });
    }

    // ── Build Excel workbook ──────────────────────────────────
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CSR System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Danh sách đơn tiếp đón', {
      pageSetup: { paperSize: 9, orientation: 'landscape' }
    });

    // Header style
    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1565C0' } };
    const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    const centerAlign = { horizontal: 'center', vertical: 'middle', wrapText: true };
    const borderStyle = { style: 'thin', color: { argb: 'FFB0BEC5' } };
    const allBorders = { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle };

    // Columns
    sheet.columns = [
      { header: 'Mã Đơn',       key: 'id',         width: 12 },
      { header: 'Khách hàng',   key: 'customer',   width: 28 },
      { header: 'Loại KH',      key: 'type',       width: 12 },
      { header: 'Ngày tiếp đón',key: 'dates',      width: 22 },
      { header: 'Địa điểm',     key: 'dest',       width: 20 },
      { header: 'Chủ đề',       key: 'topic',      width: 35 },
      { header: 'Người tạo',    key: 'submitter',  width: 22 },
      { header: 'Trạng thái',   key: 'status',     width: 18 },
      { header: 'Ngày tạo đơn', key: 'createdAt',  width: 18 },
      { header: 'Ngày cập nhật',key: 'updatedAt',  width: 18 },
    ];

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell(cell => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = centerAlign;
      cell.border = allBorders;
    });

    // Status color map
    const statusColors = {
      'BOD đã duyệt':  'FF1B5E20',
      'PRD đã duyệt':  'FF004D40',
      'Hoàn thành':    'FF4A148C',
      'Chờ phản hồi':  'FF0D47A1',
      'PRD từ chối':   'FFB71C1C',
      'BOD từ chối':   'FFB71C1C',
      'Đã huỷ':        'FF424242',
    };

    // Format date display
    const fmtDates = (datesStr) => {
      if (!datesStr) return '';
      return datesStr.split(',').map(d => {
        const p = d.trim().split('-');
        return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d.trim();
      }).join('\n');
    };

    const fmtDateTime = (val) => {
      if (!val) return '';
      const d = new Date(val);
      if (isNaN(d)) return String(val);
      return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    };

    // Data rows
    rows.forEach((item, i) => {
      const row = sheet.addRow({
        id:        item.Project_id,
        customer:  item.CustomerName,
        type:      item.CustomerType,
        dates:     fmtDates(item.OnboardDates),
        dest:      item.Destinations,
        topic:     item.MeetingTopic,
        submitter: item.SubmitterName,
        status:    item.Status,
        createdAt: fmtDateTime(item.CreatedAt),
        updatedAt: fmtDateTime(item.UpdatedAt),
      });

      row.height = 32;
      const isEven = i % 2 === 0;
      row.eachCell(cell => {
        cell.alignment = { vertical: 'middle', wrapText: true };
        cell.border = allBorders;
        cell.fill = {
          type: 'pattern', pattern: 'solid',
          fgColor: { argb: isEven ? 'FFFAFAFA' : 'FFFFFFFF' }
        };
      });

      // Status cell color
      const statusCell = row.getCell('status');
      const color = statusColors[item.Status];
      if (color) {
        statusCell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
        statusCell.alignment = { horizontal: 'center', vertical: 'middle' };
      }

      // ID cell style
      row.getCell('id').font = { bold: true, color: { argb: 'FF1565C0' } };
    });

    // Freeze header
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Auto filter
    sheet.autoFilter = { from: 'A1', to: 'J1' };

    // Summary row
    const summaryRow = sheet.addRow(['Tổng cộng:', `${rows.length} đơn`, '', '', '', '', '', '', '', '']);
    summaryRow.getCell(1).font = { bold: true, italic: true };
    summaryRow.getCell(2).font = { bold: true, color: { argb: 'FF1565C0' } };

    // ── Stream response ───────────────────────────────────────
    const dateTag = new Date().toISOString().slice(0, 10);
    const filename = encodeURIComponent(`DSach_Don_TiepDon_${dateTag}.xlsx`);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    next(err);
  }
});

module.exports = router;
