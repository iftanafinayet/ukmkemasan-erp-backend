const Warehouse = require('../models/Warehouse');
const InventoryAdjustment = require('../models/InventoryAdjustment');
const StockCard = require('../models/StockCard');
const Product = require('../models/Product');

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
  const { productId, warehouseId, type, quantity, reason } = req.body;
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

    // 1. Save adjustment record
    const adjustment = await InventoryAdjustment.create({
      product: productId,
      warehouse: warehouseId,
      type,
      quantity: qty,
      reason,
      adjustedBy: req.user?._id
    });

    // 2. Calculate stock change
    const change = type === 'In' ? qty : -qty;

    if (type === 'Out' && (product.stockPolos || 0) < qty) {
      await adjustment.deleteOne();
      return res.status(400).json({
        message: `Stok tidak mencukupi. Stok tersedia saat ini: ${product.stockPolos || 0} pcs`
      });
    }
    
    // 3. Update Product stock (Simple logic for now)
    product.stockPolos = (product.stockPolos || 0) + change;
    await product.save();

    // 4. Record to Stock Card
    const referenceNo = `ADJ-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(adjustment._id).slice(-6).toUpperCase()}`;
    await StockCard.create({
      product: productId,
      warehouse: warehouseId,
      referenceType: 'Adjustment',
      referenceId: adjustment._id,
      referenceNo,
      quantityChange: change,
      balanceAfter: product.stockPolos,
      note: reason
    });

    const createdAdjustment = await InventoryAdjustment.findById(adjustment._id)
      .populate('product', 'name sku')
      .populate('warehouse', 'name type');

    res.status(201).json(createdAdjustment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get stock cards for a product
// @route   GET /api/inventory/stock-cards/:productId
exports.getStockCards = async (req, res) => {
  try {
    const cards = await StockCard.find({ product: req.params.productId })
      .populate('warehouse', 'name')
      .sort({ createdAt: -1 });
    res.json(cards);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
