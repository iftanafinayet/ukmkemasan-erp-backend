const User = require('../models/User');
const jwt = require('jsonwebtoken');

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '2h' }
  );
};

// @desc    Register user baru
// @route   POST /api/auth/register
exports.registerUser = async (req, res) => {
  const { name, email, password, role } = req.body;

  // VALIDASI AWAL
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Harap isi semua field wajib' });
  }

  try {
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'User sudah terdaftar' });

    const user = await User.create({ name, email, password, role });
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
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
        user.lockUntil = Date.now() + 30 * 60 * 1000; // kunci selama 30 menit
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
