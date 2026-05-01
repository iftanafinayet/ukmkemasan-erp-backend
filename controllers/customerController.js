const User = require('../models/User');
const xlsx = require('xlsx');

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

// @desc    Export Customers to Excel
// @route   GET /api/customers/export
exports.exportCustomers = async (req, res) => {
    try {
        const customers = await User.find({ role: 'customer' }).select('-password');
        
        const data = customers.map(c => ({
            'Name': c.name,
            'Email': c.email,
            'Phone': c.phone,
            'Created At': c.createdAt ? c.createdAt.toISOString().split('T')[0] : 'N/A',
        }));

        const worksheet = xlsx.utils.json_to_sheet(data);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Customers');

        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=customers_export.xlsx');
        res.send(buffer);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
