require('dotenv').config();
const mongoose = require('mongoose');
const ProductionTask = require('../models/ProductionTask');
const Order = require('../models/Order');
const notificationService = require('../services/notificationService');

async function sendDailySummary() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI not configured');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to DB');

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

  try {
    await notificationService.sendTelegramRaw(message);
    console.log('Summary sent');
  } catch (err) {
    console.error('Failed to send summary:', err.message);
  }

  await mongoose.disconnect();
}

sendDailySummary();
