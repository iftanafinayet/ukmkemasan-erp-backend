const mongoose = require('mongoose');

const InvoiceItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: String,
  sku: String,
  size: String,
  color: String,
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  subtotal: { type: Number, required: true }
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  items: [InvoiceItemSchema],
  issuedDate: {
    type: Date,
    default: Date.now
  },
  dueDate: {
    type: Date,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: ['Draft', 'Issued', 'Partially Paid', 'Paid', 'Overdue'],
    default: 'Issued'
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastMidtransOrderId: {
    type: String,
    trim: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Invoice', invoiceSchema);
