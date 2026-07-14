const https = require('https');
const http = require('http');
const cost = require('../config/rajaongkirCost');

class RajaOngkirError extends Error {
  constructor(message, { code, httpStatus, raw } = {}) {
    super(message);
    this.name = 'RajaOngkirError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.raw = raw;
  }
}

function request({ method = 'GET', path, query, form }) {
  return new Promise((resolve, reject) => {
    if (!cost.apiKey) {
      return reject(new RajaOngkirError('API key Shipping Cost belum dikonfigurasi', { code: 'NOT_CONFIGURED' }));
    }

    const url = new URL(cost.baseUrl + path);
    if (query) {
      Object.entries(query).forEach(([k, v]) => {
        if (v !== undefined && v !== null) url.searchParams.append(k, v);
      });
    }

    const payload = form ? new URLSearchParams(form).toString() : null;
    const lib = url.protocol === 'https:' ? https : http;

    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        key: cost.apiKey,
        Accept: 'application/json',
        'Accept-Encoding': 'identity',
        ...(payload ? {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(payload),
        } : {}),
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
          console.error(`[RajaOngkirCost] Non-JSON ${res.statusCode} from ${options.path} :: ${snippet}`);
          return reject(new RajaOngkirError(
            `RajaOngkir mengembalikan respons non-JSON (HTTP ${res.statusCode || '-'}): ${snippet || '<kosong>'}`,
            { code: `HTTP_${res.statusCode || 'ERR'}`, httpStatus: res.statusCode || 502, raw: data }
          ));
        }

        const meta = json.meta || {};
        const ok = res.statusCode >= 200 && res.statusCode < 300 && meta.status === 'success';
        if (ok) return resolve(json);

        const msg = meta.message || `RajaOngkir error ${res.statusCode}`;
        console.error(`[RajaOngkirCost] Error ${res.statusCode} from ${options.path} :: ${JSON.stringify(msg)}`);
        reject(new RajaOngkirError(msg, { code: `HTTP_${res.statusCode}`, httpStatus: res.statusCode, raw: json }));
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new RajaOngkirError('Request RajaOngkir timeout', { code: 'TIMEOUT' })); });
    if (payload) req.write(payload);
    req.end();
  });
}

module.exports = {
  RajaOngkirError,

  // Direct Search Method — GET /destination/domestic-destination
  searchDestination: (keyword, limit = 10) =>
    request({
      path: '/destination/domestic-destination',
      query: { search: keyword, limit, offset: 0 },
    }).then((r) => r.data || []),

  // POST /calculate/domestic-cost (x-www-form-urlencoded)
  // Hanya menampilkan ongkir untuk barang (kargo), bukan motor/dokumen/instant.
  calculateDomesticCost: ({ origin, destination, weightGram, couriers = cost.couriers, price }) =>
    request({
      method: 'POST',
      path: '/calculate/domestic-cost',
      form: {
        origin,
        destination,
        weight: Math.max(1, Math.round(Number(weightGram) || 0)),
        courier: couriers,
        ...(price ? { price } : {}),
      },
    }).then((r) => {
      const rows = r.data || [];
      const w = Math.round(Number(weightGram) || 0);
      const motorDocKeywords = ['motor', 'instant', 'same_day', 'sameday', 'dokumen', 'document', 'gosend', 'grab', 'paxel_instant'];
      const cargoKeywords = ['jtr', 'ctc', 'cargo', 'kargo', 'trucking', 'kgo', 'darat'];

      let filtered = rows.filter((item) => {
        const combined = `${item.service || ''} ${item.name || ''} ${item.description || ''}`.toLowerCase();
        return !motorDocKeywords.some((kw) => combined.includes(kw));
      });

      if (w < 1000) {
        filtered = filtered.filter((item) => {
          const combined = `${item.service || ''} ${item.name || ''} ${item.description || ''}`.toLowerCase();
          return !cargoKeywords.some((kw) => combined.includes(kw));
        });

        if (filtered.length > 2) {
          const sorted = [...filtered].sort((a, b) => (a.cost || 0) - (b.cost || 0));
          const median = sorted[Math.floor(sorted.length / 2)].cost || 0;
          const threshold = Math.max(median * 2.5, 15000);
          filtered = filtered.filter((item) => (item.cost || 0) <= threshold);
        }
      }

      return filtered.map((item) => {
        let etdDesc = (item.etd || '').toUpperCase().replace(/HARI/gi, '').trim();
        if (!etdDesc) {
          etdDesc = '';
        } else if (/-/.test(etdDesc)) {
          etdDesc = etdDesc.replace(/\s+/g, '').replace(/-/g, '–') + ' hari';
        } else {
          const num = etdDesc.match(/\d+/);
          etdDesc = num ? num[0] + ' hari' : etdDesc;
        }
        return { ...item, etd: etdDesc };
      });
    }),
};
