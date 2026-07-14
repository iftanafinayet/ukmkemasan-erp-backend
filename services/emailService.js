const { BrevoClient } = require('@getbrevo/brevo');

const FROM = {
  email: process.env.BREVO_SENDER_EMAIL || 'iftanafinayet@gmail.com',
  name: process.env.BREVO_SENDER_NAME || 'UKM Kemasan',
};

function getClient() {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new BrevoClient({ apiKey, timeoutInSeconds: 30 });
}

async function sendEmail({ to, subject, html }) {
  const brevo = getClient();
  if (!brevo) {
    console.warn('[EmailService] BREVO_API_KEY belum dikonfigurasi.');
    return null;
  }
  try {
    const result = await brevo.transactionalEmails.sendTransacEmail({
      subject,
      htmlContent: html,
      sender: FROM,
      to: [{ email: to }],
    });
    console.log(`[EmailService] Email terkirim ke ${to}: ${result.messageId}`);
    return result;
  } catch (err) {
    const msg = err.message;
    console.error(`[EmailService] Brevo error ke ${to}:`, msg);
    throw err;
  }
}

async function sendOtpEmail(to, code) {
  return sendEmail({
    to,
    subject: 'Kode Verifikasi - UKM Kemasan',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;border:1px solid #e0e0e0;border-radius:12px">
        <h2 style="color:#0f766e;margin:0 0 8px">UKM Kemasan</h2>
        <p style="color:#444;font-size:15px;margin:0 0 24px">Gunakan kode OTP berikut untuk verifikasi akun Anda:</p>
        <div style="background:#f0fdfa;border:2px dashed #0f766e;border-radius:10px;padding:20px;text-align:center;margin:0 0 24px">
          <span style="font-size:32px;font-weight:700;letter-spacing:12px;color:#0f766e;font-family:monospace">${code}</span>
        </div>
        <p style="color:#888;font-size:12px;margin:0">Kode berlaku 5 menit. Abaikan email ini jika Anda tidak meminta verifikasi.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0 0">
        <p style="color:#aaa;font-size:11px;margin:8px 0 0">UKM Kemasan - Solusi Packaging UMKM</p>
      </div>
    `,
  });
}

module.exports = { sendEmail, sendOtpEmail };
