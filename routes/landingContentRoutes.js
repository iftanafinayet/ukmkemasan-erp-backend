const express = require('express');
const router = express.Router();
const { getLandingContent, updateLandingContent } = require('../controllers/landingContentController');
const { protect, admin } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.route('/')
  .get(getLandingContent)
  .put(protect, admin, upload.any(), updateLandingContent);

module.exports = router;
