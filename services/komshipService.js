const https = require('https');
const http = require('http');
const komship = require('../config/komship');

class KomshipError extends Error {
  constructor(message, { code, httpStatus, raw } = {}) {
    super(message);
    this.name = 'KomshipError';
    this.code = code; // e.g. 'INSUFFICIENT_BALANCE', 'NOT_CONFIGURED', 'TIMEOUT', 'HTTP_400'
    this.httpStatus = httpStatus;
    this.raw = raw;
  }
}

function request({ method = 'GET', path, query, body }) {
  return new Promise((resolve, reject) => {
    if (!komship.apiKey) {
      return reject(new KomshipError('KOMSHIP_API_KEY belum dikonfigurasi', { code: 'NOT_CONFIGURED' }));
    }

    const url = new URL(komship.baseUrl + path);
    if (query) {
      Object.entries(query).forEach(([k, v]) => {
        if (v !== undefined && v !== null) url.searchParams.append(k, v);
      });
    }

    const payload = body ? JSON.stringify(body) : null;
    const lib = url.protocol === 'https:' ? https : http;

    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'x-api-key': komship.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Encoding': 'identity',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json;
        try {
          json = data ? JSON.parse(data) : {};
        } catch {
          const snippet = String(data).replace(/\s+/g, ' ').trim().slice(0, 200);
          const looksHtml = /^\s*<(!doctype|html)/i.test(data);
          console.error(`[Komship] Non-JSON response ${res.statusCode} from ${options.path} :: ${snippet}`);
          const hint = looksHtml
            ? 'endpoint/base URL mungkin salah atau API key tidak valid'
            : 'periksa konfigurasi KOMSHIP_BASE_URL & KOMSHIP_API_KEY';
          return reject(new KomshipError(
            `Komship mengembalikan respons non-JSON (HTTP ${res.statusCode || '-'}, ${hint}): ${snippet || '<kosong>'}`,
            { code: `HTTP_${res.statusCode || 'ERR'}`, httpStatus: res.statusCode || 502, raw: data }
          ));
        }

        const meta = json.meta || {};
        const ok = res.statusCode >= 200 && res.statusCode < 300
          && meta.status !== 'failed' && meta.status !== 'error';

        if (ok) return resolve(json);

        const msg = meta.message || (json.data && json.data.errors) || `Komship error ${res.statusCode}`;
        const isBalance = /saldo|balance|insufficient/i.test(String(msg));
        console.error(`[Komship] Error ${res.statusCode} from ${options.path} :: ${JSON.stringify(msg)}`);
        reject(new KomshipError(msg, {
          code: isBalance ? 'INSUFFICIENT_BALANCE' : `HTTP_${res.statusCode}`,
          httpStatus: res.statusCode,
          raw: json,
        }));
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new KomshipError('Request Komship timeout', { code: 'TIMEOUT' }));
    });

    if (payload) req.write(payload);
    req.end();
  });
}

const normalizePhone = (p = '') => String(p).replace(/[\s-]/g, '').replace(/^\+62/, '62');
const gramToKg = (g) => Math.max(0.1, (Number(g) || 0) / 1000);
const buildLabelUrl = (path) => (path ? `${komship.baseUrl}/order${path}` : '');

module.exports = {
  KomshipError,
  normalizePhone,
  gramToKg,
  buildLabelUrl,

  searchDestination: (keyword) =>
    request({ path: '/tariff/api/v1/destination/search', query: { keyword } }).then((r) => r.data),

  calculatePrice: ({ shipperId, receiverId, weightKg, itemValue, originPin, destPin, cod = 'no' }) =>
    request({
      path: '/tariff/api/v1/calculate',
      query: {
        shipper_destination_id: shipperId,
        receiver_destination_id: receiverId,
        weight: weightKg,
        item_value: itemValue,
        cod,
        origin_pin_point: originPin,
        destination_pin_point: destPin,
      },
    }).then((r) => r.data),

  storeOrder: (payload) =>
    request({ method: 'POST', path: '/order/api/v1/orders/store', body: payload }).then((r) => r.data),

  requestPickup: ({ pickupDate, pickupTime, vehicle, orderNos }) =>
    request({
      method: 'POST',
      path: '/order/api/v1/pickup/request',
      body: {
        pickup_date: pickupDate,
        pickup_time: pickupTime,
        pickup_vehicle: vehicle,
        orders: orderNos.map((order_no) => ({ order_no })),
      },
    }).then((r) => r.data),

  printLabel: ({ orderNos, page = komship.labelPage }) =>
    request({
      method: 'POST',
      path: '/order/api/v1/orders/print-label',
      query: { page, order_no: orderNos.join(',') },
    }).then((r) => r.data),

  getDetail: (orderNo) =>
    request({ path: '/order/api/v1/orders/detail', query: { order_no: orderNo } }).then((r) => r.data),

  historyAWB: ({ shipping, awb }) =>
    request({
      path: '/order/api/v1/orders/history-airway-bill',
      query: { shipping, airway_bill: awb },
    }).then((r) => r.data),

  cancelOrder: (orderNo) =>
    request({ method: 'PUT', path: '/order/api/v1/orders/cancel', body: { order_no: orderNo } }),
};
