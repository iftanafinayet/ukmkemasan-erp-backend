const Order = require('../models/Order');
const Product = require('../models/Product');
const Warehouse = require('../models/Warehouse');
const StockCard = require('../models/StockCard');
const calculateQuote = require('../utils/quoteCalculator');

// @desc    Buat Order Baru (Customer)
exports.createOrder = async (req, res) => {
  try {
    const { productId, quantity, useValve, variantId } = req.body;
    const qty = parseInt(quantity);

    // 1. Validasi Input Dasar
    if (!qty || qty <= 0) {
      return res.status(400).json({ message: 'Jumlah pesanan tidak valid' });
    }

    // 2. Validasi Kelipatan 100 (Sesuai kebijakan UKM Kemasan)
    if (qty % 100 !== 0) {
      return res.status(400).json({ message: 'Pemesanan harus dalam kelipatan 100 pcs' });
    }

    // 3. Ambil data produk & Cek Stok
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Produk tidak ditemukan' });

    const selectedVariant = variantId
      ? product.variants?.id(variantId)
      : null;

    if (!variantId && Array.isArray(product.variants) && product.variants.length > 1) {
      return res.status(400).json({ message: 'Pilih varian produk terlebih dahulu' });
    }

    if (variantId && !selectedVariant) {
      return res.status(400).json({ message: 'Varian produk tidak ditemukan' });
    }

    const availableStock = selectedVariant
      ? (selectedVariant.stock || 0)
      : (product.stockPolos || 0);

    // --- LOGIKA STOK KRUSIAL ---
    if (availableStock < qty) {
      return res.status(400).json({ 
        message: `Stok tidak mencukupi. Stok tersedia saat ini: ${availableStock} pcs` 
      });
    }

    // 4. Jalankan Quotation Engine (B2C vs B2B)
    const quote = calculateQuote(product, qty, useValve, selectedVariant);

    // 5. Generate Order Number
    const count = await Order.countDocuments();
    const orderNumber = `UKM-${new Date().getFullYear()}-${(count + 1).toString().padStart(4, '0')}`;

    // 6. Simpan Order
    const order = new Order({
      orderNumber,
      customer: req.user._id, // Dari authMiddleware
      product: productId,
      details: { 
        quantity: qty, 
        variantId: selectedVariant?._id,
        sku: selectedVariant?.sku || product.sku,
        material: product.material,
        size: selectedVariant?.size || '',
        color: selectedVariant?.color || '',
        useValve: useValve || false,
        unitPrice: quote.unitPriceFinal 
      },
      totalPrice: quote.totalAmount,
      branding: { 
        status: 'Pending',
        // Jika menggunakan upload file (req.file dari multer)
        clientDesignUrl: req.file ? `/uploads/${req.file.filename}` : '' 
      }
    });

    const savedOrder = await order.save();

    // 7. POTONG STOK OTOMATIS
    // Menggunakan atomic update untuk mencegah race condition & stok negatif
    let remainingStock;
    if (selectedVariant) {
      const updatedProduct = await Product.findOneAndUpdate(
        { 
          _id: productId, 
          'variants._id': variantId, 
          'variants.stock': { $gte: qty } 
        },
        { $inc: { 'variants.$.stock': -qty } },
        { new: true }
      );

      if (!updatedProduct) {
        // Jika gagal update, berarti stok berkurang saat proses berlangsung
        return res.status(400).json({ message: 'Stok baru saja habis atau tidak mencukupi' });
      }
      remainingStock = updatedProduct.variants.id(variantId).stock;
    } else {
      const updatedProduct = await Product.findOneAndUpdate(
        { 
          _id: productId, 
          stockPolos: { $gte: qty } 
        },
        { $inc: { stockPolos: -qty } },
        { new: true }
      );

      if (!updatedProduct) {
        return res.status(400).json({ message: 'Stok baru saja habis atau tidak mencukupi' });
      }
      remainingStock = updatedProduct.stockPolos;
    }

    const defaultWarehouse = await Warehouse.findOne({ type: 'Main', isActive: true }).sort({ createdAt: 1 });
    await StockCard.create({
      product: product._id,
      warehouse: defaultWarehouse?._id,
      referenceType: 'Order',
      referenceId: savedOrder._id,
      referenceNo: savedOrder.orderNumber,
      quantityChange: -qty,
      balanceAfter: remainingStock,
      note: selectedVariant
        ? `Pengurangan stok varian ${selectedVariant.size}/${selectedVariant.color} untuk order ${savedOrder.orderNumber}`
        : `Pengurangan stok untuk order ${savedOrder.orderNumber}`
    });
    
    // 8. Respon Sukses
    res.status(201).json({
      message: "Order berhasil dibuat & Stok diperbarui",
      order: savedOrder,
      summary: quote 
    });

  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Lihat Riwayat Order Saya (Customer)
exports.getMyOrders = async (req, res) => {
  try {
    // 2. Gunakan req.user._id (pastikan middleware protect sudah jalan)
    const orders = await Order.find({ customer: req.user._id })
  .populate('product', 'name') // Hanya ambil field yang pasti ada di model Product
  .sort({ createdAt: -1 });
    
    res.json(orders);
  } catch (error) {
    console.error("ERROR GET_MY_ORDERS:", error.message); // Cek terminal backend Anda!
    res.status(500).json({ message: error.message });
  }
};

// @desc    Detail Order berdasarkan ID
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'name email phone')
      .populate('product', 'name category material priceB2C priceB2B');

    if (order) {
      const isOwner = String(order.customer?._id || order.customer) === String(req.user?._id);
      const isAdmin = req.user?.role === 'admin';

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: 'Akses ditolak untuk detail order ini' });
      }

      res.json(order);
    } else {
      res.status(404).json({ message: 'Order tidak ditemukan' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update status produksi & Pembayaran (Admin)
exports.updateOrderStatus = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order tidak ditemukan' });

    const oldStatus = order.status;
    const newStatus = req.body.status || order.status;
    order.isPaid = req.body.isPaid !== undefined ? req.body.isPaid : order.isPaid;

    // LOGIKA RESTORASI STOK: Jika status berubah menjadi 'Cancelled'
    if (oldStatus !== 'Cancelled' && newStatus === 'Cancelled') {
      const { productId, quantity, variantId } = order.details; //- Note: variantId is in details
      const qty = parseInt(quantity);

      let remainingStock;
      if (variantId) {
        const updatedProduct = await Product.findOneAndUpdate(
          { _id: productId, 'variants._id': variantId },
          { $inc: { 'variants.$.stock': qty } },
          { new: true }
        );
        remainingStock = updatedProduct?.variants.id(variantId)?.stock;
      } else {
        const updatedProduct = await Product.findOneAndUpdate(
          { _id: productId },
          { $inc: { stockPolos: qty } },
          { new: true }
        );
        remainingStock = updatedProduct?.stockPolos;
      }

      // Catat di StockCard
      const defaultWarehouse = await Warehouse.findOne({ type: 'Main', isActive: true }).sort({ createdAt: 1 });
      await StockCard.create({
        product: productId,
        warehouse: defaultWarehouse?._id,
        referenceType: 'Order',
        referenceId: order._id,
        referenceNo: order.orderNumber,
        quantityChange: qty,
        balanceAfter: remainingStock,
        note: `Restorasi stok karena order ${order.orderNumber} dibatalkan`
      });
    }

    order.status = newStatus;
    const updatedOrder = await order.save();
    res.json(updatedOrder);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update Mockup & Status Desain (Admin/Designer)
exports.updateOrderDesign = async (req, res) => {
    try {
      const order = await Order.findById(req.params.id);
      if (!order) return res.status(404).json({ message: 'Order tidak ditemukan' });
  
      if (req.file) {
        order.branding.mockupUrl = `/uploads/${req.file.filename}`;
      }
  
      order.branding.status = req.body.status || order.branding.status;
      order.branding.notes = req.body.notes || order.branding.notes;
  
      const updatedOrder = await order.save();
      res.json(updatedOrder);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  };
