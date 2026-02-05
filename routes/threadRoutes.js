const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { createThread, getThreads } = require('../controllers/threadController');
const { protect } = require('../middleware/authMiddleware');

// Multer Config
const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, 'uploads/');
    },
    filename(req, file, cb) {
        cb(
            null,
            `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`
        );
    },
});

// Check File Type
function checkFileType(file, cb) {
    const filetypes = /jpg|jpeg|png|pdf|doc|docx/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true);
    } else {
        cb('Images and Documents only!');
    }
}

const upload = multer({
    storage,
    fileFilter: function (req, file, cb) {
        // Relaxed filter for MVP, or stricter? 
        // Let's allow generic images/docs.
        // checkFileType(file, cb);
        cb(null, true); // Allow all for now
    },
});

router.route('/')
    .get(getThreads)
    .post(protect, upload.single('file'), createThread);

module.exports = router;
