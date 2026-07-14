const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    default: null,
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null,
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true,
  },
  status: {
    type: String,
    enum: ['Open', 'Replied', 'Closed'],
    default: 'Open',
  },
  lastMessageAt: {
    type: Date,
  },
  lastMessagePreview: {
    type: String,
  },
}, { timestamps: true });

module.exports = mongoose.model('Conversation', conversationSchema);
