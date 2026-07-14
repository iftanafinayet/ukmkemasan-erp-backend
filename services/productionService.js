const ProductionTask = require('../models/ProductionTask');
const Order = require('../models/Order');
const notificationService = require('./notificationService');

async function handleErpWebhook(payload) {
  const { orderNumber } = payload;

  const order = await Order.findOne({ orderNumber })
    .populate('customer', 'name email phone')
    .populate('product', 'name category material')
    .populate('items.product', 'name category material');
  if (!order) {
    throw new Error(`Order ${orderNumber} not found in local database`);
  }

  const task = await autoCreateProductionTask(order);

  try {
    await notificationService.sendTelegramAlert(task, order);
  } catch (err) {
    console.error('Failed to send notification (non-fatal):', err.message);
  }

  return task;
}

async function autoCreateProductionTask(order) {
  const count = await ProductionTask.countDocuments();
  const taskNumber = `PROD-${new Date().getFullYear()}-${(count + 1).toString().padStart(4, '0')}`;

  const existingTask = await ProductionTask.findOne({ order: order._id });
  if (existingTask) {
    return existingTask;
  }

  const task = await ProductionTask.create({
    order: order._id,
    taskNumber,
    priority: 'Medium'
  });

  return task;
}

module.exports = { handleErpWebhook, autoCreateProductionTask };
