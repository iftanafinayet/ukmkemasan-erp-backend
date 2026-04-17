const snap = require('../config/midtrans');

exports.checkout = async (req, res) => {
    try {
        let parameter = {
            transaction_details: {
                order_id: req.body.order_id,
                gross_amount: req.body.gross_amount,
            },
            customer_details: {
                first_name: req.body.first_name,
                last_name: req.body.last_name,
                email: req.body.email,
                phone: req.body.phone,
            },
        };
        const transaction = await snap.createTransaction(parameter);
        res.json(transaction);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create transaction' });
    }
};