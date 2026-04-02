const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Nama Produk harus diisi'],
    unique: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Standing Pouch', 'Gusset Side Seal', 'Gusset Quad Seal', 'Gusset', 'Flat Bottom', 'Flatbottom Square', 'Flatbottom Rice Papper', 'Flatbottom Rice Papper Square', 'Sachet', 'Dripbag', 'Vacuum Pack', 'Roll', 'Lain Lain']
  },
  material: {
    type: String,
    required: true
  },
  priceBase: {
    type: Number,
    required: true,
    default: 0
  },
  description: {
    type: String
  },
  images: [{
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    alt: { type: String, default: '' }
  }],
  stockPolos: {
    type: Number,
    default: 0
  },
  minOrder: {
    type: Number,
    default: 100
  },
  addons: {
    valvePrice: { type: Number, default: 600 } // Biaya pasang valve per pcs
  },
  priceB2C: { type: Number, required: true },
  priceB2B: { type: Number, required: true }

}, { timestamps: true });

module.exports = mongoose.model('Product', ProductSchema);