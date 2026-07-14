const mongoose = require('mongoose');

const OrderLogSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  action: {
    type: String,
    required: true
  },
  oldValue: String,
  newValue: String,
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  note: String
}, { timestamps: true });

OrderLogSchema.index({ order: 1, createdAt: -1 });

module.exports = mongoose.model('OrderLog', OrderLogSchema);
