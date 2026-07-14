const express = require('express');
const { protect, admin } = require('../middleware/authMiddleware');
const {
  create,
  list,
  getById,
  sendMsg,
  markRead,
  updateStatus,
} = require('../controllers/conversationController');

const router = express.Router();

router.route('/')
  .post(protect, create)
  .get(protect, list);

router.route('/:id')
  .get(protect, getById);

router.route('/:id/messages')
  .post(protect, sendMsg);

router.route('/:id/read')
  .put(protect, markRead);

router.route('/:id/status')
  .put(protect, admin, updateStatus);

module.exports = router;
