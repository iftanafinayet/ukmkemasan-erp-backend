const express = require('express');
const router = express.Router();
const {
  getAllTasks,
  getTaskById,
  updateTask,
  getTaskStats,
  sendDailySummary,
  autoCancelUnpaidOrders
} = require('../controllers/productionTaskController');
const { protect, admin, production } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/stats', production, getTaskStats);
router.post('/daily-summary', admin, sendDailySummary);
router.post('/auto-cancel', admin, autoCancelUnpaidOrders);
router.get('/', production, getAllTasks);
router.get('/:id', production, getTaskById);
router.put('/:id', production, updateTask);

module.exports = router;
