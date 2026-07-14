const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  text: {
    type: String,
    required: [true, 'Message text is required'],
    trim: true,
  },
  readAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
