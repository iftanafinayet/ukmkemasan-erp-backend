const express = require('express');
const router = express.Router();
const {
  createOrder,
  getMyOrders,
  getOrderById,
  updateOrderStatus,
  updateOrderDesign,
  cancelOrder,
  getOrderLogs,
  scanResi
} = require('../controllers/orderController');
const { protect, admin, designer, production } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware');

// 1. Rute Statis (WAJIB DI ATAS)
router.get('/myorders', protect, getMyOrders);

// 2. Base Routes
router.route('/')
  .post(protect, upload.single('design'), createOrder)
  .get(protect, admin, async (req, res) => {
    try {
      const Order = require('../models/Order');
      const filter = {};
      if (req.query.orderType) filter.orderType = req.query.orderType;
      const orders = await Order.find(filter)
        .populate('customer', 'name email')
        .populate('product', 'name')
        .populate('items.product', 'name');
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

// 3. Rute Dinamis (Parameter :id harus di paling bawah)
router.get('/:id', protect, getOrderById);

// 4. Customer Cancel
router.put('/:id/cancel', protect, cancelOrder);

// 5. Admin/Designer Only
router.put('/:id/status', protect, updateOrderStatus);
router.put('/:id/design', protect, designer, upload.single('mockup'), updateOrderDesign);

// 6. Scan Resi (Barcode)
router.post('/:id/scan-resi', protect, admin, scanResi);

// 7. Activity Logs
router.get('/:id/logs', protect, getOrderLogs);

module.exports = router;