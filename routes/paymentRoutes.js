const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
    getOrderPaymentSummary,
    createMidtransSnapToken,
    handleMidtransWebhook,
} = require('../controllers/paymentController');

const router = express.Router();

router.post('/midtrans/webhook', handleMidtransWebhook);

router.get('/orders/:orderId', protect, getOrderPaymentSummary);
router.post('/orders/:orderId/midtrans/token', protect, createMidtransSnapToken);

module.exports = router;

