const mongoose = require('mongoose');

const stockCardSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },
  referenceType: { type: String, enum: ['Order', 'Adjustment', 'Return'] },
  referenceId: { type: mongoose.Schema.Types.ObjectId },
  referenceNo: { type: String, trim: true },
  quantityChange: { type: Number, required: true },
  balanceAfter: { type: Number, required: true },
  note: { type: String, trim: true }
}, { timestamps: true });

module.exports = mongoose.model('StockCard', stockCardSchema);
