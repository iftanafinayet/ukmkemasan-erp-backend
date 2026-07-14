require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('../models/Order');
const OrderLog = require('../models/OrderLog');
const Product = require('../models/Product');
const Warehouse = require('../models/Warehouse');
const StockCard = require('../models/StockCard');
const notificationService = require('../services/notificationService');

async function autoCancelUnpaidOrders() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI not configured');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to DB');

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 1);

  const unpaidOrders = await Order.find({
    isPaid: false,
    status: { $nin: ['Completed', 'Cancelled', 'Shipping', 'Quality Control', 'Production'] },
    createdAt: { $lt: cutoff }
  });

  console.log(`Found ${unpaidOrders.length} unpaid orders older than 7 days`);

  let cancelled = 0;
  for (const order of unpaidOrders) {
    try {
      const oldStatus = order.status;
      order.status = 'Cancelled';
      await order.save();

      await OrderLog.create({
        order: order._id,
        action: 'Auto-Cancelled',
        oldValue: oldStatus,
        newValue: 'Cancelled',
        note: 'Unpaid for more than 7 days'
      });

      const msg = `🗑️ *Order Auto-Cancelled*\nOrder: ${order.orderNumber}\nReason: Unpaid > 7 days\nOld Status: ${oldStatus}`;
      await notificationService.sendTelegramRaw(msg);
      cancelled++;
    } catch (err) {
      console.error(`Failed to cancel order ${order.orderNumber}:`, err.message);
    }
  }

  console.log(`Successfully cancelled ${cancelled} orders`);
  await mongoose.disconnect();
}

autoCancelUnpaidOrders();
