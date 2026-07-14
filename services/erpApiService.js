const https = require('https');
const http = require('http');

function fetchOrderDetails(erpOrderId) {
  return new Promise((resolve, reject) => {
    const baseUrl = process.env.ERP_API_BASE_URL || '';
    const apiKey = process.env.ERP_API_KEY || '';

    if (!baseUrl) {
      return reject(new Error('ERP_API_BASE_URL not configured'));
    }

    const url = new URL(`/api/orders/${erpOrderId}`, baseUrl);
    const lib = url.protocol === 'https:' ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error('Invalid JSON from ERP API'));
          }
        } else {
          reject(new Error(`ERP API responded with ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('ERP API request timed out')); });
    req.end();
  });
}

module.exports = { fetchOrderDetails };
