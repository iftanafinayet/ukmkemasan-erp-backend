const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('./models/Product');
const User = require('./models/User');
const Order = require('./models/Order');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

// ==================== DATA PRODUCTS ====================
const products = [
    {
        name: "Standing Pouch 250g Black Matte",
        category: "Standing Pouch",
        material: "Alufoil",
        priceBase: 2500,
        priceB2C: 3500,
        priceB2B: 2800,
        addons: { valvePrice: 500 },
        stockPolos: 5000,
        minOrder: 100,
        description: "Kemasan kopi premium standing pouch warna hitam dop, cocok untuk kopi arabika."
    },
    {
        name: "Standing Pouch 150g Clear/Silver",
        category: "Standing Pouch",
        material: "PET/Alu",
        priceBase: 1500,
        priceB2C: 1800,
        priceB2B: 1200,
        addons: { valvePrice: 500 },
        stockPolos: 10000,
        minOrder: 100,
        description: "Kemasan pouch standar dengan sisi depan transparan."
    },
    {
        name: "Flat Bottom 500g Kraft Paper",
        category: "Flat Bottom",
        material: "Kraft Paper",
        priceBase: 3500,
        priceB2C: 4500,
        priceB2B: 3800,
        addons: { valvePrice: 600 },
        stockPolos: 3000,
        minOrder: 100,
        description: "Kemasan flat bottom bahan kraft, kesan natural premium."
    },
    {
        name: "Gusset Side Seal 500g Brown",
        category: "Gusset Side Seal",
        material: "Kraft Paper",
        priceBase: 3000,
        priceB2C: 4200,
        priceB2B: 3500,
        addons: { valvePrice: 500 },
        stockPolos: 2500,
        minOrder: 100,
        description: "Kemasan gusset samping bahan kertas kraft alami, cocok untuk biji kopi."
    },
    {
        name: "Gusset Quad Seal 1kg Black",
        category: "Gusset Quad Seal",
        material: "Alufoil",
        priceBase: 5000,
        priceB2C: 6500,
        priceB2B: 5500,
        addons: { valvePrice: 600 },
        stockPolos: 1500,
        minOrder: 100,
        description: "Kemasan quad seal untuk kopi ukuran besar 1kg, tampilan kokoh & premium."
    },
    {
        name: "Sachet 10g Aluminium Foil White",
        category: "Sachet",
        material: "Alufoil",
        priceBase: 500,
        priceB2C: 800,
        priceB2B: 550,
        addons: { valvePrice: 0 },
        stockPolos: 20000,
        minOrder: 100,
        description: "Kemasan kopi sachet sekali seduh."
    },
    {
        name: "Dripbag 12g Pouch Brown",
        category: "Dripbag",
        material: "PET/PE",
        priceBase: 1200,
        priceB2C: 1800,
        priceB2B: 1400,
        addons: { valvePrice: 0 },
        stockPolos: 8000,
        minOrder: 100,
        description: "Kemasan drip bag untuk kopi filter, praktis dan modern."
    },
    {
        name: "Flatbottom Square 250g Gold",
        category: "Flatbottom Square",
        material: "Alufoil",
        priceBase: 4000,
        priceB2C: 5200,
        priceB2B: 4500,
        addons: { valvePrice: 600 },
        stockPolos: 400, // Low stock!
        minOrder: 100,
        description: "Kemasan flat bottom square premium warna emas, tampilan mewah."
    }
];

// ==================== DATA USERS ====================
const users = [
    {
        name: "Nighwan Admin",
        email: "nighwan@mail.com",
        password: "password123",
        role: "admin",
        phone: "081234567890",
        address: "Jl. Margonda Raya No. 123, Depok"
    },
    {
        name: "Admin UKM Kemasan",
        email: "admin@ukmkemasan.com",
        password: "password123",
        role: "admin",
        phone: "081298765432",
        address: "Jl. Salemba Raya No. 4, Jakarta Pusat"
    },
    {
        name: "Kopi Nusantara",
        email: "order@kopinusantara.id",
        password: "password123",
        role: "customer",
        phone: "085611223344",
        address: "Jl. Cikini No. 55, Jakarta Pusat"
    },
    {
        name: "Roastery Bandung",
        email: "hello@roasterybdg.com",
        password: "password123",
        role: "customer",
        phone: "087722334455",
        address: "Jl. Dago No. 88, Bandung"
    },
    {
        name: "Daily Brew Coffee",
        email: "info@dailybrew.co",
        password: "password123",
        role: "customer",
        phone: "081344556677",
        address: "Jl. Sudirman No. 200, Jakarta Selatan"
    },
    {
        name: "Warung Kopi Mbah",
        email: "mbah@warungkopi.com",
        password: "password123",
        role: "customer",
        phone: "08561234567",
        address: "Jl. Malioboro No. 10, Yogyakarta"
    },
    {
        name: "Cafe De Lima",
        email: "contact@cafedelima.id",
        password: "password123",
        role: "customer",
        phone: "089988776655",
        address: "Jl. Gatot Subroto No. 45, Surabaya"
    }
];

// ==================== SEED FUNCTION ====================
const seedAll = async () => {
    try {
        console.log('🗑️  Menghapus data lama...');
        await Order.deleteMany();
        await Product.deleteMany();
        await User.deleteMany();

        // 1. Seed Users (harus pakai .create agar password di-hash oleh pre-save hook)
        console.log('👤 Seeding users...');
        const createdUsers = await User.create(users);
        console.log(`   ✅ ${createdUsers.length} users berhasil dibuat`);

        // Ambil referensi user
        const adminUser = createdUsers.find(u => u.email === 'nighwan@mail.com');
        const customers = createdUsers.filter(u => u.role === 'customer');

        // 2. Seed Products
        console.log('📦 Seeding products...');
        const createdProducts = await Product.insertMany(products);
        console.log(`   ✅ ${createdProducts.length} produk berhasil dibuat`);

        // 3. Seed Orders (referencing real user & product IDs)
        console.log('🛒 Seeding orders...');
        const orderStatuses = ['Quotation', 'Payment', 'Production', 'Quality Control', 'Shipping', 'Completed'];
        const orders = [];
        let orderCount = 0;

        // Generate orders for each customer
        for (const customer of customers) {
            // Each customer gets 2-3 orders
            const numOrders = 2 + Math.floor(Math.random() * 2); // 2 or 3
            for (let i = 0; i < numOrders; i++) {
                const product = createdProducts[Math.floor(Math.random() * createdProducts.length)];
                const quantity = (Math.floor(Math.random() * 10) + 1) * 100; // 100-1000 in steps of 100
                const useValve = Math.random() > 0.4; // 60% pakai valve
                const status = orderStatuses[Math.floor(Math.random() * orderStatuses.length)];
                const isPaid = ['Production', 'Quality Control', 'Shipping', 'Completed'].includes(status);

                const basePrice = quantity >= 1000 ? product.priceB2B : product.priceB2C;
                const valveExtra = useValve ? product.addons.valvePrice : 0;
                const unitPrice = basePrice + valveExtra;
                const totalPrice = unitPrice * quantity;

                orderCount++;
                orders.push({
                    orderNumber: `UKM-2026-${orderCount.toString().padStart(4, '0')}`,
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
        }

        const createdOrders = await Order.insertMany(orders);
        console.log(`   ✅ ${createdOrders.length} orders berhasil dibuat`);

        console.log('\n🚀 Seeding selesai! Ringkasan:');
        console.log(`   👤 Users   : ${createdUsers.length} (${customers.length} customer, ${createdUsers.length - customers.length} admin)`);
        console.log(`   📦 Products: ${createdProducts.length}`);
        console.log(`   🛒 Orders  : ${createdOrders.length}`);
        console.log('\n📋 Login credentials:');
        console.log('   Admin  : nighwan@mail.com / password123');
        console.log('   Customer: order@kopinusantara.id / password123');

        process.exit();
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        process.exit(1);
    }
};

const destroyAll = async () => {
    try {
        await Order.deleteMany();
        await Product.deleteMany();
        await User.deleteMany();
        console.log('🗑️  Semua data berhasil dihapus!');
        process.exit();
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        process.exit(1);
    }
};

// Jalankan: node seedAll.js         → import
//           node seedAll.js -d      → destroy
if (process.argv[2] === '-d') {
    destroyAll();
} else {
    seedAll();
}
