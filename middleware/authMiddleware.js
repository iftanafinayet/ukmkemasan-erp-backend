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
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Token expired' });
            }

            return res.status(401).json({ message: 'Invalid token' });
        }
    } else {
        return res.status(401).json({ message: 'No token provided' });
    }
};

const checkRole = (...roles) => (req, res, next) => {
  console.log("User Role:", req.user ? req.user.role : "No User");
  if (req.user && roles.includes(req.user.role)) {
    return next();
  }
  const roleList = roles.join(', ');
  return res.status(403).json({ message: `Akses ditolak, khusus: ${roleList}` });
};

const admin = checkRole('admin');

const designer = checkRole('admin', 'designer');

const production = checkRole('admin', 'production');

module.exports = { protect, admin, designer, production, checkRole };
