const Order = require('../models/Order');
const Product = require('../models/Product');
const Warehouse = require('../models/Warehouse');
const StockCard = require('../models/StockCard');
const OrderLog = require('../models/OrderLog');
const mongoose = require('mongoose');
const calculateQuote = require('../utils/quoteCalculator');
const productionService = require('../services/productionService');
const notificationService = require('../services/notificationService');
const emailService = require('../services/emailService');

const SAMPLE_SHIPPING_COST = 20000;

const validateOrderItem = async (item, isSample = false) => {
  const { productId, variantId, quantity, useValve } = item;
  const qty = parseInt(quantity);

  if (!qty || qty <= 0) {
    throw { status: 400, message: `Jumlah pesanan tidak valid untuk productId ${productId}` };
  }

  const product = await Product.findById(productId);
  if (!product) throw { status: 404, message: `Produk ${productId} tidak ditemukan` };

  if (isSample) {
    if (qty < 1 || qty > 3) {
      throw { status: 400, message: `Sample maksimal 3 pcs` };
    }
  } else {
    if (qty % 100 !== 0) {
      throw { status: 400, message: `Pemesanan ${productId} harus dalam kelipatan 100 pcs` };
    }
  }

  const selectedVariant = variantId ? product.variants?.id(variantId) : null;

  if (!variantId && Array.isArray(product.variants) && product.variants.length > 1) {
    throw { status: 400, message: `Pilih varian untuk produk ${product.name}` };
  }

  if (variantId && !selectedVariant) {
    throw { status: 400, message: `Varian produk ${product.name} tidak ditemukan` };
  }

  const availableStock = selectedVariant
    ? (selectedVariant.stock || 0)
    : (product.stockPolos || 0);

  if (availableStock < qty) {
    throw { status: 400, message: `Stok ${product.name} tidak mencukupi. Tersedia: ${availableStock} pcs` };
  }

  let unitPriceFinal;
  if (isSample) {
    const samplePrice = product.samplePrice || selectedVariant?.priceB2C || product.priceB2C || 0;
    unitPriceFinal = samplePrice;
  } else {
    const quote = calculateQuote(product, qty, useValve, selectedVariant);
    unitPriceFinal = quote.unitPriceFinal;
  }

  return {
    product,
    selectedVariant,
    qty,
    useValve: isSample ? false : (useValve || false),
    unitPriceFinal,
    orderItem: {
      product: product._id,
      variantId: selectedVariant?._id,
      sku: selectedVariant?.sku || product.sku,
      material: product.material,
      size: selectedVariant?.size || '',
      color: selectedVariant?.color || '',
      unitPrice: unitPriceFinal,
      quantity: qty,
      useValve: isSample ? false : (useValve || false),
      subtotal: qty * unitPriceFinal
    }
  };
};

const deductItemStock = async (validated, session) => {
  const { product, selectedVariant, qty } = validated;
  const productId = product._id;
  const variantId = selectedVariant?._id;

  let remainingStock;
  if (selectedVariant) {
    const updatedProduct = await Product.findOneAndUpdate(
      { _id: productId, 'variants._id': variantId, 'variants.stock': { $gte: qty } },
      { $inc: { 'variants.$.stock': -qty } },
      { new: true, session }
    );
    if (!updatedProduct) {
      throw { status: 400, message: `Stok ${product.name} baru saja habis` };
    }
    remainingStock = updatedProduct.variants.id(variantId).stock;
  } else {
    const updatedProduct = await Product.findOneAndUpdate(
      { _id: productId, stockPolos: { $gte: qty } },
      { $inc: { stockPolos: -qty } },
      { new: true, session }
    );
    if (!updatedProduct) {
      throw { status: 400, message: `Stok ${product.name} baru saja habis` };
    }
    remainingStock = updatedProduct.stockPolos;
  }

  return {
    productId,
    productName: product.name,
    remainingStock,
    minStockAlert: product.minStockAlert || 100,
    variantLabel: selectedVariant
      ? `${selectedVariant.size}/${selectedVariant.color}`
      : null
  };
};

// @desc    Buat Order Baru (Customer) — support single item, multi-item & sample
exports.createOrder = async (req, res) => {
  const { items, productId, quantity, useValve, variantId, orderType, shipping } = req.body;
  const isSample = orderType === 'Sample';
  const isMultiItem = Array.isArray(items) && items.length > 0 && !isSample;

  const rawItems = isMultiItem
    ? items
    : [{ productId, variantId, quantity, useValve }];

  try {
    // 1. Validasi sample limit per customer
    if (isSample) {
      const firstProductId = items?.[0]?.productId || productId;
      const sampleCount = await Order.countDocuments({
        customer: req.user._id,
        'items.product': firstProductId,
        orderType: 'Sample'
      });
      const firstProduct = await Product.findById(firstProductId);
      const maxSample = firstProduct?.maxSamplePerCustomer || 1;
      if (sampleCount >= maxSample) {
        return res.status(400).json({ message: `Kamu sudah memesan sample produk ini. Maksimal ${maxSample}x sample per produk.` });
      }
    }

    // 2. Validasi semua item
    const validatedItems = await Promise.all(
      rawItems.map((item) => validateOrderItem(item, isSample))
    );

    const subtotal = validatedItems.reduce((sum, v) => sum + v.orderItem.subtotal, 0);

    let shippingCost = isSample ? SAMPLE_SHIPPING_COST : 0;
    let shippingSnapshot = null;
    if (!isSample && shipping && shipping.cost != null) {
      shippingCost = Number(shipping.cost) || 0;
      const weightGram = validatedItems.reduce(
        (sum, v) => sum + ((v.selectedVariant?.weightGram || 17) * v.qty),
        0
      );
      shippingSnapshot = {
        courierCode: shipping.courierCode,
        courierService: shipping.courierService,
        cost: shippingCost,
        cashback: Number(shipping.cashback) || 0,
        weightGram,
        itemValue: subtotal,
        destinationId: shipping.destinationId,
        recipient: {
          name: shipping.recipient?.name,
          phone: shipping.recipient?.phone,
          email: shipping.recipient?.email,
          address: shipping.recipient?.address,
          pinPoint: shipping.recipient?.pinPoint,
        },
      };
    }
    const totalPrice = subtotal + shippingCost;
    const count = await Order.countDocuments();
    const orderNumber = `UKM-${new Date().getFullYear()}-${(count + 1).toString().padStart(4, '0')}`;
    const firstItem = validatedItems[0].orderItem;
    const isFreeSample = isSample && subtotal === 0;

    // 3. MongoDB transaction untuk atomic stock decrement
    const session = await mongoose.startSession();
    let savedOrder;

    try {
      session.startTransaction();

      const stockInfos = await Promise.all(
        validatedItems.map((v) => deductItemStock(v, session))
      );

      const orderData = {
        orderNumber,
        customer: req.user._id,
        orderType: isSample ? 'Sample' : 'Regular',
        items: validatedItems.map((v) => v.orderItem),
        product: firstItem.product,
        details: {
          quantity: firstItem.quantity,
          variantId: firstItem.variantId,
          sku: firstItem.sku,
          material: firstItem.material,
          size: firstItem.size,
          color: firstItem.color,
          unitPrice: firstItem.unitPrice,
          useValve: isSample ? false : firstItem.useValve
        },
        totalPrice,
        branding: {
          status: 'Pending',
          clientDesignUrl: ''
        }
      };

      if (shippingSnapshot) {
        orderData.shipping = shippingSnapshot;
      }

      if (isFreeSample) {
        orderData.isPaid = true;
        orderData.status = 'Production';
      }

      const [order] = await Order.create([orderData], { session });
      savedOrder = order;

      await OrderLog.create([{
        order: savedOrder._id,
        action: isSample ? 'Sample Order Created' : 'Order Created',
        oldValue: '',
        newValue: savedOrder.status,
        changedBy: req.user?._id
      }], { session });

      await session.commitTransaction();

      // 4. Stock Cards & Alerts
      try {
        const defaultWarehouse = await Warehouse.findOne({ type: 'Main', isActive: true }).sort({ createdAt: 1 });

        for (const si of stockInfos) {
          const orderQty = validatedItems.find(
            (v) => String(v.product._id) === String(si.productId)
          )?.qty || 0;

          await StockCard.create({
            product: si.productId,
            warehouse: defaultWarehouse?._id,
            referenceType: 'Order',
            referenceId: savedOrder._id,
            referenceNo: savedOrder.orderNumber,
            quantityChange: -orderQty,
            balanceAfter: si.remainingStock,
            note: `${isSample ? 'Sample' : 'Order'}: ${si.variantLabel ? `varian ${si.variantLabel} untuk` : ''} ${savedOrder.orderNumber}`
          });

          if (si.remainingStock < si.minStockAlert && !isSample) {
            const productName = si.variantLabel
              ? `${si.productName} (${si.variantLabel})`
              : si.productName;
            const msg = `⚠️ *Low Stock Alert*\nProduct: ${productName}\nRemaining: ${si.remainingStock} pcs\nOrder: ${savedOrder.orderNumber}`;
            notificationService.sendTelegramRaw(msg).catch(() => {});
          }
        }
      } catch (nonCriticalErr) {
        console.error('Non-critical error (stock card/alert):', nonCriticalErr.message);
      }

      const itemCount = validatedItems.length;
      res.status(201).json({
        message: isSample
          ? (isFreeSample ? 'Sample gratis berhasil dipesan!' : 'Sample berhasil dipesan!')
          : (isMultiItem ? `${itemCount} item berhasil dipesan dalam 1 order` : "Order berhasil dibuat & Stok diperbarui"),
        order: savedOrder
      });
    } catch (txError) {
      await session.abortTransaction();
      throw { status: 400, message: txError.message || 'Gagal memproses pesanan' };
    } finally {
      session.endSession();
    }
  } catch (error) {
    const status = error.status || 400;
    res.status(status).json({ message: error.message });
  }
};

// @desc    Lihat Riwayat Order Saya (Customer)
exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.user._id })
      .populate('product', 'name images')
      .populate('items.product', 'name images category')
      .sort({ createdAt: -1 });
    
    res.json(orders);
  } catch (error) {
    console.error("ERROR GET_MY_ORDERS:", error.message);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Detail Order berdasarkan ID
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'name email phone')
      .populate('product', 'name category material priceB2C priceB2B images')
      .populate('items.product', 'name category material images');

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
    let order = await Order.findById(req.params.id)
      .populate('customer', 'name email phone')
      .populate('product', 'name category material')
      .populate('items.product', 'name category material');
    if (!order) return res.status(404).json({ message: 'Order tidak ditemukan' });

    const isAdmin = req.user?.role === 'admin';
    const isOwner = String(order.customer?._id || order.customer) === String(req.user?._id);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'Akses ditolak' });
    }

    if (!isAdmin) {
      if (req.body.isPaid !== undefined || req.body.awb !== undefined) {
        return res.status(403).json({ message: 'Akses ditolak' });
      }
      if (req.body.status && req.body.status !== 'Completed') {
        return res.status(403).json({ message: 'Anda hanya dapat menyelesaikan pesanan' });
      }
      if (order.status !== 'Shipping') {
        return res.status(400).json({ message: 'Pesanan hanya bisa diselesaikan saat status Shipping' });
      }
    }

    const oldStatus = order.status;
    const newStatus = req.body.status || order.status;
    order.isPaid = req.body.isPaid !== undefined ? req.body.isPaid : order.isPaid;

    if (req.body.awb) {
      if (!order.shippingProvider) {
        order.shippingProvider = {};
      }
      order.shippingProvider.awb = req.body.awb;
    }

    // LOGIKA RESTORASI STOK: Jika status berubah menjadi 'Cancelled'
    if (oldStatus !== 'Cancelled' && newStatus === 'Cancelled') {
      const restoreItems = order.items && order.items.length > 0
        ? order.items
        : [{
            product: order.product,
            variantId: order.details?.variantId,
            quantity: order.details?.quantity || 0
          }];

      const defaultWarehouse = await Warehouse.findOne({ type: 'Main', isActive: true }).sort({ createdAt: 1 });

      for (const item of restoreItems) {
        const qty = parseInt(item.quantity);
        if (!qty) continue;

        let remainingStock;
        if (item.variantId) {
          const updatedProduct = await Product.findOneAndUpdate(
            { _id: item.product, 'variants._id': item.variantId },
            { $inc: { 'variants.$.stock': qty } },
            { new: true }
          );
          remainingStock = updatedProduct?.variants.id(item.variantId)?.stock;
        } else {
          const updatedProduct = await Product.findOneAndUpdate(
            { _id: item.product },
            { $inc: { stockPolos: qty } },
            { new: true }
          );
          remainingStock = updatedProduct?.stockPolos;
        }

        await StockCard.create({
          product: item.product,
          warehouse: defaultWarehouse?._id,
          referenceType: 'Order',
          referenceId: order._id,
          referenceNo: order.orderNumber,
          quantityChange: qty,
          balanceAfter: remainingStock,
          note: `Restorasi stok karena order ${order.orderNumber} dibatalkan`
        });
      }
    }

    order.status = newStatus;
    const updatedOrder = await order.save();

    if (oldStatus !== newStatus) {
      await OrderLog.create({
        order: order._id,
        action: 'Status Changed',
        oldValue: oldStatus,
        newValue: newStatus,
        changedBy: req.user?._id
      });
    }

    if (newStatus === 'Production' && oldStatus !== 'Production' && order.isPaid) {
      try {
        const task = await productionService.autoCreateProductionTask(order);
        await notificationService.sendTelegramAlert(task, order);
      } catch (err) {
        console.error('Production task creation failed:', err.message);
      }
    }

    if (newStatus === 'Shipping' && oldStatus !== 'Shipping' && order.customer?.email) {
      const courier = order.shipping?.courierService || order.shipping?.courierCode || '-';
      const awb = order.shippingProvider?.awb || '-';

      const items = order.items && order.items.length > 0 ? order.items : [order.details];
      const itemRows = items.filter(Boolean).map((i) => {
        const name = i.product?.name || i.sku || '-';
        const qty = i.quantity || 0;
        const sz = i.size || '-';
        const clr = i.color || '-';
        return `<tr>
          <td style="padding:6px 10px;border:1px solid #e5e5e5;font-size:13px">${name}</td>
          <td style="padding:6px 10px;border:1px solid #e5e5e5;font-size:13px;text-align:center">${qty.toLocaleString('id-ID')} pcs</td>
          <td style="padding:6px 10px;border:1px solid #e5e5e5;font-size:13px;text-align:center">${sz}</td>
          <td style="padding:6px 10px;border:1px solid #e5e5e5;font-size:13px;text-align:center">${clr}</td>
        </tr>`;
      }).join('');

      emailService.sendEmail({
        to: order.customer.email,
        subject: `Pesanan ${order.orderNumber} Telah Dikirim - UKM Kemasan`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;border:1px solid #e0e0e0;border-radius:12px">
            <h2 style="color:#0f766e;margin:0 0 8px">UKM Kemasan</h2>
            <p style="color:#444;font-size:15px;margin:0 0 16px">Halo <strong>${order.customer.name || 'Pelanggan'}</strong>,</p>
            <p style="color:#444;font-size:15px;margin:0 0 24px">Pesanan Anda telah dikirim. Berikut detail pesanan:</p>

            <table style="width:100%;border-collapse:collapse;margin:0 0 20px">
              <tr>
                <td style="padding:8px 12px;border:1px solid #e5e5e5;background:#f9fafb;font-weight:600;width:120px">No. Pesanan</td>
                <td style="padding:8px 12px;border:1px solid #e5e5e5">${order.orderNumber}</td>
              </tr>
              <tr>
                <td style="padding:8px 12px;border:1px solid #e5e5e5;background:#f9fafb;font-weight:600">Kurir</td>
                <td style="padding:8px 12px;border:1px solid #e5e5e5">${courier}</td>
              </tr>
              <tr>
                <td style="padding:8px 12px;border:1px solid #e5e5e5;background:#f9fafb;font-weight:600">No. Resi</td>
                <td style="padding:8px 12px;border:1px solid #e5e5e5;font-family:monospace">${awb}</td>
              </tr>
            </table>

            <p style="color:#444;font-size:14px;font-weight:600;margin:0 0 8px">Detail Produk</p>
            <table style="width:100%;border-collapse:collapse;margin:0 0 24px">
              <thead>
                <tr style="background:#f9fafb">
                  <th style="padding:6px 10px;border:1px solid #e5e5e5;font-size:11px;text-transform:uppercase;text-align:left">Produk</th>
                  <th style="padding:6px 10px;border:1px solid #e5e5e5;font-size:11px;text-transform:uppercase;text-align:center">Qty</th>
                  <th style="padding:6px 10px;border:1px solid #e5e5e5;font-size:11px;text-transform:uppercase;text-align:center">Ukuran</th>
                  <th style="padding:6px 10px;border:1px solid #e5e5e5;font-size:11px;text-transform:uppercase;text-align:center">Warna</th>
                </tr>
              </thead>
              <tbody>${itemRows}</tbody>
            </table>

            <p style="color:#888;font-size:12px;margin:0">Terima kasih telah berbelanja di UKM Kemasan.</p>
          </div>
        `,
      }).catch(err => console.error('[Order] Gagal kirim email shipping:', err.message));
    }

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

// @desc    Cancel order oleh Customer (sebelum masuk Production)
exports.cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'name email phone')
      .populate('product', 'name category material')
      .populate('items.product', 'name category material');
    if (!order) return res.status(404).json({ message: 'Order tidak ditemukan' });

    const isOwner = String(order.customer?._id || order.customer) === String(req.user?._id);
    if (!isOwner) {
      return res.status(403).json({ message: 'Akses ditolak' });
    }

    if (!['Quotation', 'Payment'].includes(order.status)) {
      const messages = {
        'Production': 'Pesanan sedang dalam produksi. Hubungi admin untuk pembatalan.',
        'Quality Control': 'Pesanan sedang dalam quality control. Hubungi admin untuk pembatalan.',
        'Shipping': 'Pesanan sedang dalam pengiriman. Hubungi admin untuk pembatalan.',
        'Completed': 'Pesanan sudah selesai dan tidak bisa dibatalkan.',
        'Cancelled': 'Pesanan sudah dibatalkan sebelumnya.'
      };
      return res.status(400).json({
        message: messages[order.status] || 'Pesanan sudah diproses dan tidak bisa dibatalkan. Hubungi admin.'
      });
    }

    const oldStatus = order.status;

    const getProductId = (p) => (p && p._id ? p._id : p);

    const restoreItems = order.items && order.items.length > 0
      ? order.items.map((i) => ({
          product: getProductId(i.product),
          variantId: i.variantId,
          quantity: parseInt(i.quantity) || 0
        }))
      : [{
          product: getProductId(order.product),
          variantId: order.details?.variantId,
          quantity: parseInt(order.details?.quantity) || 0
        }];

    const defaultWarehouse = await Warehouse.findOne({ type: 'Main', isActive: true }).sort({ createdAt: 1 });

    for (const item of restoreItems) {
      const qty = item.quantity;
      if (!qty) continue;

      let remainingStock;
      if (item.variantId) {
        const updatedProduct = await Product.findOneAndUpdate(
          { _id: item.product, 'variants._id': item.variantId },
          { $inc: { 'variants.$.stock': qty } },
          { new: true }
        );
        remainingStock = updatedProduct?.variants.id(item.variantId)?.stock;
      } else {
        const updatedProduct = await Product.findOneAndUpdate(
          { _id: item.product },
          { $inc: { stockPolos: qty } },
          { new: true }
        );
        remainingStock = updatedProduct?.stockPolos;
      }

      await StockCard.create({
        product: item.product,
        warehouse: defaultWarehouse?._id,
        referenceType: 'Order',
        referenceId: order._id,
        referenceNo: order.orderNumber,
        quantityChange: qty,
        balanceAfter: remainingStock,
        note: `Restorasi stok karena pembatalan oleh customer (${order.orderNumber})`
      });
    }

    order.status = 'Cancelled';
    order.isPaid = false;

    if (order.branding) {
      order.branding.notes = order.branding.notes
        ? `${order.branding.notes} | Dibatalkan oleh customer`
        : 'Dibatalkan oleh customer';
    }

    const updatedOrder = await order.save();

    await OrderLog.create({
      order: order._id,
      action: 'Order Cancelled',
      oldValue: oldStatus,
      newValue: 'Cancelled',
      note: req.body?.reason || 'Dibatalkan oleh customer',
      changedBy: req.user?._id
    });

    res.json({ message: 'Pesanan berhasil dibatalkan', order: updatedOrder });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get activity logs for an order
exports.getOrderLogs = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).select('customer');
    if (!order) return res.status(404).json({ message: 'Order tidak ditemukan' });

    const isOwner = String(order.customer?._id || order.customer) === String(req.user?._id);
    const isAdmin = req.user?.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Akses ditolak' });
    }

    const logs = await OrderLog.find({ order: req.params.id })
      .populate('changedBy', 'name email')
      .sort({ createdAt: -1 });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Scan resi via barcode — simpan AWB, ubah status ke Shipping, dan kirim email (Admin)
exports.scanResi = async (req, res) => {
  try {
    const { nomor_resi } = req.body;
    if (!nomor_resi || !nomor_resi.trim()) {
      return res.status(400).json({ success: false, message: 'Nomor resi tidak boleh kosong.' });
    }

    const trimmedResi = nomor_resi.trim();

    const order = await Order.findById(req.params.id)
      .populate('customer', 'name email phone')
      .populate('product', 'name category material')
      .populate('items.product', 'name category material');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order tidak ditemukan.' });
    }

    if (!order.shippingProvider) {
      order.shippingProvider = {};
    }
    order.shippingProvider.awb = trimmedResi;

    const oldStatus = order.status;
    if (oldStatus !== 'Shipping') {
      order.status = 'Shipping';
    }

    order.scannedAt = new Date();
    order.scannedBy = req.user?._id;

    const updatedOrder = await order.save();

    if (oldStatus !== 'Shipping') {
      await OrderLog.create({
        order: order._id,
        action: 'Status Changed',
        oldValue: oldStatus,
        newValue: 'Shipping',
        changedBy: req.user?._id,
      });
    }

    if (order.customer?.email) {
      const courier = order.shipping?.courierService || order.shipping?.courierCode || '-';
      const awb = order.shippingProvider?.awb || '-';

      const items = order.items && order.items.length > 0 ? order.items : [order.details];
      const itemRows = items.filter(Boolean).map((i) => {
        const name = i.product?.name || i.sku || '-';
        const qty = i.quantity || 0;
        const sz = i.size || '-';
        const clr = i.color || '-';
        return `<tr>
          <td style="padding:6px 10px;border:1px solid #e5e5e5;font-size:13px">${name}</td>
          <td style="padding:6px 10px;border:1px solid #e5e5e5;font-size:13px;text-align:center">${qty.toLocaleString('id-ID')} pcs</td>
          <td style="padding:6px 10px;border:1px solid #e5e5e5;font-size:13px;text-align:center">${sz}</td>
          <td style="padding:6px 10px;border:1px solid #e5e5e5;font-size:13px;text-align:center">${clr}</td>
        </tr>`;
      }).join('');

      emailService.sendEmail({
        to: order.customer.email,
        subject: `Pesanan ${order.orderNumber} Telah Dikirim - UKM Kemasan`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;border:1px solid #e0e0e0;border-radius:12px">
            <h2 style="color:#0f766e;margin:0 0 8px">UKM Kemasan</h2>
            <p style="color:#444;font-size:15px;margin:0 0 16px">Halo <strong>${order.customer.name || 'Pelanggan'}</strong>,</p>
            <p style="color:#444;font-size:15px;margin:0 0 24px">Pesanan Anda telah dikirim. Berikut detail pesanan:</p>

            <table style="width:100%;border-collapse:collapse;margin:0 0 20px">
              <tr>
                <td style="padding:8px 12px;border:1px solid #e5e5e5;background:#f9fafb;font-weight:600;width:120px">No. Pesanan</td>
                <td style="padding:8px 12px;border:1px solid #e5e5e5">${order.orderNumber}</td>
              </tr>
              <tr>
                <td style="padding:8px 12px;border:1px solid #e5e5e5;background:#f9fafb;font-weight:600">Kurir</td>
                <td style="padding:8px 12px;border:1px solid #e5e5e5">${courier}</td>
              </tr>
              <tr>
                <td style="padding:8px 12px;border:1px solid #e5e5e5;background:#f9fafb;font-weight:600">No. Resi</td>
                <td style="padding:8px 12px;border:1px solid #e5e5e5;font-family:monospace">${awb}</td>
              </tr>
            </table>

            <p style="color:#444;font-size:14px;font-weight:600;margin:0 0 8px">Detail Produk</p>
            <table style="width:100%;border-collapse:collapse;margin:0 0 24px">
              <thead>
                <tr style="background:#f9fafb">
                  <th style="padding:6px 10px;border:1px solid #e5e5e5;font-size:11px;text-transform:uppercase;text-align:left">Produk</th>
                  <th style="padding:6px 10px;border:1px solid #e5e5e5;font-size:11px;text-transform:uppercase;text-align:center">Qty</th>
                  <th style="padding:6px 10px;border:1px solid #e5e5e5;font-size:11px;text-transform:uppercase;text-align:center">Ukuran</th>
                  <th style="padding:6px 10px;border:1px solid #e5e5e5;font-size:11px;text-transform:uppercase;text-align:center">Warna</th>
                </tr>
              </thead>
              <tbody>${itemRows}</tbody>
            </table>

            <p style="color:#888;font-size:12px;margin:0">Terima kasih telah berbelanja di UKM Kemasan.</p>
          </div>
        `,
      }).catch(err => console.error('[ScanResi] Gagal kirim email:', err.message));
    }

    res.json({ success: true, data: updatedOrder });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
