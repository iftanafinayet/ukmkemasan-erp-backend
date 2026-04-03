const dotenv = require('dotenv');
const connectDB = require('./config/db');
const User = require('./models/User');
const Product = require('./models/Product');
const Order = require('./models/Order');
const Warehouse = require('./models/Warehouse');
const StockCard = require('./models/StockCard');
const InventoryAdjustment = require('./models/InventoryAdjustment');
const importCsv = require('./seederCsv');

dotenv.config();

const users = [
  {
    name: 'Nighwan Admin',
    email: 'nighwan@mail.com',
    password: 'password123',
    role: 'admin',
    phone: '081234567890',
    address: 'Jl. Margonda Raya No. 123, Depok'
  },
  {
    name: 'Admin UKM Kemasan',
    email: 'admin@ukmkemasan.com',
    password: 'password123',
    role: 'admin',
    phone: '081298765432',
    address: 'Jl. Salemba Raya No. 4, Jakarta Pusat'
  },
  {
    name: 'Kopi Nusantara',
    email: 'order@kopinusantara.id',
    password: 'password123',
    role: 'customer',
    phone: '085611223344',
    address: 'Jl. Cikini No. 55, Jakarta Pusat'
  },
  {
    name: 'Roastery Bandung',
    email: 'hello@roasterybdg.com',
    password: 'password123',
    role: 'customer',
    phone: '087722334455',
    address: 'Jl. Dago No. 88, Bandung'
  },
  {
    name: 'Daily Brew Coffee',
    email: 'info@dailybrew.co',
    password: 'password123',
    role: 'customer',
    phone: '081344556677',
    address: 'Jl. Sudirman No. 200, Jakarta Selatan'
  }
];

const warehouseSeeds = [
  { name: 'Gudang Utama Bekasi', location: 'Jl. Industri No. 12, Bekasi', type: 'Main', isActive: true },
  { name: 'Gudang Overflow Cikarang', location: 'Kawasan Jababeka Blok A7, Cikarang', type: 'Main', isActive: true },
  { name: 'Gudang Retail Jakarta', location: 'Jl. Salemba Raya No. 10, Jakarta Pusat', type: 'Retail', isActive: true },
  { name: 'Gudang Retail Bandung', location: 'Jl. Dago No. 42, Bandung', type: 'Retail', isActive: true }
];

const orderStatuses = ['Quotation', 'Payment', 'Production', 'Quality Control', 'Shipping', 'Completed'];

const randomFrom = (items, offset = 0) => items[offset % items.length];

const seedAll = async () => {
  try {
    await connectDB();

    console.log('🗑️  Menghapus data lama...');
    await Promise.all([
      StockCard.deleteMany({}),
      InventoryAdjustment.deleteMany({}),
      Order.deleteMany({}),
      Product.deleteMany({}),
      Warehouse.deleteMany({}),
      User.deleteMany({})
    ]);

    console.log('👤 Seeding users...');
    const createdUsers = await User.create(users);

    console.log('🏬 Seeding warehouses...');
    const createdWarehouses = await Warehouse.insertMany(warehouseSeeds);

    console.log('📦 Import katalog packaging dari CSV...');
    const importedCount = await importCsv({ reset: false });
    const createdProducts = await Product.find({}).sort({ category: 1, name: 1 });

    console.log('🛒 Seeding sample orders dan stock cards...');
    const customers = createdUsers.filter((user) => user.role === 'customer');
    const mainWarehouse = createdWarehouses.find((warehouse) => warehouse.type === 'Main');
    const orders = [];
    const stockCards = [];

    customers.forEach((customer, customerIndex) => {
      for (let idx = 0; idx < 3; idx += 1) {
        const product = randomFrom(createdProducts, customerIndex * 5 + idx * 3);
        const quantity = 100 * (idx + customerIndex + 1);
        const useValve = idx % 2 === 0;
        const status = randomFrom(orderStatuses, customerIndex + idx);
        const isPaid = ['Production', 'Quality Control', 'Shipping', 'Completed'].includes(status);
        const unitPriceBase = quantity >= 1000 ? product.priceB2B : product.priceB2C;
        const unitPrice = unitPriceBase + (useValve ? product.addons?.valvePrice || 0 : 0);
        const totalPrice = unitPrice * quantity;

        product.stockPolos = Math.max(0, (product.stockPolos || 0) - quantity);

        orders.push({
          orderNumber: `UKM-2026-${String(orders.length + 1).padStart(4, '0')}`,
          customer: customer._id,
          product: product._id,
          details: {
            quantity,
            material: product.material,
            useValve,
            unitPrice
          },
          totalPrice,
          status,
          isPaid,
          branding: {
            status: isPaid ? 'Approved' : 'Pending',
            notes: isPaid ? 'Desain sudah disetujui oleh customer.' : ''
          }
        });
      }
    });

    const createdOrders = await Order.insertMany(orders);
    await Promise.all(createdProducts.map((product) => product.save()));

    createdOrders.forEach((order) => {
      const quantity = order.details?.quantity || 0;
      const product = createdProducts.find((item) => String(item._id) === String(order.product));
      stockCards.push({
        product: order.product,
        warehouse: mainWarehouse?._id,
        referenceType: 'Order',
        referenceId: order._id,
        referenceNo: order.orderNumber,
        quantityChange: -quantity,
        balanceAfter: product?.stockPolos || 0,
        note: `Pengurangan stok untuk order ${order.orderNumber}`
      });
    });

    if (stockCards.length > 0) {
      await StockCard.insertMany(stockCards);
    }

    console.log('\n🚀 Seeding selesai');
    console.log(`   👤 Users      : ${createdUsers.length}`);
    console.log(`   🏬 Warehouses : ${createdWarehouses.length}`);
    console.log(`   📦 Products   : ${importedCount}`);
    console.log(`   🛒 Orders     : ${createdOrders.length}`);
    console.log('\n📋 Login credentials');
    console.log('   Admin    : nighwan@mail.com / password123');
    console.log('   Customer : order@kopinusantara.id / password123');
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
};

const destroyAll = async () => {
  try {
    await connectDB();
    await Promise.all([
      StockCard.deleteMany({}),
      InventoryAdjustment.deleteMany({}),
      Order.deleteMany({}),
      Product.deleteMany({}),
      Warehouse.deleteMany({}),
      User.deleteMany({})
    ]);
    console.log('🗑️  Semua data berhasil dihapus!');
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
};

if (process.argv[2] === '-d') {
  destroyAll();
} else {
  seedAll();
}
