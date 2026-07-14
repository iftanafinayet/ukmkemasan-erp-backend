const ProductionTask = require('../models/ProductionTask');
const Order = require('../models/Order');
const OrderLog = require('../models/OrderLog');
const notificationService = require('../services/notificationService');

const ORDER_STATUS_FLOW = ['Quotation', 'Payment', 'Production', 'Quality Control', 'Shipping', 'Completed'];

exports.getAllTasks = async (req, res) => {
  try {
    const { status, team, priority } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (team) filter.assignedTeam = team;
    if (priority) filter.priority = priority;

    const tasks = await ProductionTask.find(filter)
      .populate({
        path: 'order',
        populate: [
          { path: 'customer', select: 'name email phone address' },
          { path: 'product', select: 'name category material' }
        ]
      })
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getTaskById = async (req, res) => {
  try {
    const task = await ProductionTask.findById(req.params.id)
      .populate({
        path: 'order',
        populate: [
          { path: 'customer', select: 'name email phone address' },
          { path: 'product', select: 'name category material' }
        ]
      });

    if (!task) {
      return res.status(404).json({ message: 'Task tidak ditemukan' });
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const task = await ProductionTask.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task tidak ditemukan' });
    }

    const oldStatus = task.status;
    const { status, assignedTeam, assignedTo, priority, notes } = req.body;

    if (status) task.status = status;
    if (assignedTeam) task.assignedTeam = assignedTeam;
    if (assignedTo) task.assignedTo = assignedTo;
    if (priority) task.priority = priority;
    if (notes !== undefined) task.notes = notes;

    if (status === 'InProgress' && oldStatus !== 'InProgress') {
      task.startedAt = new Date();
    }

    if (status === 'Completed' && oldStatus !== 'Completed') {
      task.completedAt = new Date();
      await advanceOrderStatus(task.order);
    }

    const updatedTask = await task.save();

    res.json(updatedTask);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

async function advanceOrderStatus(orderId) {
  try {
    const order = await Order.findById(orderId)
      .populate('customer', 'name email phone address')
      .populate('product', 'name category material')
      .populate('items.product', 'name category material');
    if (!order) return;

    const currentIndex = ORDER_STATUS_FLOW.indexOf(order.status);
    const qcIndex = ORDER_STATUS_FLOW.indexOf('Quality Control');

    if (currentIndex >= 0 && currentIndex < qcIndex) {
      order.status = 'Quality Control';
      await order.save();

      const task = await ProductionTask.findOne({ order: order._id });
      if (task) {
        await notificationService.sendTelegramAlert(task, order);
      }
    }
  } catch (err) {
    console.error('Auto-advance order failed:', err.message);
  }
}

exports.getTaskStats = async (req, res) => {
  try {
    const total = await ProductionTask.countDocuments();
    const pending = await ProductionTask.countDocuments({ status: 'Pending' });
    const inProgress = await ProductionTask.countDocuments({ status: 'InProgress' });
    const review = await ProductionTask.countDocuments({ status: 'Review' });
    const completed = await ProductionTask.countDocuments({ status: 'Completed' });
    const cancelled = await ProductionTask.countDocuments({ status: 'Cancelled' });

    res.json({ total, pending, inProgress, review, completed, cancelled });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.sendDailySummary = async (req, res) => {
  try {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const completedYesterday = await ProductionTask.countDocuments({
      status: 'Completed',
      completedAt: { $gte: yesterday, $lt: todayStart }
    });

    const pending = await ProductionTask.countDocuments({ status: { $in: ['Pending', 'InProgress', 'Review'] } });

    const total = await ProductionTask.countDocuments();

    const overdue = await ProductionTask.countDocuments({
      status: { $in: ['Pending', 'InProgress'] },
      createdAt: { $lt: yesterday }
    });

    const message = [
      `📋 *Daily Production Summary*`,
      ``,
      `Total Tasks: ${total}`,
      `Active: ${pending}`,
      `Completed Yesterday: ${completedYesterday}`,
      `Overdue: ${overdue}`,
    ].join('\n');

    await notificationService.sendTelegramRaw(message);

    res.json({ message: 'Summary sent', data: { total, pending, completedYesterday, overdue } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.autoCancelUnpaidOrders = async (req, res) => {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);

    const unpaidOrders = await Order.find({
      isPaid: false,
      status: { $nin: ['Completed', 'Cancelled', 'Shipping', 'Quality Control', 'Production'] },
      createdAt: { $lt: cutoff }
    });

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
        console.error(`Failed to cancel ${order.orderNumber}:`, err.message);
      }
    }

    res.json({
      message: `Cancelled ${cancelled} unpaid orders`,
      total: unpaidOrders.length,
      cancelled
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


