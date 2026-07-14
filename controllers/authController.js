const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { sendOtpToEmail, verifyOtp } = require('../services/otpService');

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '2h' }
  );
};

// @desc    Register user baru (email belum terverifikasi)
// @route   POST /api/auth/register
exports.registerUser = async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Harap isi semua field wajib' });
  }

  try {
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'User sudah terdaftar' });

    const user = await User.create({ name, email, password, role });

    try {
      const code = require('../services/otpService').generateOtpCode();
      user.otpCode = code;
      user.otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
      user.otpSentAt = new Date();
      await user.save();
      // Fire-and-forget — jangan block registrasi oleh SMTP (Render free plan lambat)
      require('../services/emailService').sendOtpEmail(email, code).catch((emailErr) => {
        console.error('[Auth] Gagal kirim OTP email:', emailErr.message);
      });
    } catch (err) {
      console.error('[Auth] Gagal simpan OTP:', err.message);
    }

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      message: 'Registrasi berhasil. Kode OTP telah dikirim ke email Anda untuk verifikasi.'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// @desc    Kirim ulang kode OTP ke email
// @route   POST /api/auth/send-otp
exports.sendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email wajib diisi' });
    const result = await sendOtpToEmail(email);
    res.json(result);
  } catch (err) {
    if (err.code === 'RATE_LIMITED') return res.status(429).json({ message: err.message });
    if (err.code === 'USER_NOT_FOUND') return res.status(404).json({ message: err.message });
    res.status(500).json({ message: err.message });
  }
}

// @desc    Verifikasi kode OTP
// @route   POST /api/auth/verify-otp
exports.verifyOtpCode = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ message: 'Email dan kode OTP wajib diisi' });
    await verifyOtp(email, code);
    const user = await User.findOne({ email }).select('-password');
    const token = generateToken(user);
    res.json({ ...user.toObject(), token, message: 'Email berhasil diverifikasi' });
  } catch (err) {
    if (['USER_NOT_FOUND', 'NO_OTP', 'OTP_EXPIRED', 'INVALID_OTP'].includes(err.code)) {
      return res.status(400).json({ message: err.message, code: err.code });
    }
    res.status(500).json({ message: err.message });
  }
}

// @desc    Login user
// @route   POST /api/auth/login
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  // VALIDASI AWAL: Pastikan input tidak kosong
  if (!email || !password) {
    return res.status(400).json({ message: 'Harap isi email dan password' });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: 'Email atau password salah' });
    }

    // Cek apakah akun terkunci
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const lockTimeRemaining = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(403).json({
        message: `Akun Anda terkunci sementara karena terlalu banyak percobaan login. Silakan coba lagi dalam ${lockTimeRemaining} menit.`,
      });
    }

    // Cek apakah password cocok
    if (await user.matchPassword(password)) {
      // Reset login attempts setelah login berhasil
      user.loginAttempts = 0;
      user.lockUntil = undefined;
      await user.save();

      res.json({
        _id: user._id,
        name: user.name,
        role: user.role,
        token: generateToken(user)
      });
    } else {
      // Tambah percobaan login yang gagal
      user.loginAttempts = (user.loginAttempts || 0) + 1;

      // Kunci akun jika sudah 5 kali gagal
       if (user.loginAttempts >= 5) {
         user.lockUntil = Date.now() + 1 * 1000; // kunci selama 1 detik untuk memudahkan testing
       }

      await user.save();
      res.status(401).json({ message: 'Email atau password salah' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get profil user yang login
// @route   GET /api/auth/profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update profil user
// @route   PUT /api/auth/profile
exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });

    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    user.phone = req.body.phone || user.phone;
    user.address = req.body.address || user.address;

    const updatedUser = await user.save();
    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      phone: updatedUser.phone,
      address: updatedUser.address
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Lupa password — kirim OTP ke email
// @route   POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ message: 'Email wajib diisi' });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'Email tidak terdaftar' });

    const code = require('../services/otpService').generateOtpCode();
    user.otpCode = code;
    user.otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
    user.otpSentAt = new Date();
    await user.save();

    require('../services/emailService').sendOtpEmail(email, code).catch((emailErr) => {
      console.error('[Auth] Gagal kirim OTP forgot-password:', emailErr.message);
    });

    res.json({ message: 'Kode OTP telah dikirim ke email Anda' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Reset password dengan kode OTP
// @route   POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return res.status(400).json({ message: 'Email, kode OTP, dan password baru wajib diisi' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'Password baru minimal 6 karakter' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'Email tidak terdaftar' });

    if (!user.otpCode || !user.otpExpiresAt) {
      return res.status(400).json({ message: 'Belum ada kode OTP. Silakan minta kode OTP terlebih dahulu' });
    }

    if (Date.now() > user.otpExpiresAt.getTime()) {
      user.otpCode = undefined;
      user.otpExpiresAt = undefined;
      await user.save();
      return res.status(400).json({ message: 'Kode OTP sudah kadaluarsa. Silakan minta kode baru' });
    }

    if (user.otpCode !== String(code).trim()) {
      return res.status(400).json({ message: 'Kode OTP tidak valid' });
    }

    user.password = newPassword;
    user.otpCode = undefined;
    user.otpExpiresAt = undefined;
    user.otpSentAt = undefined;
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    res.json({ message: 'Password berhasil direset. Silakan login dengan password baru Anda.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Ganti password
// @route   PUT /api/auth/password
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Harap isi password lama dan baru' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'Password baru minimal 6 karakter' });
  }

  try {
    const user = await User.findById(req.user._id);

    if (!(await user.matchPassword(currentPassword))) {
      return res.status(401).json({ message: 'Password lama salah' });
    }

    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password berhasil diubah' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
