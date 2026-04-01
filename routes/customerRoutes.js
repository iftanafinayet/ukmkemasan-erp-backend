const express = require('express');
const router = express.Router();
const { getCustomers } = require('../controllers/customerController');
const { protect, admin } = require('../middleware/authMiddleware');

// Gunakan protect agar hanya yang login yang bisa akses
// (Opsional) Gunakan admin jika hanya admin yang boleh lihat daftar pelanggan
router.get('/', protect, getCustomers);

module.exports = router;