const express = require('express');
const router = express.Router();
const {
  createOrder,
  getMyOrders,
  getOrderById,
  updateOrderStatus,
  updateOrderDesign
} = require('../controllers/orderController');
const { protect, admin } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// 1. Rute Statis (WAJIB DI ATAS)
router.get('/myorders', protect, getMyOrders);

// 2. Base Routes
router.route('/')
  .post(protect, upload.single('design'), createOrder)
  .get(protect, admin, async (req, res) => {
    try {
      const Order = require('../models/Order');
      const orders = await Order.find({}).populate('customer', 'name email').populate('product', 'name');
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

// 3. Rute Dinamis (Parameter :id harus di paling bawah)
router.get('/:id', protect, getOrderById);

// 4. Admin/Designer Only
router.put('/:id/status', protect, admin, updateOrderStatus);
router.put('/:id/design', protect, admin, upload.single('mockup'), updateOrderDesign);

module.exports = router;