const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: mongoose.Schema.Types.ObjectId },
  sku: String,
  material: String,
  size: String,
  color: String,
  unitPrice: { type: Number, required: true },
  quantity: { type: Number, required: true },
  useValve: { type: Boolean, default: false },
  subtotal: { type: Number, required: true }
}, { _id: false });

const OrderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  items: [OrderItemSchema],

  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },

  details: {
    quantity: Number,
    variantId: { type: mongoose.Schema.Types.ObjectId },
    sku: String,
    material: String,
    size: String,
    color: String,
    unitPrice: Number,
    useValve: { type: Boolean, default: false }
  },

  orderType: {
    type: String,
    enum: ['Regular', 'Sample'],
    default: 'Regular'
  },

  branding: {
    clientDesignUrl: String,
    mockupUrl: String,
    status: {
      type: String,
      enum: ['Pending', 'Reviewing', 'Revision', 'Approved'],
      default: 'Pending'
    },
    notes: String
  },

  status: {
    type: String,
    enum: ['Quotation', 'Payment', 'Production', 'Quality Control', 'Shipping', 'Completed', 'Cancelled'],
    default: 'Quotation'
  },

  shipping: {
    courierCode: String,
    courierService: String,
    cost: Number,
    cashback: Number,
    weightGram: Number,
    itemValue: Number,
    destinationId: Number,
    recipient: {
      name: String,
      phone: String,
      email: String,
      address: String,
      pinPoint: String
    }
  },

  shippingProvider: {
    orderId: Number,
    orderNo: String,
    awb: String,
    labelUrl: String,
    pickupScheduled: { type: Boolean, default: false },
    pickupDate: Date,
    status: {
      type: String,
      enum: [
        'NotCreated', 'OrderCreated', 'PickupScheduled', 'LabelGenerated',
        'PickedUp', 'InTransit', 'Delivered', 'Cancelled', 'Problem'
      ],
      default: 'NotCreated'
    },
    statusHistory: [
      { status: String, description: String, timestamp: Date }
    ]
  },

  totalPrice: Number,
  isPaid: { type: Boolean, default: false },
  scannedAt: { type: Date, default: null },
  scannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('Order', OrderSchema);
