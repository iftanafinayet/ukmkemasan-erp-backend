const Invoice = require('../models/Invoice');
const Order = require('../models/Order');
const PaymentReceived = require('../models/PaymentReceived');
const Product = require('../models/Product');
const SalesReturn = require('../models/SalesReturn');
const StockCard = require('../models/StockCard');
const Warehouse = require('../models/Warehouse');

const SALES_INVOICE_PREFIX = 'INV';
const SALES_PAYMENT_PREFIX = 'PAY';
const SALES_RETURN_PREFIX = 'RET';

const getUnitPriceFromOrder = (order) => {
  const quantity = Number(order?.details?.quantity) || 0;
  if (!quantity) return 0;

  const storedUnitPrice = Number(order?.details?.unitPrice);
  if (Number.isFinite(storedUnitPrice) && storedUnitPrice > 0) {
    return storedUnitPrice;
  }

  return Number(order?.totalPrice || 0) / quantity;
};

const resolveInvoiceStatus = (invoice) => {
  const totalAmount = Number(invoice?.totalAmount) || 0;
  const paidAmount = Number(invoice?.paidAmount) || 0;

  if (totalAmount > 0 && paidAmount >= totalAmount) {
    return 'Paid';
  }

  if (paidAmount > 0) {
    return 'Partially Paid';
  }

  const dueDate = invoice?.dueDate ? new Date(invoice.dueDate) : null;
  if (dueDate && dueDate.getTime() < Date.now()) {
    return 'Overdue';
  }

  return invoice?.status === 'Draft' ? 'Draft' : 'Issued';
};

const syncInvoiceStatus = async (invoice) => {
  if (!invoice) return null;

  const nextStatus = resolveInvoiceStatus(invoice);
  if (invoice.status !== nextStatus) {
    invoice.status = nextStatus;
    await invoice.save();
  }

  return invoice;
};

const generateDocumentNumber = async (Model, prefix) => {
  const count = await Model.countDocuments();
  return `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
};

const parseOptionalDate = (value, fallback) => {
  if (!value) return fallback;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

const syncOrderCommercialStatus = async (orderId) => {
  const [order, invoice] = await Promise.all([
    Order.findById(orderId),
    Invoice.findOne({ order: orderId })
  ]);

  if (!order) return null;

  if (invoice) {
    order.isPaid = Number(invoice.paidAmount || 0) >= Number(invoice.totalAmount || 0) && Number(invoice.totalAmount || 0) > 0;
    if (order.status === 'Quotation') {
      order.status = 'Payment';
    }
  } else {
    order.isPaid = false;
  }

  await order.save();
  return order;
};

const populateInvoiceQuery = (query) => query
  .populate('order', 'orderNumber status totalPrice details.quantity')
  .populate('customer', 'name email phone')
  .populate('product', 'name sku category');

const populatePaymentQuery = (query) => query
  .populate('invoice', 'invoiceNumber totalAmount paidAmount status dueDate')
  .populate('order', 'orderNumber status')
  .populate('customer', 'name email phone');

const populateReturnQuery = (query) => query
  .populate('invoice', 'invoiceNumber')
  .populate('order', 'orderNumber status')
  .populate('customer', 'name email phone')
  .populate('product', 'name sku category')
  .populate('warehouse', 'name type');

const buildProcessingRows = ({ orders, invoices, returns }) => {
  const invoiceByOrderId = new Map();
  const returnsByOrderId = new Map();

  invoices.forEach((invoice) => {
    const orderId = String(invoice.order?._id || invoice.order);
    invoiceByOrderId.set(orderId, invoice);
  });

  returns.forEach((entry) => {
    const orderId = String(entry.order?._id || entry.order);
    const bucket = returnsByOrderId.get(orderId) || [];
    bucket.push(entry);
    returnsByOrderId.set(orderId, bucket);
  });

  return orders.map((order) => {
    const orderId = String(order._id);
    const invoice = invoiceByOrderId.get(orderId) || null;
    const orderReturns = returnsByOrderId.get(orderId) || [];
    const returnQuantity = orderReturns.reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0);
    const returnAmount = orderReturns.reduce((sum, entry) => sum + (Number(entry.totalAmount) || 0), 0);
    const totalAmount = Number(invoice?.totalAmount || order.totalPrice || 0);
    const paymentTotal = Number(invoice?.paidAmount || 0);

    return {
      ...order.toObject(),
      invoice,
      paymentCount: invoice && paymentTotal > 0 ? 1 : 0,
      paymentTotal,
      outstandingAmount: Math.max(totalAmount - paymentTotal, 0),
      returnQuantity,
      returnAmount,
      commercialStatus: invoice ? invoice.status : 'Waiting Invoice'
    };
  });
};

// @desc    Get sales overview for operational menus
// @route   GET /api/sales/overview
exports.getSalesOverview = async (req, res) => {
  try {
    const [orders, invoices, payments, returns, warehouses] = await Promise.all([
      Order.find({})
        .populate('customer', 'name email phone')
        .populate('product', 'name sku category material')
        .sort({ createdAt: -1 }),
      populateInvoiceQuery(Invoice.find({}).sort({ issuedDate: -1, createdAt: -1 })),
      populatePaymentQuery(PaymentReceived.find({}).sort({ paymentDate: -1, createdAt: -1 })),
      populateReturnQuery(SalesReturn.find({}).sort({ returnDate: -1, createdAt: -1 })),
      Warehouse.find({ isActive: true }).sort({ type: 1, name: 1 })
    ]);

    await Promise.all(invoices.map((invoice) => syncInvoiceStatus(invoice)));

    const processing = buildProcessingRows({ orders, invoices, returns });
    const summary = {
      totalOrders: processing.length,
      readyToInvoice: processing.filter((item) => !item.invoice).length,
      outstandingInvoices: invoices.filter((invoice) => invoice.status !== 'Paid').length,
      totalReceivable: invoices.reduce((sum, invoice) => (
        sum + Math.max((Number(invoice.totalAmount) || 0) - (Number(invoice.paidAmount) || 0), 0)
      ), 0),
      totalPayments: payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0),
      totalReturns: returns.reduce((sum, entry) => sum + (Number(entry.totalAmount) || 0), 0)
    };

    res.json({
      processing,
      invoices,
      payments,
      returns,
      warehouses,
      summary
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all invoices
// @route   GET /api/sales/invoices
exports.getInvoices = async (req, res) => {
  try {
    const invoices = await populateInvoiceQuery(
      Invoice.find({}).sort({ issuedDate: -1, createdAt: -1 })
    );

    await Promise.all(invoices.map((invoice) => syncInvoiceStatus(invoice)));
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create invoice from sales order
// @route   POST /api/sales/invoices
exports.createInvoice = async (req, res) => {
  try {
    const { orderId, dueDate, notes = '' } = req.body;

    const order = await Order.findById(orderId)
      .populate('customer', 'name email phone')
      .populate('product', 'name sku category');

    if (!order) {
      return res.status(404).json({ message: 'Order tidak ditemukan' });
    }

    const existingInvoice = await Invoice.findOne({ order: order._id });
    if (existingInvoice) {
      return res.status(400).json({ message: 'Invoice untuk order ini sudah ada' });
    }

    const quantity = Number(order?.details?.quantity) || 0;
    const unitPrice = getUnitPriceFromOrder(order);
    const totalAmount = Number(order?.totalPrice || quantity * unitPrice);

    if (!quantity || !Number.isFinite(unitPrice) || !Number.isFinite(totalAmount)) {
      return res.status(400).json({ message: 'Data order belum siap untuk diterbitkan sebagai invoice' });
    }

    const issuedDate = new Date();
    const fallbackDueDate = new Date(issuedDate);
    fallbackDueDate.setDate(fallbackDueDate.getDate() + 14);
    const resolvedDueDate = parseOptionalDate(dueDate, fallbackDueDate);

    if (!resolvedDueDate) {
      return res.status(400).json({ message: 'Tanggal jatuh tempo tidak valid' });
    }

    const invoice = await Invoice.create({
      invoiceNumber: await generateDocumentNumber(Invoice, SALES_INVOICE_PREFIX),
      order: order._id,
      customer: order.customer?._id || order.customer,
      product: order.product?._id || order.product,
      issuedDate,
      dueDate: resolvedDueDate,
      quantity,
      unitPrice,
      subtotal: totalAmount,
      totalAmount,
      notes: notes?.trim?.() || '',
      createdBy: req.user?._id
    });

    if (order.status === 'Quotation') {
      order.status = 'Payment';
      await order.save();
    }

    const createdInvoice = await populateInvoiceQuery(
      Invoice.findById(invoice._id)
    );

    res.status(201).json(createdInvoice);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get all payment receipts
// @route   GET /api/sales/payments
exports.getPayments = async (req, res) => {
  try {
    const payments = await populatePaymentQuery(
      PaymentReceived.find({}).sort({ paymentDate: -1, createdAt: -1 })
    );

    res.json(payments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create payment receipt
// @route   POST /api/sales/payments
exports.createPayment = async (req, res) => {
  try {
    const {
      invoiceId,
      amount,
      paymentDate,
      method = 'Bank Transfer',
      referenceNo = '',
      notes = ''
    } = req.body;

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice tidak ditemukan' });
    }

    await syncInvoiceStatus(invoice);

    const paymentAmount = Number(amount);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ message: 'Jumlah pembayaran harus lebih besar dari 0' });
    }

    const outstandingAmount = Math.max((Number(invoice.totalAmount) || 0) - (Number(invoice.paidAmount) || 0), 0);
    if (!outstandingAmount) {
      return res.status(400).json({ message: 'Invoice ini sudah lunas' });
    }

    if (paymentAmount > outstandingAmount) {
      return res.status(400).json({
        message: `Jumlah pembayaran melebihi sisa tagihan ${outstandingAmount}`
      });
    }

    const resolvedPaymentDate = parseOptionalDate(paymentDate, new Date());
    if (!resolvedPaymentDate) {
      return res.status(400).json({ message: 'Tanggal pembayaran tidak valid' });
    }

    const payment = await PaymentReceived.create({
      paymentNumber: await generateDocumentNumber(PaymentReceived, SALES_PAYMENT_PREFIX),
      invoice: invoice._id,
      order: invoice.order,
      customer: invoice.customer,
      amount: paymentAmount,
      paymentDate: resolvedPaymentDate,
      method,
      referenceNo: referenceNo?.trim?.() || '',
      notes: notes?.trim?.() || '',
      receivedBy: req.user?._id
    });

    invoice.paidAmount = (Number(invoice.paidAmount) || 0) + paymentAmount;
    invoice.status = resolveInvoiceStatus(invoice);
    await invoice.save();
    await syncOrderCommercialStatus(invoice.order);

    const createdPayment = await populatePaymentQuery(
      PaymentReceived.findById(payment._id)
    );

    res.status(201).json(createdPayment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get all sales returns
// @route   GET /api/sales/returns
exports.getSalesReturns = async (req, res) => {
  try {
    const returns = await populateReturnQuery(
      SalesReturn.find({}).sort({ returnDate: -1, createdAt: -1 })
    );

    res.json(returns);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create sales return and optionally return stock
// @route   POST /api/sales/returns
exports.createSalesReturn = async (req, res) => {
  try {
    const {
      orderId,
      invoiceId,
      warehouseId,
      quantity,
      reason,
      notes = '',
      returnDate,
      restocked = true
    } = req.body;

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ message: 'Jumlah retur harus lebih besar dari 0' });
    }

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ message: 'Alasan retur wajib diisi' });
    }

    const [order, invoice, selectedWarehouse] = await Promise.all([
      Order.findById(orderId),
      invoiceId ? Invoice.findById(invoiceId) : Promise.resolve(null),
      warehouseId ? Warehouse.findById(warehouseId) : Promise.resolve(null)
    ]);

    if (!order) {
      return res.status(404).json({ message: 'Order tidak ditemukan' });
    }

    if (invoiceId && !invoice) {
      return res.status(404).json({ message: 'Invoice tidak ditemukan' });
    }

    if (warehouseId && !selectedWarehouse) {
      return res.status(404).json({ message: 'Gudang tidak ditemukan' });
    }

    if (selectedWarehouse?.isActive === false) {
      return res.status(400).json({ message: 'Gudang nonaktif tidak dapat dipakai untuk retur' });
    }

    const product = await Product.findById(order.product);
    if (!product) {
      return res.status(404).json({ message: 'Produk pada order tidak ditemukan' });
    }

    const existingReturns = await SalesReturn.find({ order: order._id });
    const totalReturnedQuantity = existingReturns.reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0);
    const orderedQuantity = Number(order?.details?.quantity) || 0;
    const remainingReturnableQuantity = Math.max(orderedQuantity - totalReturnedQuantity, 0);

    if (qty > remainingReturnableQuantity) {
      return res.status(400).json({
        message: `Maksimal retur yang masih bisa diproses adalah ${remainingReturnableQuantity} pcs`
      });
    }

    const unitPrice = Number(invoice?.unitPrice || getUnitPriceFromOrder(order) || 0);
    const totalAmount = qty * unitPrice;
    const resolvedReturnDate = parseOptionalDate(returnDate, new Date());

    if (!resolvedReturnDate) {
      return res.status(400).json({ message: 'Tanggal retur tidak valid' });
    }

    let warehouse = selectedWarehouse;
    if (restocked && !warehouse) {
      warehouse = await Warehouse.findOne({ type: 'Main', isActive: true }).sort({ createdAt: 1 });
    }

    const salesReturn = await SalesReturn.create({
      returnNumber: await generateDocumentNumber(SalesReturn, SALES_RETURN_PREFIX),
      order: order._id,
      invoice: invoice?._id,
      customer: order.customer,
      product: product._id,
      warehouse: warehouse?._id,
      quantity: qty,
      unitPrice,
      totalAmount,
      reason: reason.trim(),
      notes: notes?.trim?.() || '',
      returnDate: resolvedReturnDate,
      restocked: Boolean(restocked),
      createdBy: req.user?._id
    });

    if (Boolean(restocked)) {
      product.stockPolos = (Number(product.stockPolos) || 0) + qty;
      await product.save();

      await StockCard.create({
        product: product._id,
        warehouse: warehouse?._id,
        referenceType: 'Return',
        referenceId: salesReturn._id,
        referenceNo: salesReturn.returnNumber,
        quantityChange: qty,
        balanceAfter: product.stockPolos,
        note: `Retur penjualan ${salesReturn.returnNumber}: ${reason.trim()}`
      });
    }

    const createdReturn = await populateReturnQuery(
      SalesReturn.findById(salesReturn._id)
    );

    res.status(201).json(createdReturn);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
