const mongoose = require('mongoose');

const inventoryAdjustmentSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: mongoose.Schema.Types.ObjectId },
  variantSnapshot: {
    sku: { type: String, trim: true },
    color: { type: String, trim: true },
    size: { type: String, trim: true }
  },
  warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  type: { type: String, enum: ['In', 'Out'], required: true },
  quantity: { type: Number, required: true },
  reason: { type: String, required: true },
  adjustedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('InventoryAdjustment', inventoryAdjustmentSchema);
