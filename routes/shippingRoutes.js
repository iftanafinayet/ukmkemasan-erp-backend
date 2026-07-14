const express = require('express');
const router = express.Router();
const c = require('../controllers/shippingController');
const { protect, admin } = require('../middleware/authMiddleware');

// Cek ongkir & cari lokasi (customer + admin)
router.get('/destinations', protect, c.searchDestinations);
router.post('/calculate', protect, c.calculateShipping);

router.post('/orders/:id/create', protect, admin, c.createShippingOrder);
router.post('/orders/:id/pickup', protect, admin, c.schedulePickup);
router.post('/orders/:id/label', protect, admin, c.generateLabel);
router.get('/orders/:id/label', protect, c.getLabel);
router.get('/orders/:id/tracking', protect, c.getTracking);
router.post('/orders/:id/cancel', protect, admin, c.cancelShipping);

module.exports = router;
