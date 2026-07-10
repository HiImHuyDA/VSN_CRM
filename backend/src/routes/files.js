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

// Validate file
const fileFilter = (req, file, cb) => {
    const ext = getExtension(file.originalname);
    const blockedExtensions = ['.exe', '.bat', '.sh', '.vbs', '.cmd', '.msi'];
    if (blockedExtensions.includes(ext)) {
        return cb(new Error('Extension không được phép tải lên!'));
    }
    cb(null, true);
};

// Configure Multer storage to UPLOAD_DIR with YYYY/MM structure
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
        const now = new Date();
        const year = now.getFullYear().toString();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        
        const targetDir = path.join(uploadDir, year, month);
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
 * POST /api/files/upload
 */
router.post('/upload', upload.single('file'), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Không có file được tải lên' });
        }

        const originalName = req.file.originalname;
        const storedName = req.file.filename;
        const filePath = req.file.path;
        const fileExtension = getExtension(originalName);
        const mimeType = req.file.mimetype;
        const fileSize = req.file.size;
        const uploadedBy = req.user ? req.user.mnv : null;

        const pool = await getCsrPool();
        const result = await pool.request()
            .input('OriginalName', sql.NVarChar(255), originalName)
            .input('StoredName', sql.NVarChar(255), storedName)
            .input('FilePath', sql.NVarChar(sql.MAX), filePath)
            .input('FileExtension', sql.NVarChar(50), fileExtension)
            .input('MimeType', sql.NVarChar(100), mimeType)
            .input('FileSize', sql.BigInt, fileSize)
            .input('UploadedBy', sql.NVarChar(50), uploadedBy)
            .execute('usp_InsertUploadedFile');

        const fileId = result.recordset[0].id;
        const fileUrl = `/api/files/${fileId}`;

        res.json({
            success: true,
            data: {
                id: fileId,
                original_name: originalName,
                file_url: fileUrl
            }
        });
    } catch (err) {
        console.error('File Upload Error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/files/:id
 * View file (inline)
 */
router.get('/:id', async (req, res, next) => {
    try {
        const pool = await getCsrPool();
        const result = await pool.request()
            .input('Id', sql.Int, req.params.id)
            .execute('usp_GetUploadedFileById');

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy file' });
        }

        const fileRecord = result.recordset[0];
        if (!fs.existsSync(fileRecord.file_path)) {
            return res.status(404).json({ success: false, message: 'File vật lý không còn tồn tại' });
        }

        res.setHeader('Content-Type', fileRecord.mime_type || 'application/octet-stream');
        res.sendFile(path.resolve(fileRecord.file_path));
    } catch (err) {
        console.error('View File Error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/files/:id/download
 * Download file (attachment)
 */
router.get('/:id/download', async (req, res, next) => {
    try {
        const pool = await getCsrPool();
        const result = await pool.request()
            .input('Id', sql.Int, req.params.id)
            .execute('usp_GetUploadedFileById');

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy file' });
        }

        const fileRecord = result.recordset[0];
        if (!fs.existsSync(fileRecord.file_path)) {
            return res.status(404).json({ success: false, message: 'File vật lý không còn tồn tại' });
        }

        res.download(path.resolve(fileRecord.file_path), fileRecord.original_name);
    } catch (err) {
        console.error('Download File Error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * DELETE /api/files/:id
 * Xóa file (cả vật lý và database)
 */
router.delete('/:id', async (req, res, next) => {
    try {
        const pool = await getCsrPool();
        const result = await pool.request()
            .input('Id', sql.Int, req.params.id)
            .execute('usp_GetUploadedFileById');

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy file' });
        }

        const fileRecord = result.recordset[0];

        // Delete physical file
        if (fs.existsSync(fileRecord.file_path)) {
            fs.unlinkSync(fileRecord.file_path);
        }

        // Delete DB record
        await pool.request()
            .input('Id', sql.Int, req.params.id)
            .execute('usp_DeleteUploadedFile');

        res.json({ success: true, message: 'Đã xóa file thành công' });
    } catch (err) {
        console.error('Delete File Error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Middleware xử lý lỗi multer (vd: file size)
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ success: false, message: err.message });
    } else if (err) {
        return res.status(400).json({ success: false, message: err.message });
    }
    next();
});

module.exports = router;
