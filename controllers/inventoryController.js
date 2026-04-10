const Warehouse = require('../models/Warehouse');
const InventoryAdjustment = require('../models/InventoryAdjustment');
const StockCard = require('../models/StockCard');
const Product = require('../models/Product');

const buildVariantSnapshot = (variant = null) => {
  if (!variant) return null;

  return {
    sku: variant.sku || '',
    color: variant.color || '',
    size: variant.size || ''
  };
};

const buildVariantLabel = (variant = {}, fallbackSku = '') => {
  const pieces = [variant.size, variant.color, variant.sku || fallbackSku]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  return pieces.join(' | ');
};

const serializeInventoryProductOption = (product) => {
  const variants = Array.isArray(product?.variants) ? product.variants : [];

  return {
    _id: product._id,
    name: product.name,
    sku: product.sku,
    category: product.category,
    material: product.material,
    stockPolos: product.stockPolos || 0,
    optionLabel: [product.name, product.category, product.material]
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .join(' | '),
    variants: variants.map((variant) => ({
      _id: variant._id,
      sku: variant.sku,
      color: variant.color,
      size: variant.size,
      stock: variant.stock || 0,
      priceB2C: variant.priceB2C || 0,
      priceB2B: variant.priceB2B || 0,
      optionLabel: buildVariantLabel(variant, product.sku)
    }))
  };
};

// @desc    Get product options for inventory forms
// @route   GET /api/inventory/products
exports.getInventoryProductOptions = async (req, res) => {
  try {
    const filter = {};

    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { sku: { $regex: req.query.search, $options: 'i' } },
        { category: { $regex: req.query.search, $options: 'i' } },
        { material: { $regex: req.query.search, $options: 'i' } },
        { 'variants.sku': { $regex: req.query.search, $options: 'i' } },
        { 'variants.color': { $regex: req.query.search, $options: 'i' } },
        { 'variants.size': { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const products = await Product.find(filter)
      .sort({ category: 1, name: 1 })
      .select('name sku category material stockPolos variants');

    res.json(products.map(serializeInventoryProductOption));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all warehouses
// @route   GET /api/inventory/warehouses
exports.getWarehouses = async (req, res) => {
  try {
    const filter = {};

    if (req.query.type) {
      filter.type = req.query.type;
    }

    if (req.query.active === 'true') {
      filter.isActive = true;
    }

    if (req.query.active === 'false') {
      filter.isActive = false;
    }

    const warehouses = await Warehouse.find(filter).sort({ type: 1, name: 1 });
    res.json(warehouses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create warehouse
// @route   POST /api/inventory/warehouses
exports.createWarehouse = async (req, res) => {
  try {
    const { name, location = '', type = 'Main', isActive = true } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Nama gudang wajib diisi' });
    }

    const duplicate = await Warehouse.findOne({ name: name.trim(), type });
    if (duplicate) {
      return res.status(400).json({ message: 'Gudang dengan nama dan tipe yang sama sudah ada' });
    }

    const warehouse = await Warehouse.create({
      name: name.trim(),
      location: location.trim(),
      type,
      isActive
    });

    res.status(201).json(warehouse);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update warehouse
// @route   PUT /api/inventory/warehouses/:id
exports.updateWarehouse = async (req, res) => {
  try {
    const warehouse = await Warehouse.findById(req.params.id);
    if (!warehouse) {
      return res.status(404).json({ message: 'Gudang tidak ditemukan' });
    }

    const nextName = req.body.name?.trim() || warehouse.name;
    const nextType = req.body.type || warehouse.type;

    const duplicate = await Warehouse.findOne({
      _id: { $ne: warehouse._id },
      name: nextName,
      type: nextType
    });

    if (duplicate) {
      return res.status(400).json({ message: 'Gudang dengan nama dan tipe yang sama sudah ada' });
    }

    warehouse.name = nextName;
    warehouse.location = req.body.location?.trim?.() ?? warehouse.location;
    warehouse.type = nextType;

    if (typeof req.body.isActive === 'boolean') {
      warehouse.isActive = req.body.isActive;
    }

    const updatedWarehouse = await warehouse.save();
    res.json(updatedWarehouse);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete warehouse
// @route   DELETE /api/inventory/warehouses/:id
exports.deleteWarehouse = async (req, res) => {
  try {
    const warehouse = await Warehouse.findById(req.params.id);
    if (!warehouse) {
      return res.status(404).json({ message: 'Gudang tidak ditemukan' });
    }

    const [adjustmentCount, stockCardCount] = await Promise.all([
      InventoryAdjustment.countDocuments({ warehouse: warehouse._id }),
      StockCard.countDocuments({ warehouse: warehouse._id })
    ]);

    if (adjustmentCount > 0 || stockCardCount > 0) {
      return res.status(400).json({
        message: 'Gudang sudah memiliki histori stok atau adjustment dan tidak bisa dihapus'
      });
    }

    await warehouse.deleteOne();
    res.json({ message: 'Gudang berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create inventory adjustment
// @route   POST /api/inventory/adjustments
exports.createAdjustment = async (req, res) => {
  const { productId, variantId, warehouseId, type, quantity, reason } = req.body;
  const qty = Number(quantity);

  try {
    const [product, warehouse] = await Promise.all([
      Product.findById(productId),
      Warehouse.findById(warehouseId)
    ]);

    if (!product) return res.status(404).json({ message: 'Product not found' });
    if (!warehouse) return res.status(404).json({ message: 'Warehouse not found' });
    if (warehouse.isActive === false) {
      return res.status(400).json({ message: 'Gudang nonaktif tidak dapat dipakai untuk adjustment' });
    }
    if (!['In', 'Out'].includes(type)) {
      return res.status(400).json({ message: 'Tipe adjustment tidak valid' });
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ message: 'Jumlah adjustment harus lebih besar dari 0' });
    }
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ message: 'Alasan adjustment wajib diisi' });
    }

    const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
    const selectedVariant = variantId
      ? product.variants?.id(variantId)
      : (hasVariants && product.variants.length === 1 ? product.variants[0] : null);

    if (variantId && !selectedVariant) {
      return res.status(400).json({ message: 'Varian produk tidak ditemukan' });
    }

    if (!variantId && hasVariants && product.variants.length > 1) {
      return res.status(400).json({ message: 'Pilih varian produk terlebih dahulu' });
    }

    const availableStock = selectedVariant
      ? (selectedVariant.stock || 0)
      : (product.stockPolos || 0);

    if (type === 'Out' && availableStock < qty) {
      return res.status(400).json({
        message: `Stok tidak mencukupi. Stok tersedia saat ini: ${availableStock} pcs`
      });
    }

    const change = type === 'In' ? qty : -qty;
    const variantSnapshot = buildVariantSnapshot(selectedVariant);

    // 1. Save adjustment record
    const adjustment = await InventoryAdjustment.create({
      product: productId,
      variantId: selectedVariant?._id,
      variantSnapshot,
      warehouse: warehouseId,
      type,
      quantity: qty,
      reason: String(reason).trim(),
      adjustedBy: req.user?._id
    });

    // 2. Update stock on selected target
    if (selectedVariant) {
      selectedVariant.stock = Math.max(0, (selectedVariant.stock || 0) + change);
    } else {
      product.stockPolos = Math.max(0, (product.stockPolos || 0) + change);
    }

    await product.save();

    // 3. Record to Stock Card
    const referenceNo = `ADJ-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(adjustment._id).slice(-6).toUpperCase()}`;
    await StockCard.create({
      product: productId,
      variantId: selectedVariant?._id,
      variantSnapshot,
      warehouse: warehouseId,
      referenceType: 'Adjustment',
      referenceId: adjustment._id,
      referenceNo,
      quantityChange: change,
      balanceAfter: selectedVariant ? selectedVariant.stock || 0 : product.stockPolos,
      note: String(reason).trim()
    });

    const createdAdjustment = await InventoryAdjustment.findById(adjustment._id)
      .populate('product', 'name sku category material stockPolos variants')
      .populate('warehouse', 'name type');

    res.status(201).json({
      ...createdAdjustment.toObject(),
      productOption: serializeInventoryProductOption(product),
      selectedVariant: selectedVariant
        ? {
            _id: selectedVariant._id,
            ...variantSnapshot,
            stock: selectedVariant.stock || 0,
            optionLabel: buildVariantLabel(selectedVariant, product.sku)
          }
        : null
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get stock cards for a product
// @route   GET /api/inventory/stock-cards/:productId
exports.getStockCards = async (req, res) => {
  try {
    const filter = { product: req.params.productId };

    if (req.query.variantId) {
      filter.variantId = req.query.variantId;
    }

    const cards = await StockCard.find(filter)
      .populate('product', 'name sku category')
      .populate('warehouse', 'name')
      .sort({ createdAt: -1 });
    res.json(cards);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
