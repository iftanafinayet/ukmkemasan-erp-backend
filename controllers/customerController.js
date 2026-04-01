const User = require('../models/User');

// @desc    Ambil semua pelanggan (User dengan role customer)
// @route   GET /api/customers
exports.getCustomers = async (req, res) => {
    try {
        // Filter berdasarkan role agar data admin tidak bocor
        const customers = await User.find({ role: 'customer' }).select('-password');
        res.json(customers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};