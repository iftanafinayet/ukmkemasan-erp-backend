const multer = require('multer');

// Gunakan memory storage — file disimpan di buffer, bukan disk
// Buffer ini yang akan di-upload langsung ke Cloudinary
const storage = multer.memoryStorage();

// Filter jenis file — hanya gambar
function checkFileType(file, cb) {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
    if (allowedMimes.includes(file.mimetype)) {
        return cb(null, true);
    } else {
        cb(new Error('Hanya file gambar (JPEG, PNG, WebP, AVIF, GIF) yang diizinkan!'));
    }
}

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // Max 10MB per file
    fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
    },
});

module.exports = upload;