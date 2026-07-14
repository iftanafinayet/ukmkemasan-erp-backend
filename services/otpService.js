const crypto = require('crypto');
const User = require('../models/User');
const { sendOtpEmail } = require('./emailService');

const OTP_LENGTH = 6;
const OTP_EXPIRY_MS = 5 * 60 * 1000;
const OTP_RATE_LIMIT_MS = 60 * 1000;

function generateOtpCode() {
  return crypto.randomInt(100000, 999999).toString();
}

async function sendOtpToEmail(email) {
  const user = await User.findOne({ email });
  if (!user) {
    const err = new Error('Email belum terdaftar');
    err.code = 'USER_NOT_FOUND';
    throw err;
  }

  if (user.otpSentAt && Date.now() - user.otpSentAt.getTime() < OTP_RATE_LIMIT_MS) {
    const waitSeconds = Math.ceil((OTP_RATE_LIMIT_MS - (Date.now() - user.otpSentAt.getTime())) / 1000);
    const err = new Error(`Silakan tunggu ${waitSeconds} detik sebelum kirim ulang OTP`);
    err.code = 'RATE_LIMITED';
    throw err;
  }

  const code = generateOtpCode();
  user.otpCode = code;
  user.otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MS);
  user.otpSentAt = new Date();
  await user.save();

  await sendOtpEmail(email, code);
  return { message: 'Kode OTP telah dikirim ke email Anda' };
}

async function verifyOtp(email, code) {
  const user = await User.findOne({ email });
  if (!user) {
    const err = new Error('Email belum terdaftar');
    err.code = 'USER_NOT_FOUND';
    throw err;
  }

  if (!user.otpCode || !user.otpExpiresAt) {
    const err = new Error('Belum ada kode OTP yang dikirim. Silakan minta kode OTP terlebih dahulu');
    err.code = 'NO_OTP';
    throw err;
  }

  if (Date.now() > user.otpExpiresAt.getTime()) {
    user.otpCode = undefined;
    user.otpExpiresAt = undefined;
    await user.save();
    const err = new Error('Kode OTP sudah kadaluarsa. Silakan minta kode baru');
    err.code = 'OTP_EXPIRED';
    throw err;
  }

  if (user.otpCode !== String(code).trim()) {
    const err = new Error('Kode OTP tidak valid');
    err.code = 'INVALID_OTP';
    throw err;
  }

  user.isEmailVerified = true;
  user.otpCode = undefined;
  user.otpExpiresAt = undefined;
  user.otpSentAt = undefined;
  await user.save();

  return { message: 'Email berhasil diverifikasi', isEmailVerified: true };
}

module.exports = { sendOtpToEmail, verifyOtp, generateOtpCode };
