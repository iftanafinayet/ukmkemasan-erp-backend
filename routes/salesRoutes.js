const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const {
  getSalesOverview,
  getInvoices,
  createInvoice,
  getPayments,
  createPayment,
  getSalesReturns,
  createSalesReturn
} = require('../controllers/salesController');

router.use(protect, admin);

router.get('/overview', getSalesOverview);

router.route('/invoices')
  .get(getInvoices)
  .post(createInvoice);

router.route('/payments')
  .get(getPayments)
  .post(createPayment);

router.route('/returns')
  .get(getSalesReturns)
  .post(createSalesReturn);

module.exports = router;
