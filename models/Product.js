const mongoose = require('mongoose');

const syncSummaryFieldsFromVariants = (product) => {
  if (!product || !Array.isArray(product.variants) || product.variants.length === 0) {
    return;
  }

  const [primaryVariant] = product.variants;
  const totalStock = product.variants.reduce((sum, variant) => sum + (Number(variant.stock) || 0), 0);

  product.sku = primaryVariant.sku;
  product.priceBase = Number(primaryVariant.priceB2B) || Number(primaryVariant.priceB2C) || 0;
  product.priceB2C = Number(primaryVariant.priceB2C) || 0;
  product.priceB2B = Number(primaryVariant.priceB2B) || Number(primaryVariant.priceB2C) || 0;
  product.stockPolos = totalStock;
};

const ProductVariantSchema = new mongoose.Schema({
  sku: {
    type: String,
    required: [true, 'SKU varian harus diisi'],
    trim: true
  },
  color: {
    type: String,
    required: [true, 'Warna varian harus diisi'],
    trim: true
  },
  size: {
    type: String,
    required: [true, 'Ukuran varian harus diisi'],
    trim: true
  },
  priceB2C: {
    type: Number,
    required: [true, 'Harga B2C varian harus diisi'],
    min: 0
  },
  priceB2B: {
    type: Number,
    required: [true, 'Harga B2B varian harus diisi'],
    min: 0
  },
  stock: {
    type: Number,
    default: 0,
    min: 0
  }
}, { _id: true });

const ProductSchema = new mongoose.Schema({
  sku: {
    type: String,
    trim: true,
    sparse: true
  },
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
  variants: {
    type: [ProductVariantSchema],
    default: [],
    validate: {
      validator: (variants) => Array.isArray(variants) && variants.length > 0,
      message: 'Minimal satu varian produk harus tersedia'
    }
  },
  priceB2C: { type: Number, required: true },
  priceB2B: { type: Number, required: true }

}, { timestamps: true });

ProductSchema.methods.syncSummaryFieldsFromVariants = function syncSummaryFieldsFromVariants() {
  syncSummaryFieldsFromVariants(this);
};

ProductSchema.pre('validate', function syncSummary(next) {
  this.syncSummaryFieldsFromVariants();
  next();
});

ProductSchema.pre('insertMany', function syncSummaryOnInsert(next, docs) {
  docs.forEach(syncSummaryFieldsFromVariants);
  next();
});

module.exports = mongoose.model('Product', ProductSchema);
