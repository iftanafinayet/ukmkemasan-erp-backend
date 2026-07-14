const https = require('https');

const escMd = (str) => String(str || '').replace(/[_*[\]()`~>#+\-=|{}.!]/g, '\\$&');

function getOrderLines(order) {
  if (order.items && order.items.length > 0) {
    return order.items.map((item, idx) => {
      const name = escMd(item.product?.name || item.sku || `Item ${idx + 1}`);
      const qty = item.quantity || 0;
      const sz = escMd(item.size || '');
      const clr = escMd(item.color || '');
      const valve = item.useValve ? ' (Valve)' : '';
      const unitPrice = item.unitPrice || 0;
      const lineTotal = item.subtotal || (qty * unitPrice);
      return `${idx + 1}\\. ${name}${valve}\n${qty.toLocaleString('id-ID')} pcs${sz ? ` | ${sz}` : ''}${clr ? ` / ${clr}` : ''}\nRp ${lineTotal.toLocaleString('id-ID')}`;
    }).join('\n\n');
  }

  const name = escMd(order.product?.name || '-');
  const qty = order.details?.quantity || 0;
  const sz = escMd(order.details?.size || '');
  const clr = escMd(order.details?.color || '');
  return `1\\. ${name}\n${qty.toLocaleString('id-ID')} pcs${sz ? ` | ${sz}` : ''}${clr ? ` / ${clr}` : ''}`;
}

function sendTelegramAlert(task, order) {
  return new Promise((resolve, reject) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      return reject(new Error('TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured'));
    }

    const customerName = order.customer?.name || order.customer?.email || '-';
    const customerPhone = order.customer?.phone || '-';
    const customerEmail = order.customer?.email || '-';
    const customerAddress = order.customer?.address || '-';
    const shippingRecipient = order.shipping?.recipient;
    const shippingAddress = shippingRecipient?.address
      ? `${shippingRecipient.name || '-'}, ${shippingRecipient.phone || '-'}\n  ${shippingRecipient.address}`
      : '-';
    const courierParts = [order.shipping?.courierCode, order.shipping?.courierService].filter(Boolean);
    const courier = courierParts.length > 0 ? courierParts.join(' - ') : '-';
    const totalPrice = order.totalPrice ? `Rp ${order.totalPrice.toLocaleString('id-ID')}` : '-';
    const paid = order.isPaid ? '✅ Paid' : '❌ Unpaid';
    const brandingStatus = order.branding?.status || '-';
    const itemCount = order.items?.length || 1;
    const lines = getOrderLines(order);

    const message = [
      `🔔 *Production Task ${task.taskNumber}*`,
      ``,
      `📋 *Order:* ${order.orderNumber}`,
      `📊 *Status:* ${order.status} | ${paid}`,

      ``,
      `👤 *Customer*`,
      `  Name: ${customerName}`,
      `  Phone: ${customerPhone}`,
      `  Email: ${customerEmail}`,
      `  Address: ${customerAddress}`,
      ``,
      `📍 *Shipping Address*`,
      `  ${shippingAddress}`,
      ``,
      `🚚 *Ekspedisi*`,
      `  ${courier}`,
      ``,
      `📦 *Items (${itemCount})*`,
      lines,
      ``,
      `💰 *Total:* ${totalPrice}`,
      `🎨 *Design:* ${brandingStatus}`,
      ``,
      `🔗 *Task:* ${task.taskNumber} | ${task.status}`
    ].join('\n');

    const payload = JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown'
    });

    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${botToken}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Telegram API responded with ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Telegram request timed out')); });
    req.write(payload);
    req.end();
  });
}

function sendTelegramRaw(message) {
  return new Promise((resolve, reject) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      return reject(new Error('Telegram not configured'));
    }

    const payload = JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown'
    });

    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${botToken}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) resolve(JSON.parse(data));
        else reject(new Error(`Telegram API: ${res.statusCode}`));
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(payload);
    req.end();
  });
}

module.exports = { sendTelegramAlert, sendTelegramRaw };
