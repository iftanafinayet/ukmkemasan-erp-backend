const productionService = require('../services/productionService');
const Order = require('../models/Order');
const OrderLog = require('../models/OrderLog');
const { mapKomshipStatus } = require('../utils/shippingStatus');

const receiveErpOrder = async (req, res) => {
  try {
    const { orderId, orderNumber, event } = req.body;

    if (!orderId || !orderNumber || !event) {
      return res.status(400).json({ message: 'Missing required fields: orderId, orderNumber, event' });
    }

    const result = await productionService.handleErpWebhook(req.body);

    res.status(200).json({ message: 'Webhook received', task: result });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Komship mengirim PUT dengan body { order_no, cnote, status }.
// Verifikasi via secret token di URL karena Komship tidak menyediakan signature.
const receiveKomshipStatus = async (req, res) => {
  try {
    if (req.params.secret !== process.env.KOMSHIP_WEBHOOK_SECRET) {
      return res.status(401).json({ message: 'Invalid secret' });
    }

    const { order_no: orderNo, cnote, status } = req.body || {};
    if (!orderNo || !status) {
      return res.status(400).json({ message: 'Missing order_no/status' });
    }

    const order = await Order.findOne({ 'shippingProvider.orderNo': orderNo });
    if (!order) {
      return res.status(200).json({ message: 'Order not found, ignored' });
    }

    const internalStatus = mapKomshipStatus(status);
    const history = order.shippingProvider.statusHistory || [];
    const duplicate = history.some((h) => h.status === internalStatus && h.description === status);

    if (!duplicate) {
      order.shippingProvider.status = internalStatus;
      if (cnote && !order.shippingProvider.awb) order.shippingProvider.awb = cnote;
      history.push({ status: internalStatus, description: status, timestamp: new Date() });
      order.shippingProvider.statusHistory = history;
      if (internalStatus === 'Delivered' && order.status !== 'Completed') order.status = 'Completed';
      await order.save();

      await OrderLog.create({
        order: order._id,
        action: 'Shipping Status Webhook',
        newValue: internalStatus,
        note: status,
      });

      const io = req.app.get('io');
      if (io) {
        io.to(`user:${order.customer}`).emit('shipping:updated', {
          orderId: order._id,
          status: internalStatus,
          awb: order.shippingProvider.awb,
        });
      }
    }

    res.status(200).json({ message: 'OK' });
  } catch (error) {
    // Selalu balas 200 agar Komship tidak menonaktifkan webhook; error tetap dicatat.
    res.status(200).json({ message: 'Error handled', error: error.message });
  }
};

module.exports = { receiveErpOrder, receiveKomshipStatus };
