const express = require('express');
const router = express.Router();
const { getAdminStats, getCategoryAnalytics } = require('../controllers/dashboardController');
const { protect, admin } = require('../middleware/authMiddleware');

router.get('/stats', protect, admin, getAdminStats);
router.get('/categories', protect, admin, getCategoryAnalytics);

module.exports = router;