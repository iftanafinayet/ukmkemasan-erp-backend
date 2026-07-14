const RAW_BASE_URL =
  process.env.RAJAONGKIR_COST_BASE_URL || 'https://rajaongkir.komerce.id/api/v1';

function normalizeBaseUrl(value) {
  return String(value).replace(/\/+$/, '');
}

module.exports = {
  baseUrl: normalizeBaseUrl(RAW_BASE_URL),
  // API Shipping Cost pakai key sendiri; fallback ke KOMSHIP_API_KEY bila belum diisi.
  apiKey: process.env.RAJAONGKIR_COST_API_KEY || process.env.KOMSHIP_API_KEY || '',
  isConfigured: () => Boolean(process.env.RAJAONGKIR_COST_API_KEY || process.env.KOMSHIP_API_KEY),
  couriers: (process.env.RAJAONGKIR_COST_COURIERS
    || 'jne:jnt:sicepat:anteraja:pos:tiki:ninja:wahana:lion:ide:sap'),
};
