const axios = require('axios');

/**
 * Mã hóa SharePoint Share URL sang ShareId tương thích Graph API
 */
function getShareId(shareUrl) {
  const base64 = Buffer.from(shareUrl).toString('base64');
  return 'u!' + base64.replace(/=/g, '').replace(/\//g, '_').replace(/\+/g, '-');
}

/**
 * Lấy driveId và itemId từ Share URL của file Excel
 */
async function getDriveAndItemId(accessToken, shareUrl) {
  try {
    const shareId = getShareId(shareUrl);
    const url = `https://graph.microsoft.com/v1.0/shares/${shareId}/driveItem`;
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 8000
    });
    const driveId = response.data.parentReference.driveId;
    const itemId = response.data.id;
    return { driveId, itemId };
  } catch (err) {
    console.error('[SharePoint Excel] ❌ Failed to resolve share URL:', err.message);
    throw new Error('Không thể giải quyết đường dẫn chia sẻ SharePoint: ' + err.message);
  }
}

/**
 * Ghi hoặc cập nhật một dòng công tác vào file Excel thông qua Excel Table API
 */
async function upsertExcelRow(accessToken, shareUrl, tableNameConfig, projectId, data) {
  if (!shareUrl) {
    console.warn('[SharePoint Excel] ⚠️ No SHARE_URL configured. Skipping Excel operations.');
    return;
  }

  const tableName = tableNameConfig || 'Table1';
  try {
    const { driveId, itemId } = await getDriveAndItemId(accessToken, shareUrl);
    console.log(`[SharePoint Excel] 📁 Resolved file. Drive ID: ${driveId}, Item ID: ${itemId}`);

    // 1. Lấy danh sách các dòng của Table
    const rowsUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/workbook/tables/${tableName}/rows`;
    let rows = [];
    
    try {
      const res = await axios.get(rowsUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 8000
      });
      rows = res.data.value || [];
    } catch (err) {
      console.error(`[SharePoint Excel] ❌ Không tìm thấy Table tên "${tableName}" trong file Excel. Vui lòng tạo Table trước.`);
      throw err;
    }

    // 2. Tìm dòng khớp bằng cách đối chiếu CSR_Id (cột 32), Địa điểm công tác (cột 11) và Ngày đi (cột 26)
    let targetRowIndex = -1;
    let maxId = 0;

    for (const row of rows) {
      const vals = row.values?.[0] || [];
      if (vals.length === 0) continue;

      // Tìm ID (cột 0) lớn nhất để tự tăng
      const numericId = parseInt(vals[0], 10);
      if (!isNaN(numericId) && numericId > maxId) {
        maxId = numericId;
      }

      const rowCsrId = String(vals[32] || '').trim();
      const rowDest = String(vals[11] || '').trim();
      const rowNgayDi = String(vals[26] || '').trim();

      // So sánh để tìm dòng cũ
      if (rowCsrId === projectId && rowDest === data.diaDiemCongTac && rowNgayDi === data.ngayDi) {
        targetRowIndex = row.index; // 0-indexed index của dòng trong Table
      }
    }

    // Lấy động số lượng cột của Table dựa trên dòng dữ liệu thực tế
    let tableColsCount = 35; // Mặc định 35 theo DangKyDiCongTac3
    if (rows.length > 0 && rows[0].values?.[0]) {
      tableColsCount = rows[0].values[0].length;
    }

    // 3. Khởi tạo mảng dữ liệu có số cột tương ứng của Table
    let rowData = Array(tableColsCount).fill('');

    if (targetRowIndex !== -1) {
      // Sao chép lại toàn bộ dữ liệu dòng hiện có (để giữ nguyên các thông tin tài xế/xe đã được nhập tay)
      const matchingRow = rows.find(r => r.index === targetRowIndex);
      if (matchingRow && matchingRow.values?.[0]) {
        rowData = [...matchingRow.values[0]];
      }
    }

    // Ghi đè các cột dữ liệu theo đúng cấu trúc yêu cầu
    rowData[1] = targetRowIndex !== -1 ? (rowData[1] || 'Đã duyệt') : 'Đã duyệt'; // TRẠNG THÁI
    rowData[2] = rowData[2] || ''; // ĐĂNG KÍ (để trống)
    rowData[3] = data.donVi || rowData[3]; // ĐƠN VỊ
    rowData[4] = data.phong || rowData[4]; // PHÒNG
    rowData[5] = data.mnv || rowData[5]; // MNV
    rowData[6] = data.nguoiTao || rowData[6]; // NGƯỜI TẠO
    rowData[7] = data.email || rowData[7]; // EMAIL
    rowData[8] = data.noiDungCongViec || rowData[8]; // NỘI DUNG CÔNG VIỆC
    rowData[9] = rowData[9] || ''; // Column1 (để trống)
    rowData[10] = data.soNguoi !== undefined ? data.soNguoi : rowData[10]; // SỐ NGƯỜI
    rowData[11] = data.diaDiemCongTac || rowData[11]; // ĐỊA ĐIỂM CÔNG TÁC
    rowData[12] = data.danhSachDi || rowData[12]; // DANH SÁCH ĐI
    rowData[13] = data.thongTin || rowData[13]; // THÔNG TIN
    // Cột1 đến Cột9 (chỉ số 14 đến 22) giữ nguyên hoặc để trống
    for (let idx = 14; idx <= 22; idx++) {
      rowData[idx] = rowData[idx] || '';
    }
    rowData[23] = data.phuongTien || rowData[23]; // PHƯƠNG TIỆN
    rowData[24] = data.thang || rowData[24]; // THÁNG (ghi Ngày đi)
    rowData[25] = rowData[25] || ''; // THỨ (để trống để Excel tự tính hoặc điền sau)
    rowData[26] = data.ngayDi || rowData[26]; // NGÀY ĐI
    rowData[27] = data.ngayVe || rowData[27]; // NGÀY VỀ
    rowData[32] = projectId; // CSR_Id (mã đơn tiếp khách gốc)

    if (targetRowIndex !== -1) {
      // Thực hiện UPDATE dòng tại index được tìm thấy
      console.log(`[SharePoint Excel Table] 🔄 Đã tìm thấy đơn ${projectId} tại hàng index ${targetRowIndex}. Đang cập nhật...`);
      const updateUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/workbook/tables/${tableName}/rows/itemAt(index=${targetRowIndex})`;
      await axios.patch(updateUrl, {
        values: [rowData]
      }, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 8000
      });
      console.log(`[SharePoint Excel Table] ✅ Cập nhật hàng index ${targetRowIndex} thành công.`);
    } else {
      // Thực hiện INSERT dòng mới
      const newId = maxId + 1;
      rowData[0] = newId; // ID tự tăng

      console.log(`[SharePoint Excel Table] ➕ Không tìm thấy đơn trùng khớp. Đang thêm dòng mới với ID = ${newId}...`);
      const insertUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/workbook/tables/${tableName}/rows`;
      await axios.post(insertUrl, {
        values: [rowData]
      }, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 8000
      });
      console.log(`[SharePoint Excel Table] ✅ Đã thêm dòng mới vào Table thành công.`);
    }

  } catch (error) {
    console.error('[SharePoint Excel Table] ❌ Operation failed:', error.response?.data || error.message);
  }
}

/**
 * Ghi hoặc cập nhật một dòng thông tin ra vào cổng vào file Excel theo dõi ra vào cổng
 */
async function upsertGateExcelRow(accessToken, shareUrl, tableNameConfig, projectId, data) {
  if (!shareUrl) {
    console.warn('[SharePoint Gate Excel] ⚠️ No SHAREPOINT_GATE_EXCEL_URL configured. Skipping Gate Excel operations.');
    return;
  }

  const tableName = tableNameConfig || 'Table1';
  try {
    const { driveId, itemId } = await getDriveAndItemId(accessToken, shareUrl);
    console.log(`[SharePoint Gate Excel] Resolved gate file. Drive ID: ${driveId}, Item ID: ${itemId}`);

    // 1. Lấy danh sách các dòng của Table
    const rowsUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/workbook/tables/${tableName}/rows`;
    let rows = [];
    
    try {
      const res = await axios.get(rowsUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 8000
      });
      rows = res.data.value || [];
    } catch (err) {
      console.error(`[SharePoint Gate Excel] ❌ Không tìm thấy Table tên "${tableName}" trong file Gate Excel. Vui lòng tạo Table trước.`);
      throw err;
    }

    // 2. Tìm dòng khớp theo cột PROJECT (cột 0) và cột Ngày Đến (cột 2)
    let targetRowIndex = -1;

    for (const row of rows) {
      const vals = row.values?.[0] || [];
      if (vals.length === 0) continue;

      const rowProjectId = String(vals[0] || '').trim();
      const rowNgayDen = String(vals[2] || '').trim();
      if (rowProjectId === projectId && rowNgayDen === data.ngayDen) {
        targetRowIndex = row.index; // 0-indexed index của dòng trong Table
      }
    }

    // Xác định số lượng cột của Table (mặc định 9)
    let tableColsCount = 9;
    if (rows.length > 0 && rows[0].values?.[0]) {
      tableColsCount = rows[0].values[0].length;
    }

    // 3. Khởi tạo mảng dữ liệu
    let rowData = Array(tableColsCount).fill('');

    if (targetRowIndex !== -1) {
      // Sao chép lại toàn bộ dữ liệu dòng hiện có (để giữ nguyên cột Giờ vào thực tế bảo vệ đã nhập)
      const matchingRow = rows.find(r => r.index === targetRowIndex);
      if (matchingRow && matchingRow.values?.[0]) {
        rowData = [...matchingRow.values[0]];
      }
    }

    // Ghi đè các cột dữ liệu theo đúng cấu trúc yêu cầu
    rowData[0] = projectId; // PROJECT
    rowData[1] = data.customerName || rowData[1]; // Khách Hàng
    rowData[2] = data.ngayDen || rowData[2]; // Ngày Đến
    rowData[3] = 'VSN OFFICE'; // Nơi Đến
    rowData[4] = data.guestInfo || rowData[4]; // Thông tin khách hàng
    rowData[5] = data.lyDo || rowData[5]; // Lý Do Đăng Ký Tham Quan
    rowData[6] = data.mnvTiepNhan || rowData[6]; // MNV Người Tiếp Nhận
    rowData[7] = data.nguoiTiepNhan || rowData[7]; // Người Tiếp Nhận
    // rowData[8] là Giờ vào thực tế (Bảo vệ) -> giữ nguyên giá trị cũ nếu đã có, hoặc để trống

    if (targetRowIndex !== -1) {
      // UPDATE
      console.log(`[SharePoint Gate Excel] 🔄 Đã tìm thấy dự án ${projectId} tại hàng index ${targetRowIndex}. Đang cập nhật...`);
      const updateUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/workbook/tables/${tableName}/rows/itemAt(index=${targetRowIndex})`;
      await axios.patch(updateUrl, {
        values: [rowData]
      }, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 8000
      });
      console.log(`[SharePoint Gate Excel] ✅ Cập nhật hàng index ${targetRowIndex} thành công.`);
    } else {
      // INSERT
      console.log(`[SharePoint Gate Excel] ➕ Đang thêm dòng mới cho dự án ${projectId}...`);
      const insertUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/workbook/tables/${tableName}/rows`;
      await axios.post(insertUrl, {
        values: [rowData]
      }, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 8000
      });
      console.log(`[SharePoint Gate Excel] ✅ Đã thêm dòng mới vào Table thành công.`);
    }

  } catch (error) {
    console.error('[SharePoint Gate Excel] ❌ Operation failed:', error.response?.data || error.message);
  }
}

module.exports = {
  upsertExcelRow,
  upsertGateExcelRow
};

