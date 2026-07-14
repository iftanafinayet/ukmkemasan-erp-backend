const RAW_BASE_URL =
  process.env.KOMSHIP_BASE_URL || 'https://api-sandbox.collaborator.komerce.id';

// Ambil origin saja (protocol + host). Mencegah path nyasar di env, mis.
// ".../user/api/v1/webhook/..." yang bikin semua endpoint jadi 404 (HTML).
function normalizeBaseUrl(value) {
  try {
    return new URL(value).origin;
  } catch {
    return String(value).replace(/\/+$/, '');
  }
}

module.exports = {
  baseUrl: normalizeBaseUrl(RAW_BASE_URL),
  apiKey: process.env.KOMSHIP_API_KEY || '',
  isConfigured: () => Boolean(process.env.KOMSHIP_API_KEY),
  labelPage: process.env.KOMSHIP_LABEL_PAGE || 'page_5',
};
