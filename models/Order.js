const mongoose = require('mongoose');

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
  
  product: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product', 
    required: true 
  },

    details: {
        quantity: {
            type: Number,
            required: true
        },
        material: String,
        size: String,
        useValve: { type: Boolean, default: false}
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
        enum: ['Quotation', 'Payment', 'Production', 'Quality Control', 'Shipping', 'Completed'],
        default: 'Quotation'
    },

    totalPrice: Number,
    isPaid: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Order', OrderSchema);