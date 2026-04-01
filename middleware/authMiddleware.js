const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];

            const decode = jwt.verify(token, process.env.JWT_SECRET);

            req.user = await User.findById(decode.id).select('-password');

            if (!req.user) {
                return res.status(401).json({ message: 'User tidak ditemukan. Silakan login ulang.' });
            }

            return next();
        } catch (error) {
            console.error(error);
            return res.status(401).json({ message: 'Tidak diizinkan, token gagal atau kadaluwarsa' });
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'Tidak diizinkan, tidak ada token' });
    }
};

const admin = (req, res, next) => {
    // Tambahkan log ini untuk intip di terminal backend
    console.log("User Role:", req.user ? req.user.role : "No User");

    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Akses ditolak, khusus admin!' });
    }
};

module.exports = { protect, admin };