const express = require('express');
const router = express.Router();
const {
  getSettings,
  updateSettings,
  searchDestination,
} = require('../controllers/settingsController');
const { protect, admin } = require('../middleware/authMiddleware');

router.get('/', protect, admin, getSettings);
router.put('/', protect, admin, updateSettings);
router.get('/shipping/destinations', protect, admin, searchDestination);

module.exports = router;
