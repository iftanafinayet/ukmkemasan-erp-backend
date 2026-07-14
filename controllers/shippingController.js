const Order = require('../models/Order');
const Settings = require('../models/Settings');
const OrderLog = require('../models/OrderLog');
const Product = require('../models/Product');
const komshipService = require('../services/komshipService');
const rajaongkirCostService = require('../services/rajaongkirCostService');
const { success, fail, error } = require('../utils/apiResponse');

// Dimensi wajib oleh API Komship, namun tidak dikelola sebagai data produk.
// Dikirim sebagai nilai tetap minimal (cm) untuk memenuhi validasi API.
const FIXED_DIMENSION = { width: 1, height: 1, length: 1 };

const CREATE_ALLOWED_STATUSES = ['Quality Control', 'Shipping', 'Completed'];
const CANCELABLE_STATUSES = ['OrderCreated', 'PickupScheduled', 'LabelGenerated'];

const writeLog = (order, action, note, user) =>
  OrderLog.create({ order: order._id, action, note, changedBy: user && user._id });

async function computeItemsWeight(items) {
  let weightGram = 0;
  for (const it of items || []) {
    const product = await Product.findById(it.productId).select('variants');
    if (!product) continue;
    const variant = it.variantId ? product.variants.id(it.variantId) : null;
    const perPcs = (variant && variant.weightGram) || 17;
    weightGram += perPcs * (Number(it.quantity) || 0);
  }
  return weightGram || 17;
}

// @desc    Cek ongkir (customer & admin) via API Shipping Cost (gratis)
exports.calculateShipping = async (req, res) => {
  try {
    const { destinationId, items, itemValue } = req.body;
    if (!destinationId) return fail(res, 'destinationId penerima wajib diisi', 422);
    if (!Array.isArray(items) || items.length === 0) return fail(res, 'items wajib diisi', 422);

    const settings = await Settings.getGlobal();
    if (!settings.originDestinationId) {
      return fail(res, 'Alamat gudang asal (origin) belum diatur oleh admin di Settings', 422);
    }

    const weightGram = await computeItemsWeight(items);
    const rows = await rajaongkirCostService.calculateDomesticCost({
      origin: settings.originDestinationId,
      destination: destinationId,
      weightGram,
    });

    const options = (rows || []).map((r) => ({
      code: r.code,
      name: r.name,
      service: r.service,
      description: r.description,
      cost: r.cost,
      etd: r.etd,
    }));

    success(res, { weightGram, options, itemValue: Number(itemValue) || 0 });
  } catch (e) {
    error(res, e.message, e.httpStatus || 500);
  }
};

// @desc    Cari destination ID (customer & admin) via API Shipping Cost
exports.searchDestinations = async (req, res) => {
  try {
    const { keyword } = req.query;
    if (!keyword) return fail(res, 'Parameter keyword wajib diisi', 400);
    const data = await rajaongkirCostService.searchDestination(keyword);
    success(res, data);
  } catch (e) {
    error(res, e.message, e.httpStatus || 500);
  }
};

function validateShippingData(order, settings) {
  const errs = [];
  if (!settings || !settings.originDestinationId) errs.push('Alamat gudang asal (origin) belum diatur di Settings');
  const recipient = (order.shipping && order.shipping.recipient) || {};
  if (!order.shipping || !order.shipping.destinationId) errs.push('destinationId penerima kosong');
  if (!recipient.name) errs.push('Nama penerima kosong');
  if (!recipient.phone) errs.push('No. telepon penerima kosong');
  if (!recipient.address) errs.push('Alamat penerima kosong');
  if (!order.shipping || !order.shipping.courierCode || !order.shipping.courierService) {
    errs.push('Kurir/layanan pengiriman belum dipilih');
  }
  return errs;
}

// @desc    Buat order pengiriman (Store Order) ke Komship
exports.createShippingOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('items.product', 'name weightGram');
    if (!order) return fail(res, 'Order tidak ditemukan', 404);

    if (!CREATE_ALLOWED_STATUSES.includes(order.status)) {
      return fail(res, `Order harus minimal berstatus Quality Control (sekarang: ${order.status})`);
    }
    if (order.shippingProvider && order.shippingProvider.orderNo) {
      return fail(res, 'Order pengiriman sudah dibuat sebelumnya', 409, {
        orderNo: order.shippingProvider.orderNo,
      });
    }

    const settings = await Settings.getGlobal();
    const errs = validateShippingData(order, settings);
    if (errs.length) return fail(res, 'Data pengiriman tidak lengkap', 422, errs);

    const orderDetails = (order.items || []).map((item) => ({
      product_name: (item.product && item.product.name) || item.sku || 'Item',
      product_variant_name: [item.size, item.color].filter(Boolean).join(' ') || '-',
      product_price: item.unitPrice,
      product_weight: (item.product && item.product.weightGram) || 17,
      product_width: FIXED_DIMENSION.width,
      product_height: FIXED_DIMENSION.height,
      product_length: FIXED_DIMENSION.length,
      qty: item.quantity,
      subtotal: item.subtotal,
    }));

    const productTotal = orderDetails.reduce((sum, d) => sum + (d.subtotal || 0), 0);
    const shippingCost = (order.shipping && order.shipping.cost) || 0;

    const payload = {
      order_date: new Date().toISOString().slice(0, 10),
      brand_name: (settings.origin && settings.origin.name) || 'UKM Kemasan',
      shipper_name: settings.origin && settings.origin.name,
      shipper_phone: komshipService.normalizePhone(settings.origin && settings.origin.phone),
      shipper_destination_id: settings.originDestinationId,
      shipper_address: settings.origin && settings.origin.address,
      shipper_email: (settings.origin && settings.origin.email) || 'admin@ukmkemasan.id',
      origin_pin_point: settings.originPinPoint || '',
      receiver_name: order.shipping.recipient.name,
      receiver_phone: komshipService.normalizePhone(order.shipping.recipient.phone),
      receiver_destination_id: order.shipping.destinationId,
      receiver_address: order.shipping.recipient.address,
      destination_pin_point: order.shipping.recipient.pinPoint || '',
      shipping: order.shipping.courierCode,
      shipping_type: order.shipping.courierService,
      payment_method: 'BANK TRANSFER',
      shipping_cost: shippingCost,
      shipping_cashback: (order.shipping && order.shipping.cashback) || 0,
      service_fee: 0,
      additional_cost: 0,
      grand_total: productTotal + shippingCost,
      cod_value: 0,
      insurance_value: 0,
      notes: `Order ${order.orderNumber}`,
      order_details: orderDetails,
    };

    const data = await komshipService.storeOrder(payload);

    const history = (order.shippingProvider && order.shippingProvider.statusHistory) || [];
    order.shippingProvider = {
      orderId: data.order_id,
      orderNo: data.order_no,
      pickupScheduled: false,
      status: 'OrderCreated',
      statusHistory: [
        ...history,
        { status: 'OrderCreated', description: 'Order pengiriman dibuat', timestamp: new Date() },
      ],
    };
    await order.save();
    await writeLog(order, 'Shipping Order Created', `orderNo: ${data.order_no}`, req.user);

    success(res, order.shippingProvider, 201);
  } catch (e) {
    if (e.code === 'INSUFFICIENT_BALANCE') {
      return fail(res, 'Saldo pengiriman tidak mencukupi', 402);
    }
    error(res, e.message, e.httpStatus || 500);
  }
};

// @desc    Jadwalkan pickup
exports.schedulePickup = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return fail(res, 'Order tidak ditemukan', 404);
    if (!order.shippingProvider || !order.shippingProvider.orderNo) {
      return fail(res, 'Buat order pengiriman terlebih dahulu');
    }
    if (order.shippingProvider.pickupScheduled) {
      return fail(res, 'Pickup sudah dijadwalkan', 409);
    }

    const { pickupDate, pickupTime, vehicle } = req.body;
    if (!pickupDate || !pickupTime) return fail(res, 'pickupDate dan pickupTime wajib diisi', 422);

    const settings = await Settings.getGlobal();
    const data = await komshipService.requestPickup({
      pickupDate,
      pickupTime,
      vehicle: vehicle || settings.defaultVehicle,
      orderNos: [order.shippingProvider.orderNo],
    });

    const result = Array.isArray(data) ? data[0] : data;
    if (!result || result.status !== 'success') {
      return fail(res, 'Pickup gagal dijadwalkan, silakan coba lagi nanti', 422, result);
    }

    order.shippingProvider.awb = result.awb;
    order.shippingProvider.pickupScheduled = true;
    order.shippingProvider.pickupDate = new Date(`${pickupDate}T${pickupTime}`);
    order.shippingProvider.status = 'PickupScheduled';
    order.shippingProvider.statusHistory.push({
      status: 'PickupScheduled',
      description: `AWB ${result.awb}`,
      timestamp: new Date(),
    });
    await order.save();
    await writeLog(order, 'Shipping Pickup Scheduled', `awb: ${result.awb}`, req.user);

    success(res, order.shippingProvider);
  } catch (e) {
    error(res, e.message, e.httpStatus || 500);
  }
};

// @desc    Generate label/resi (PDF)
exports.generateLabel = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return fail(res, 'Order tidak ditemukan', 404);
    if (!order.shippingProvider || !order.shippingProvider.orderNo) {
      return fail(res, 'Order pengiriman belum dibuat');
    }
    if (!order.shippingProvider.pickupScheduled) {
      return fail(res, 'Pickup harus dijadwalkan terlebih dahulu');
    }

    const settings = await Settings.getGlobal();
    const data = await komshipService.printLabel({
      orderNos: [order.shippingProvider.orderNo],
      page: settings.labelPageFormat,
    });

    order.shippingProvider.labelUrl = komshipService.buildLabelUrl(data.path);
    order.shippingProvider.status = 'LabelGenerated';
    order.shippingProvider.statusHistory.push({
      status: 'LabelGenerated',
      description: 'Label pengiriman dicetak',
      timestamp: new Date(),
    });
    if (order.status !== 'Shipping') order.status = 'Shipping';
    await order.save();
    await writeLog(order, 'Shipping Label Generated', order.shippingProvider.labelUrl, req.user);

    success(res, {
      labelUrl: order.shippingProvider.labelUrl,
      base64: data.base_64,
      awb: order.shippingProvider.awb,
    });
  } catch (e) {
    error(res, e.message, e.httpStatus || 500);
  }
};

// @desc    Ambil URL label yang sudah dibuat
exports.getLabel = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).select('shippingProvider customer');
    if (!order || !order.shippingProvider || !order.shippingProvider.labelUrl) {
      return fail(res, 'Label belum tersedia', 404);
    }
    const isOwner = String(order.customer) === String(req.user._id);
    if (req.user.role !== 'admin' && !isOwner) return fail(res, 'Akses ditolak', 403);
    success(res, { labelUrl: order.shippingProvider.labelUrl });
  } catch (e) {
    error(res, e.message);
  }
};

// @desc    Tracking fallback via History AWB
exports.getTracking = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).select('shipping shippingProvider customer');
    if (!order || !order.shippingProvider || !order.shippingProvider.awb) {
      return fail(res, 'AWB belum tersedia', 404);
    }
    const isOwner = String(order.customer) === String(req.user._id);
    if (req.user.role !== 'admin' && !isOwner) return fail(res, 'Akses ditolak', 403);

    const data = await komshipService.historyAWB({
      shipping: order.shipping.courierCode,
      awb: order.shippingProvider.awb,
    });
    success(res, data);
  } catch (e) {
    error(res, e.message, e.httpStatus || 500);
  }
};

// @desc    Batalkan order pengiriman (jika belum pickup)
exports.cancelShipping = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return fail(res, 'Order tidak ditemukan', 404);
    if (!order.shippingProvider || !order.shippingProvider.orderNo) {
      return fail(res, 'Tidak ada order pengiriman untuk dibatalkan');
    }
    if (!CANCELABLE_STATUSES.includes(order.shippingProvider.status)) {
      return fail(res, 'Paket sudah dalam proses pengiriman dan tidak bisa dibatalkan');
    }

    await komshipService.cancelOrder(order.shippingProvider.orderNo);

    const history = order.shippingProvider.statusHistory || [];
    history.push({ status: 'Cancelled', description: 'Order pengiriman dibatalkan', timestamp: new Date() });
    order.shippingProvider = { status: 'NotCreated', pickupScheduled: false, statusHistory: history };
    if (order.status === 'Shipping') order.status = 'Quality Control';
    await order.save();
    await writeLog(order, 'Shipping Cancelled', null, req.user);

    success(res, order.shippingProvider);
  } catch (e) {
    error(res, e.message, e.httpStatus || 500);
  }
};
