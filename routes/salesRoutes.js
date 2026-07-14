const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const {
  getSalesOverview,
  getInvoices,
  createInvoice,
  exportInvoices,
  exportSalesOverview,
  getPayments,
  createPayment,
  getSalesReturns,
  createSalesReturn
} = require('../controllers/salesController');

router.use(protect, admin);

router.get('/overview', getSalesOverview);
router.get('/overview/export', exportSalesOverview);

router.route('/invoices')
  .get(getInvoices)
  .post(createInvoice);

router.get('/invoices/export', exportInvoices);

router.route('/payments')
  .get(getPayments)
  .post(createPayment);

router.route('/returns')
  .get(getSalesReturns)
  .post(createSalesReturn);

module.exports = router;
