/**
 * dashboardUploadService.js — Handles file uploads from the dashboard.
 */
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Ensure upload directory exists
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const hash = crypto.randomBytes(16).toString('hex');
        cb(null, `${hash}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed.'));
        }
        cb(null, true);
    }
});

class DashboardUploadService {
    getMiddleware(fieldName = 'file') {
        return upload.single(fieldName);
    }

    /**
     * Get the public URL for an uploaded file
     */
    getFileUrl(filename) {
        return `/api/v1/dashboard/uploads/${filename}`;
    }
}

module.exports = new DashboardUploadService();
