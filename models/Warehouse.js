const mongoose = require('mongoose');

const warehouseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: String,
  type: { type: String, enum: ['Main', 'Retail'], default: 'Main' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Warehouse', warehouseSchema);
