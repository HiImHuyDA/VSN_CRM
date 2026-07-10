// src/routes/taskManagement.js
// API Quản lý công việc (Kanban, Ghi chú, File đính kèm)
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getCsrPool, sql } = require('../config/database');

// Helper to get extension
const getExtension = (filename) => {
  return path.extname(filename).toLowerCase();
};

// Validate file extension
const fileFilter = (req, file, cb) => {
  const ext = getExtension(file.originalname);
  const blockedExtensions = ['.exe', '.bat', '.sh', '.vbs', '.cmd', '.msi'];
  if (blockedExtensions.includes(ext)) {
    return cb(new Error('Định dạng file không được phép tải lên!'));
  }
  cb(null, true);
};

// Cấu hình lưu trữ Multer cho task attachments
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
    const targetDir = path.join(uploadDir, 'tasks');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    cb(null, targetDir);
  },
  filename: function (req, file, cb) {
    const uuid = crypto.randomUUID();
    const originalName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const storedName = `${uuid}-${originalName}`;
    cb(null, storedName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: fileFilter
});

/**
 * GET /api/task-management
 * Lấy danh sách task cho Kanban/Table
 */
router.get('/', async (req, res, next) => {
  try {
    const {
      role = '',
      mnv = '',
      department = null,
      assignee = null,
      projectId = null,
      customerName = null,
      onboardDate = null,
      destination = null
    } = req.query;
    const pool = await getCsrPool();

    const result = await pool.request()
      .input('ActorRole', sql.NVarChar(50), role)
      .input('ActorMNV', sql.NVarChar(50), mnv)
      .input('Department', sql.NVarChar(sql.MAX), department || null)
      .input('Assignee', sql.NVarChar(sql.MAX), assignee || null)
      .input('ProjectId', sql.NVarChar(sql.MAX), projectId || null)
      .input('CustomerName', sql.NVarChar(sql.MAX), customerName || null)
      .input('OnboardDate', sql.NVarChar(sql.MAX), onboardDate || null)
      .input('Destination', sql.NVarChar(sql.MAX), destination || null)
      .execute('usp_GetTaskManagement');

    res.json({
      success: true,
      data: result.recordset || []
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/task-management/status
 * Cập nhật trạng thái của task (drag-drop)
 */
router.put('/status', async (req, res, next) => {
  try {
    const { taskId, newStatus, actorMNV = null } = req.body;

    if (!taskId || !newStatus) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp đầy đủ taskId và newStatus.'
      });
    }

    const pool = await getCsrPool();
    const result = await pool.request()
      .input('TaskId', sql.NVarChar(150), taskId)
      .input('NewStatus', sql.NVarChar(50), newStatus)
      .input('ActorMNV', sql.NVarChar(50), actorMNV)
      .execute('usp_UpdateTaskStatus');

    res.json({
      success: true,
      data: result.recordset?.[0] || {}
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/task-management/:taskId/notes
 * Lấy danh sách ghi chú của task
 */
router.get('/:taskId/notes', async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const pool = await getCsrPool();

    const result = await pool.request()
      .input('TaskId', sql.NVarChar(150), taskId)
      .execute('usp_GetTaskNotes');

    res.json({
      success: true,
      data: result.recordset || []
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/task-management/:taskId/notes
 * Thêm ghi chú cho task
 */
router.post('/:taskId/notes', async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { content, authorMNV, authorName } = req.body;

    if (!content || !authorName) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng điền nội dung ghi chú và tên tác giả.'
      });
    }

    const pool = await getCsrPool();
    const result = await pool.request()
      .input('TaskId', sql.NVarChar(150), taskId)
      .input('Content', sql.NVarChar(sql.MAX), content)
      .input('AuthorMNV', sql.NVarChar(50), authorMNV || null)
      .input('AuthorName', sql.NVarChar(200), authorName)
      .execute('usp_AddTaskNote');

    res.json({
      success: true,
      data: result.recordset?.[0] || {}
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/task-management/notes/:noteId
 * Xoá ghi chú
 */
router.delete('/notes/:noteId', async (req, res, next) => {
  try {
    const { noteId } = req.params;
    const { authorMNV = null } = req.query; // để verify nếu không phải admin
    const pool = await getCsrPool();

    const result = await pool.request()
      .input('NoteId', sql.Int, parseInt(noteId))
      .input('AuthorMNV', sql.NVarChar(50), authorMNV)
      .execute('usp_DeleteTaskNote');

    res.json({
      success: true,
      message: 'Đã xoá ghi chú thành công'
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/task-management/:taskId/attachments
 * Lấy danh sách file đính kèm của task
 */
router.get('/:taskId/attachments', async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const pool = await getCsrPool();

    const result = await pool.request()
      .input('TaskId', sql.NVarChar(150), taskId)
      .execute('usp_TaskAttachment_ListByTaskId');

    res.json({
      success: true,
      data: result.recordset || []
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/task-management/:taskId/attachments
 * Tải file lên đính kèm cho task
 */
router.post('/:taskId/attachments', upload.single('file'), async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { uploadedBy = 'Anonymous' } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Không có file được chọn' });
    }

    const fileName = req.file.originalname;
    const filePath = req.file.path;
    const fileSize = req.file.size;

    const pool = await getCsrPool();
    const result = await pool.request()
      .input('TaskId', sql.NVarChar(150), taskId)
      .input('FileName', sql.NVarChar(500), fileName)
      .input('FilePath', sql.NVarChar(1000), filePath)
      .input('FileSize', sql.BigInt, fileSize)
      .input('UploadedBy', sql.NVarChar(200), uploadedBy)
      .execute('usp_AddTaskAttachment');

    res.json({
      success: true,
      data: result.recordset?.[0] || {}
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/task-management/attachments/:id/download
 * Tải file đính kèm của task
 */
router.get('/attachments/:id/download', async (req, res, next) => {
  try {
    const { id } = req.params;
    const pool = await getCsrPool();

    // Để download, chúng ta lấy thông tin path từ table attachments qua SP
    const result = await pool.request()
      .input('AttachmentId', sql.Int, parseInt(id))
      .execute('usp_TaskAttachment_GetById');

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy file đính kèm' });
    }

    const record = result.recordset[0];
    if (!fs.existsSync(record.FilePath)) {
      return res.status(404).json({ success: false, message: 'File vật lý không tồn tại trên server' });
    }

    res.download(path.resolve(record.FilePath), record.FileName);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/task-management/attachments/:id
 * Xoá file đính kèm của task
 */
router.delete('/attachments/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const pool = await getCsrPool();

    const result = await pool.request()
      .input('AttachmentId', sql.Int, parseInt(id))
      .execute('usp_DeleteTaskAttachment');

    if (result.recordset.length > 0) {
      const record = result.recordset[0];
      // Xoá file vật lý
      if (record.FilePath && fs.existsSync(record.FilePath)) {
        fs.unlinkSync(record.FilePath);
      }
    }

    res.json({
      success: true,
      message: 'Đã xoá file đính kèm thành công'
    });
  } catch (err) {
    next(err);
  }
});

// Middleware xử lý lỗi Multer
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, message: err.message });
  } else if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
});

module.exports = router;
