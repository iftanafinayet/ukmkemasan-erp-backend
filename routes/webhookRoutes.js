const express = require('express');
const router = express.Router();
const { receiveErpOrder, receiveKomshipStatus } = require('../controllers/webhookController');

router.post('/erp-order', receiveErpOrder);
router.put('/komship-status/:secret', receiveKomshipStatus);

module.exports = router;
