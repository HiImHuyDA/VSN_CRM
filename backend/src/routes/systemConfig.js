const express = require('express');
const router = express.Router();
const { getCsrPool, sql } = require('../config/database');
const authenticateToken = require('../middleware/auth');

async function checkConfigPermission(req, res, next) {
  try {
    const { role } = req.user;
    if (role === 'Admin') {
      return next();
    }

    // Determine menu key based on request path/body
    let menuKey = 'guest.config';
    if (req.path === '/locations' || req.path === '/locations/batch') {
      menuKey = 'guest.config.locations';
    } else if (req.path === '/task-configs' || req.path === '/task-configs/batch' || req.path === '/task-configs/copy') {
      menuKey = 'guest.config.tasks';
    } else if (req.path === '/lists' || req.path === '/lists/batch') {
      const category = req.body.category || (req.body.rows?.[0]?.category);
      if (['CustomerType', 'BrandName', 'PartnerName', 'SupplierName'].includes(category)) {
        menuKey = 'guest.config.customers';
      } else if (category === 'MeetingRoom') {
        menuKey = 'guest.config.meeting-rooms';
      } else if (['LunchMenu', 'DinnerRestaurant'].includes(category)) {
        menuKey = 'guest.config.restaurants';
      }
    }

    const pool = await getCsrPool();
    const result = await pool.request()
      .input('Role', sql.NVarChar(50), role)
      .input('MenuKey', sql.NVarChar(100), menuKey)
      .output('HasPermission', sql.Int)
      .execute('usp_MenuPermission_Check');

    if (result.output.HasPermission !== 1) {
      return res.status(403).json({
        success: false,
        error: 'Bạn không có quyền thực hiện chức năng này'
      });
    }

    next();
  } catch (err) {
    next(err);
  }
}


// GET /api/system-config/lists?category=CustomerType
router.get('/lists', async (req, res, next) => {
  try {
    const { category } = req.query;
    const pool = await getCsrPool();

    if (category === 'DinnerRestaurant') {
      const result = await pool.request().execute('usp_GetDinnerRestaurants');
      const restaurants = result.recordsets[0] || [];
      const allComments = result.recordsets[1] || [];

      const enrichedData = restaurants.map(rest => {
        const comments = allComments
          .filter(c => c.RestaurantName === rest.Name)
          .map(c => ({
            comment: c.Comment,
            rating: c.Rating,
            reviewerName: c.ReviewerName,
            createdAt: c.CreatedAt
          }));
        return {
          ...rest,
          usageCount: rest.UsageCount || 0,
          avgRating: rest.AvgRating || null,
          reviewCount: rest.ReviewCount || 0,
          comments
        };
      });

      return res.json({ success: true, data: enrichedData });
    }

    const result = await pool.request()
      .input('Category', sql.NVarChar(50), category || null)
      .execute('usp_GetConfigList');
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    next(err);
  }
});

// POST /api/system-config/lists
router.post('/lists', authenticateToken, checkConfigPermission, async (req, res, next) => {
  try {
    const { id, category, name, email, jsonData, isActive, statusId } = req.body;
    const pool = await getCsrPool();
    await pool.request()
      .input('Id', sql.Int, id || 0)
      .input('Category', sql.NVarChar(50), category)
      .input('Name', sql.NVarChar(200), name)
      .input('Email', sql.NVarChar(200), email || null)
      .input('JsonData', sql.NVarChar(sql.MAX), jsonData ? JSON.stringify(jsonData) : null)
      .input('IsActive', sql.Bit, isActive !== undefined ? isActive : null)
      .input('StatusId', sql.Int, statusId || null)
      .execute('usp_UpsertConfigList');
    res.json({ success: true, message: 'Lưu thành công' });
  } catch (err) {
    next(err);
  }
});

// GET /api/system-config/locations
router.get('/locations', async (req, res, next) => {
  try {
    const pool = await getCsrPool();
    const result = await pool.request().execute('usp_GetLocations');
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    next(err);
  }
});

// POST /api/system-config/locations
router.post('/locations', authenticateToken, checkConfigPermission, async (req, res, next) => {
  try {
    const { id, name, notificationEmails, isActive } = req.body;
    const pool = await getCsrPool();
    await pool.request()
      .input('Id', sql.Int, id || 0)
      .input('Name', sql.NVarChar(100), name)
      .input('NotificationEmails', sql.NVarChar(sql.MAX), notificationEmails || null)
      .input('IsActive', sql.Bit, isActive !== undefined ? isActive : 1)
      .execute('usp_UpsertLocation');
    res.json({ success: true, message: 'Lưu địa điểm thành công' });
  } catch (err) {
    next(err);
  }
});

// GET /api/system-config/task-configs
router.get('/task-configs', async (req, res, next) => {
  try {
    const { destination } = req.query;
    const pool = await getCsrPool();
    const result = await pool.request()
      .input('Destination', sql.NVarChar(100), destination || null)
      .execute('usp_TaskConfig_List');
    res.json({ success: true, data: result.recordset });
  } catch (err) { next(err); }
});

// POST /api/system-config/task-configs
router.post('/task-configs', authenticateToken, checkConfigPermission, async (req, res, next) => {
  try {
    const { id, destination, taskName, description, assigneeName, assigneeEmail,
      supervisorName, supervisorEmail, isCompulsory, leadtimeDays, isActive } = req.body;
    const pool = await getCsrPool();
    await pool.request()
      .input('Id', sql.Int, id || 0)
      .input('Destination', sql.NVarChar(100), destination)
      .input('TaskName', sql.NVarChar(200), taskName)
      .input('Description', sql.NVarChar(sql.MAX), description || null)
      .input('AssigneeId', sql.NVarChar(50), null)
      .input('AssigneeName', sql.NVarChar(200), assigneeName || null)
      .input('AssigneeEmail', sql.NVarChar(200), assigneeEmail || null)
      .input('SupervisorId', sql.NVarChar(50), null)
      .input('SupervisorName', sql.NVarChar(200), supervisorName || null)
      .input('SupervisorEmail', sql.NVarChar(200), supervisorEmail || null)
      .input('IsCompulsory', sql.Bit, isCompulsory || 0)
      .input('LeadtimeDays', sql.Int, leadtimeDays || 0)
      .input('IsActive', sql.Bit, isActive !== undefined ? isActive : 1)
      .execute('usp_UpsertTaskConfig');
    res.json({ success: true, message: 'Lưu công việc thành công' });
  } catch (err) { next(err); }
});

// POST /api/system-config/task-configs/copy
router.post('/task-configs/copy', authenticateToken, checkConfigPermission, async (req, res, next) => {
  try {
    const { fromDest, toDest } = req.body;
    if (!fromDest || !toDest) return res.status(400).json({ success: false, error: 'Thiếu tham số' });
    const pool = await getCsrPool();
    await pool.request()
      .input('FromDestination', sql.NVarChar(100), fromDest)
      .input('ToDestination', sql.NVarChar(100), toDest)
      .execute('usp_CopyTaskConfig');
    res.json({ success: true, message: 'Sao chép công việc thành công' });
  } catch (err) { next(err); }
});

// POST /api/system-config/locations/batch — batch upsert locations from Excel
router.post('/locations/batch', authenticateToken, checkConfigPermission, async (req, res, next) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0)
      return res.status(400).json({ success: false, error: 'Không có dữ liệu' });

    const pool = await getCsrPool();
    let inserted = 0;
    const errors = [];

    for (const row of rows) {
      const name = String(row.name || '').trim();
      if (!name) continue;

      try {
        // Tìm xem địa điểm đã tồn tại theo tên chưa
        const checkRes = await pool.request()
          .input('Name_Check', sql.NVarChar(100), name)
          .query('SELECT Id FROM [dbo].[CSR_Locations] WHERE [Name] = @Name_Check');
        const existing = checkRes.recordset[0];
        const targetId = existing ? existing.Id : 0;

        // Chuẩn hoá cột isActive
        const activeRaw = String(row.isActive || '').trim();
        let isActiveVal = 1;
        if (activeRaw === 'Ngưng hoạt động' || activeRaw === '0' || activeRaw === 'false') {
          isActiveVal = 0;
        }

        await pool.request()
          .input('Id', sql.Int, targetId)
          .input('Name', sql.NVarChar(100), name)
          .input('NotificationEmails', sql.NVarChar(sql.MAX), row.notificationEmails || null)
          .input('IsActive', sql.Bit, isActiveVal)
          .execute('usp_UpsertLocation');
        inserted++;
      } catch (e) {
        errors.push(`Địa điểm "${name}": ${e.message}`);
      }
    }

    res.json({ success: true, message: `Đã xử lý ${inserted}/${rows.length} địa điểm`, errors });
  } catch (err) { next(err); }
});

// POST /api/system-config/task-configs/batch — batch upsert task configs from Excel
router.post('/task-configs/batch', authenticateToken, checkConfigPermission, async (req, res, next) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0)
      return res.status(400).json({ success: false, error: 'Không có dữ liệu' });

    const pool = await getCsrPool();
    let inserted = 0;
    const errors = [];

    for (const row of rows) {
      const dest = String(row.destination || '').trim();
      const taskName = String(row.taskName || '').trim();
      if (!dest || !taskName) continue;

      try {
        // Tìm xem cấu hình công việc đã tồn tại tại địa điểm đó chưa
        const checkRes = await pool.request()
          .input('Dest_Check', sql.NVarChar(100), dest)
          .input('Task_Check', sql.NVarChar(200), taskName)
          .query('SELECT Id FROM [dbo].[CSR_TaskConfig] WHERE [Destination] = @Dest_Check AND [TaskName] = @Task_Check');
        const existing = checkRes.recordset[0];
        const targetId = existing ? existing.Id : 0;

        // Chuẩn hoá cột isActive
        const activeRaw = String(row.isActive || '').trim();
        let isActiveVal = 1;
        if (activeRaw === 'Ngưng hoạt động' || activeRaw === '0' || activeRaw === 'false') {
          isActiveVal = 0;
        }

        // Chuẩn hoá cột isCompulsory
        const compRaw = String(row.isCompulsory || '').trim();
        let isCompulsoryVal = 0;
        if (compRaw === '1' || compRaw === 'true' || compRaw === 'Bắt buộc') {
          isCompulsoryVal = 1;
        }

        await pool.request()
          .input('Id', sql.Int, targetId)
          .input('Destination', sql.NVarChar(100), dest)
          .input('TaskName', sql.NVarChar(200), taskName)
          .input('Description', sql.NVarChar(sql.MAX), row.description || null)
          .input('AssigneeId', sql.NVarChar(50), null)
          .input('AssigneeName', sql.NVarChar(200), row.assigneeName || null)
          .input('AssigneeEmail', sql.NVarChar(200), row.assigneeEmail || null)
          .input('SupervisorId', sql.NVarChar(50), null)
          .input('SupervisorName', sql.NVarChar(200), row.supervisorName || null)
          .input('SupervisorEmail', sql.NVarChar(200), row.supervisorEmail || null)
          .input('IsCompulsory', sql.Bit, isCompulsoryVal)
          .input('LeadtimeDays', sql.Int, parseInt(row.leadtimeDays) || 1)
          .input('IsActive', sql.Bit, isActiveVal)
          .execute('usp_UpsertTaskConfig');
        inserted++;
      } catch (e) {
        errors.push(`Công việc "${taskName}" tại ${dest}: ${e.message}`);
      }
    }

    res.json({ success: true, message: `Đã xử lý ${inserted}/${rows.length} công việc`, errors });
  } catch (err) { next(err); }
});

// POST /api/system-config/lists/batch — batch upsert config lists (phòng họp, nhà hàng, khách hàng) from Excel
router.post('/lists/batch', authenticateToken, checkConfigPermission, async (req, res, next) => {
  try {
    const { rows, category } = req.body;
    if (!Array.isArray(rows) || rows.length === 0)
      return res.status(400).json({ success: false, error: 'Không có dữ liệu' });

    const pool = await getCsrPool();
    let inserted = 0;
    const errors = [];

    for (const row of rows) {
      const name = String(row.name || '').trim();
      const cat = category || row.category || '';
      if (!name || !cat) continue;

      try {
        // Tìm xem đã tồn tại mục cùng tên trong category đó chưa
        const checkRes = await pool.request()
          .input('Cat_Check', sql.NVarChar(50), cat)
          .input('Name_Check', sql.NVarChar(200), name)
          .query('SELECT Id FROM [dbo].[CSR_ConfigLists] WHERE [Category] = @Cat_Check AND [Name] = @Name_Check');
        const existing = checkRes.recordset[0];
        const targetId = existing ? existing.Id : 0;

        // Chuẩn hoá cột isActive
        const activeRaw = String(row.isActive || '').trim();
        let isActiveVal = 1;
        if (activeRaw === 'Ngưng hoạt động' || activeRaw === '0' || activeRaw === 'false') {
          isActiveVal = 0;
        }

        let jsonData = null;

        // Build jsonData for restaurant (price4Pax được lưu trực tiếp dưới dạng chuỗi, không ép kiểu số)
        if (cat === 'DinnerRestaurant') {
          jsonData = JSON.stringify({
            level: row.level || 'CEO/Director/COO',
            price4Pax: row.price4Pax ? String(row.price4Pax).trim() : '',
            space: row.space || '',
            cuisine: row.cuisine || ''
          });
        }

        await pool.request()
          .input('Id', sql.Int, targetId)
          .input('Category', sql.NVarChar(50), cat)
          .input('Name', sql.NVarChar(200), name)
          .input('Email', sql.NVarChar(200), row.email || null)
          .input('JsonData', sql.NVarChar(sql.MAX), jsonData)
          .input('IsActive', sql.Bit, isActiveVal)
          .input('StatusId', sql.Int, null)
          .execute('usp_UpsertConfigList');
        inserted++;
      } catch (e) {
        errors.push(`"${name}": ${e.message}`);
      }
    }

    res.json({ success: true, message: `Đã xử lý ${inserted}/${rows.length} mục`, errors });
  } catch (err) { next(err); }
});

module.exports = router;

