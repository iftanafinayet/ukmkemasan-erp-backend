const crypto = require('crypto');
const Invoice = require('../models/Invoice');
const Order = require('../models/Order');
const PaymentReceived = require('../models/PaymentReceived');

const MIDTRANS_API_BASE = 'https://api.midtrans.com';
const MIDTRANS_SANDBOX_API_BASE = 'https://api.sandbox.midtrans.com';
const DEFAULT_FRONTEND_URL = 'https://ukmkemasan-erp-frontend.vercel.app';

const getMidtransConfig = () => {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  const clientKey = process.env.MIDTRANS_CLIENT_KEY;
  const isProduction = String(process.env.MIDTRANS_IS_PRODUCTION || '').toLowerCase() === 'true';
  const frontendUrl = process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL;

  return {
    serverKey,
    clientKey,
    isProduction,
    apiBaseUrl: isProduction ? MIDTRANS_API_BASE : MIDTRANS_SANDBOX_API_BASE,
    frontendUrl,
  };
};

const buildMidtransAuthHeader = (serverKey) => (
  `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`
);

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

const generateDocumentNumber = async (Model, prefix) => {
  const count = await Model.countDocuments();
  return `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
};

const parseInvoiceIdFromMidtransOrderId = (orderId) => {
  const match = String(orderId || '').match(/^INV-([a-f0-9]{24})-\d+$/i);
  return match ? match[1] : null;
};

const mapMidtransMethod = (paymentType) => {
  const normalized = String(paymentType || '').toLowerCase();

  if (normalized === 'bank_transfer' || normalized === 'echannel') {
    return 'Bank Transfer';
  }

  if (normalized === 'qris') {
    return 'QRIS';
  }

  return 'Other';
};

const ensureCustomerOrderAccess = async (orderId, user) => {
  const order = await Order.findById(orderId)
    .populate('customer', 'name email phone')
    .populate('product', 'name sku category');

  if (!order) {
    return { error: { status: 404, message: 'Order tidak ditemukan' } };
  }

  const isOwner = String(order.customer?._id || order.customer) === String(user?._id);
  const isAdmin = user?.role === 'admin';

  if (!isOwner && !isAdmin) {
    return { error: { status: 403, message: 'Akses ditolak untuk pembayaran order ini' } };
  }

  return { order };
};

const ensureInvoiceForOrder = async (order, userId) => {
  let invoice = await Invoice.findOne({ order: order._id });

  if (invoice) {
    return invoice;
  }

  const quantity = Number(order?.details?.quantity) || 0;
  const unitPrice = Number(order?.details?.unitPrice) || (
    quantity ? Number(order?.totalPrice || 0) / quantity : 0
  );
  const totalAmount = Number(order?.totalPrice || quantity * unitPrice || 0);

  if (!quantity || !Number.isFinite(unitPrice) || !Number.isFinite(totalAmount) || totalAmount <= 0) {
    throw new Error('Order belum siap untuk dibuatkan invoice pembayaran');
  }

  const issuedDate = new Date();
  const dueDate = new Date(issuedDate);
  dueDate.setDate(dueDate.getDate() + 14);

  invoice = await Invoice.create({
    invoiceNumber: await generateDocumentNumber(Invoice, 'INV'),
    order: order._id,
    customer: order.customer?._id || order.customer,
    product: order.product?._id || order.product,
    issuedDate,
    dueDate,
    quantity,
    unitPrice,
    subtotal: totalAmount,
    totalAmount,
    status: 'Issued',
    notes: 'Auto-generated for Midtrans checkout',
    createdBy: userId,
  });

  if (order.status === 'Quotation') {
    order.status = 'Payment';
    await order.save();
  }

  return invoice;
};

const buildPaymentSummary = async (order, invoice) => {
  const payments = await PaymentReceived.find({ invoice: invoice._id })
    .sort({ paymentDate: -1, createdAt: -1 })
    .select('paymentNumber amount paymentDate method referenceNo notes createdAt');

  const paidAmount = Number(invoice?.paidAmount || 0);
  const totalAmount = Number(invoice?.totalAmount || 0);

  return {
    order,
    invoice,
    payments,
    paymentSummary: {
      totalAmount,
      paidAmount,
      outstandingAmount: Math.max(totalAmount - paidAmount, 0),
      isPaid: totalAmount > 0 && paidAmount >= totalAmount,
    },
  };
};

const syncOrderPaymentState = async (orderId, invoice) => {
  const order = await Order.findById(orderId);
  if (!order) {
    return null;
  }

  const totalAmount = Number(invoice?.totalAmount || 0);
  const paidAmount = Number(invoice?.paidAmount || 0);

  order.isPaid = totalAmount > 0 && paidAmount >= totalAmount;
  if (order.status === 'Quotation') {
    order.status = 'Payment';
  }

  await order.save();
  return order;
};

const requestMidtransSnapToken = async (payload) => {
  const { serverKey, apiBaseUrl } = getMidtransConfig();

  if (!serverKey) {
    const error = new Error('MIDTRANS_SERVER_KEY belum dikonfigurasi');
    error.statusCode = 500;
    throw error;
  }

  const response = await fetch(`${apiBaseUrl}/snap/v1/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: buildMidtransAuthHeader(serverKey),
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error_messages?.[0] || data.status_message || 'Gagal membuat Midtrans transaction');
    error.statusCode = 400;
    throw error;
  }

  return data;
};

exports.getOrderPaymentSummary = async (req, res) => {
  try {
    const { order, error } = await ensureCustomerOrderAccess(req.params.orderId, req.user);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const invoice = await ensureInvoiceForOrder(order, req.user?._id);
    invoice.status = resolveInvoiceStatus(invoice);
    await invoice.save();

    const summary = await buildPaymentSummary(order, invoice);

    res.json({
      ...summary,
      midtrans: {
        clientKeyConfigured: Boolean(getMidtransConfig().clientKey),
        clientKey: getMidtransConfig().clientKey || '',
        isProduction: getMidtransConfig().isProduction,
      },
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({ message: error.message });
  }
};

exports.createMidtransSnapToken = async (req, res) => {
  try {
    const { order, error } = await ensureCustomerOrderAccess(req.params.orderId, req.user);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const invoice = await ensureInvoiceForOrder(order, req.user?._id);
    invoice.status = resolveInvoiceStatus(invoice);
    await invoice.save();

    const outstandingAmount = Math.max(
      (Number(invoice.totalAmount) || 0) - (Number(invoice.paidAmount) || 0),
      0
    );

    if (!outstandingAmount) {
      return res.status(400).json({ message: 'Invoice ini sudah lunas' });
    }

    const transactionOrderId = `INV-${String(invoice._id)}-${Date.now()}`;
    const { frontendUrl } = getMidtransConfig();
    const baseFrontendUrl = frontendUrl;
    const paymentPageUrl = `${baseFrontendUrl}/portal/orders/${order._id}/payment`;

    const snapPayload = {
      transaction_details: {
        order_id: transactionOrderId,
        gross_amount: outstandingAmount,
      },
      item_details: [
        {
          id: String(order.product?._id || order.product),
          name: order.product?.name || `Order ${order.orderNumber}`,
          price: outstandingAmount,
          quantity: 1,
        },
      ],
      customer_details: {
        first_name: order.customer?.name || 'Customer',
        email: order.customer?.email || undefined,
        phone: order.customer?.phone || undefined,
      },
      custom_field1: String(invoice._id),
      custom_field2: String(order._id),
      custom_field3: order.orderNumber,
      callbacks: {
        finish: process.env.MIDTRANS_FINISH_URL || paymentPageUrl,
        pending: process.env.MIDTRANS_PENDING_URL || paymentPageUrl,
        error: process.env.MIDTRANS_ERROR_URL || paymentPageUrl,
      },
    };

    const snapResponse = await requestMidtransSnapToken(snapPayload);

    res.status(201).json({
      token: snapResponse.token,
      redirectUrl: snapResponse.redirect_url,
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      outstandingAmount,
      orderId: order._id,
      orderNumber: order.orderNumber,
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({ message: error.message });
  }
};

exports.handleMidtransWebhook = async (req, res) => {
  try {
    const { serverKey } = getMidtransConfig();

    if (!serverKey) {
      return res.status(500).json({ message: 'MIDTRANS_SERVER_KEY belum dikonfigurasi' });
    }

    const {
      order_id: midtransOrderId,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signatureKey,
      transaction_status: transactionStatus,
      fraud_status: fraudStatus,
      transaction_id: transactionId,
      payment_type: paymentType,
      settlement_time: settlementTime,
    } = req.body || {};

    const expectedSignature = crypto
      .createHash('sha512')
      .update(`${midtransOrderId}${statusCode}${grossAmount}${serverKey}`)
      .digest('hex');

    if (!signatureKey || signatureKey !== expectedSignature) {
      return res.status(401).json({ message: 'Signature Midtrans tidak valid' });
    }

    const invoiceId = parseInvoiceIdFromMidtransOrderId(midtransOrderId);
    if (!invoiceId) {
      return res.status(400).json({ message: 'order_id Midtrans tidak dikenali' });
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice tidak ditemukan untuk transaksi ini' });
    }

    const isSettled = transactionStatus === 'settlement'
      || (transactionStatus === 'capture' && fraudStatus === 'accept');

    if (isSettled) {
      const existingPayment = await PaymentReceived.findOne({ referenceNo: transactionId });
      if (!existingPayment) {
        const paymentAmount = Number(grossAmount) || 0;
        const outstandingAmount = Math.max(
          (Number(invoice.totalAmount) || 0) - (Number(invoice.paidAmount) || 0),
          0
        );
        const appliedAmount = Math.min(paymentAmount, outstandingAmount);

        if (appliedAmount > 0) {
          await PaymentReceived.create({
            paymentNumber: await generateDocumentNumber(PaymentReceived, 'PAY'),
            invoice: invoice._id,
            order: invoice.order,
            customer: invoice.customer,
            amount: appliedAmount,
            paymentDate: settlementTime ? new Date(settlementTime) : new Date(),
            method: mapMidtransMethod(paymentType),
            referenceNo: transactionId || midtransOrderId,
            notes: `Midtrans ${transactionStatus} (${paymentType || 'unknown'})`,
          });

          invoice.paidAmount = (Number(invoice.paidAmount) || 0) + appliedAmount;
        }
      }
    }

    invoice.status = resolveInvoiceStatus(invoice);
    await invoice.save();
    await syncOrderPaymentState(invoice.order, invoice);

    res.json({
      received: true,
      invoiceId: invoice._id,
      transactionStatus,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
