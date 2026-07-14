const express = require('express');
const router = express.Router();
const { getCustomers, exportCustomers } = require('../controllers/customerController');
const { protect, admin } = require('../middleware/authMiddleware');

// Gunakan protect agar hanya yang login yang bisa akses
// (Opsional) Gunakan admin jika hanya admin yang boleh lihat daftar pelanggan
router.get('/', protect, getCustomers);
router.get('/export', protect, admin, exportCustomers);

module.exports = router;