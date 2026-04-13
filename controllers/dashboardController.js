const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');

// @desc    Analisis Penjualan per Kategori Produk
// @route   GET /api/dashboard/categories
exports.getCategoryAnalytics = async (req, res) => {
  try {
    const stats = await Order.aggregate([
      // Filter out orders with missing product reference
      { $match: { product: { $ne: null } } },
      
      // 1. Gabungkan dengan data Produk untuk mendapatkan kategori
      {
        $lookup: {
          from: "products",
          let: { productId: "$product" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", { $toObjectId: "$$productId" }]
                }
              }
            }
          ],
          as: "productInfo"
        }
      },
      
      // Ensure product exists in collection
      { $match: { "productInfo.0": { $exists: true } } },
      { $unwind: "$productInfo" },

      // 2. Kelompokkan berdasarkan kategori produk
      {
        $group: {
          _id: "$productInfo.category",
          totalOrders: { $sum: 1 },
          totalQtySold: { $sum: "$details.quantity" },
          revenue: { $sum: "$totalPrice" },
          avgOrderValue: { $avg: "$totalPrice" }
        }
      },

      // 3. Urutkan dari yang paling laris (revenue tertinggi)
      { $sort: { revenue: -1 } }
    ]);

    // 4. Hitung juga statistik penggunaan Valve
    const valveStats = await Order.aggregate([
      {
        $group: {
          _id: "$details.useValve",
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      categoryStats: stats,
      valveUsage: {
        withValve: valveStats.find(v => v._id === true)?.count || 0,
        withoutValve: valveStats.find(v => v._id === false)?.count || 0
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAdminStats = async (req, res) => {
  try {
    // 1. Hitung Statistik Utama
    const totalOrders = await Order.countDocuments();
    const totalCustomers = await User.countDocuments({ role: 'customer' });
    
    // Hitung Total Omzet (Hanya dari order yang sudah lunas/Paid)
    const salesData = await Order.aggregate([
      { $match: { isPaid: true } },
      { $group: { _id: null, totalRevenue: { $sum: "$totalPrice" } } }
    ]);

    // 2. Status Produksi (Untuk melihat beban kerja)
    const orderStatusCount = await Order.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    // 3. Produk Terlaris (Top 5)
    const topProducts = await Order.aggregate([
      // Filter out orders with missing product reference
      { $match: { product: { $ne: null } } },
      
      // Group by product and sum quantity
      { $group: { _id: "$product", totalSold: { $sum: "$details.quantity" } } },
      
      // Sort by most sold
      { $sort: { totalSold: -1 } },
      
      // Limit to top 5
      { $limit: 5 },
      
      // Lookup product details with conversion to handle potential string/ObjectId mismatch
      {
        $lookup: {
          from: "products",
          let: { productId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", { $toObjectId: "$$productId" }]
                }
              }
            }
          ],
          as: "productDetail"
        }
      },
      
      // Filter out if product not found in products collection
      { $match: { "productDetail.0": { $exists: true } } },
      
      // Unwind the productDetail array
      { $unwind: "$productDetail" },
      
      // Project final fields
      {
        $project: {
          _id: 1,
          name: "$productDetail.name",
          totalSold: 1
        }
      }
    ]);

    res.json({
      summary: {
        totalRevenue: salesData.length > 0 ? salesData[0].totalRevenue : 0,
        totalOrders,
        totalCustomers
      },
      productionStatus: orderStatusCount,
      topProducts
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};