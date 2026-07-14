const mongoose = require('mongoose');

const ProductionTaskSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    unique: true
  },
  taskNumber: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['Pending', 'InProgress', 'Review', 'Completed', 'Cancelled'],
    default: 'Pending'
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium'
  },
  assignedTeam: {
    type: String,
    default: ''
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  notes: {
    type: String,
    default: ''
  },
  startedAt: Date,
  completedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('ProductionTask', ProductionTaskSchema);
