const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const {
  getWarehouses,
  createWarehouse,
  createAdjustment,
  getStockCards
} = require('../controllers/inventoryController');

// All inventory routes are protected
router.use(protect);

// Warehouse routes
router.route('/warehouses')
  .get(getWarehouses)
  .post(admin, createWarehouse);

// Adjustment route (Admin only usually)
router.post('/adjustments', admin, createAdjustment);

// Stock Card route
router.get('/stock-cards/:productId', getStockCards);

module.exports = router;
