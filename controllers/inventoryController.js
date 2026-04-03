const Warehouse = require('../models/Warehouse');
const InventoryAdjustment = require('../models/InventoryAdjustment');
const StockCard = require('../models/StockCard');
const Product = require('../models/Product');

// @desc    Get all warehouses
// @route   GET /api/inventory/warehouses
exports.getWarehouses = async (req, res) => {
  try {
    const warehouses = await Warehouse.find({});
    res.json(warehouses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create warehouse
// @route   POST /api/inventory/warehouses
exports.createWarehouse = async (req, res) => {
  try {
    const warehouse = await Warehouse.create(req.body);
    res.status(201).json(warehouse);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Create inventory adjustment
// @route   POST /api/inventory/adjustments
exports.createAdjustment = async (req, res) => {
  const { productId, warehouseId, type, quantity, reason } = req.body;

  try {
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // 1. Save adjustment record
    const adjustment = await InventoryAdjustment.create({
      product: productId,
      warehouse: warehouseId,
      type,
      quantity,
      reason,
      adjustedBy: req.user?._id
    });

    // 2. Calculate stock change
    const change = type === 'In' ? quantity : -quantity;
    
    // 3. Update Product stock (Simple logic for now)
    product.stockPolos = (product.stockPolos || 0) + change;
    await product.save();

    // 4. Record to Stock Card
    await StockCard.create({
      product: productId,
      warehouse: warehouseId,
      referenceType: 'Adjustment',
      referenceId: adjustment._id,
      quantityChange: change,
      balanceAfter: product.stockPolos
    });

    res.status(201).json(adjustment);
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
