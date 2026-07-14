const mongoose = require('mongoose');
const Order = require('./models/Order');
const Product = require('./models/Product');
const db = require('./config/db');
require('dotenv').config();

async function checkData() {
    await db();
    try {
        const orderCount = await Order.countDocuments();
        console.log('Total Orders:', orderCount);

        const sampleOrders = await Order.find().limit(5).lean();
        console.log('Sample Orders Product field type:', sampleOrders.map(o => typeof o.product));
        console.log('Sample Orders Product field value:', sampleOrders.map(o => o.product));

        const topProductsRaw = await Order.aggregate([
            { $match: { product: { $ne: null } } },
            { $group: { _id: "$product", totalSold: { $sum: "$details.quantity" } } },
            { $sort: { totalSold: -1 } },
            { $limit: 5 }
        ]);
        console.log('Top Products Raw:', JSON.stringify(topProductsRaw, null, 2));

        for (const tp of topProductsRaw) {
            const product = await Product.findById(tp._id);
            console.log(`Product ID ${tp._id} found: ${!!product}`, product ? product.name : 'N/A');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.connection.close();
    }
}

checkData();
