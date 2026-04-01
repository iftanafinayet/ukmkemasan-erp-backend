const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('./models/Product');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const products = [
  {
    name: "Standing Pouch 250g Flat Bottom Black Matte",
    category: "Flat Bottom",
    material: "Alufoil",
    priceB2C: 3500, // Harga < 1000 pcs
    priceB2B: 2800, // Harga >= 1000 pcs
    addons: { valvePrice: 500 },
    stock: 5000,
    description: "Kemasan kopi premium dengan dasar rata, warna hitam dop."
  },
  {
    name: "Standing Pouch 150g Clear/Silver",
    category: "Standing Pouch",
    material: "PET/Alu",
    priceB2C: 1800,
    priceB2B: 1200,
    addons: { valvePrice: 500 },
    stock: 10000,
    description: "Kemasan pouch standar dengan sisi depan transparan."
  },
  {
    name: "Gusset 500g Kraft Paper Brown",
    category: "Gusset Side Seal",
    material: "Kraft Paper",
    priceB2C: 4500,
    priceB2B: 3800,
    addons: { valvePrice: 500 },
    stock: 2500,
    description: "Kemasan gusset samping bahan kertas kraft alami, cocok untuk biji kopi."
  },
  {
    name: "Sachet 10g Aluminium Foil White",
    category: "Sachet",
    material: "Alufoil",
    priceB2C: 800,
    priceB2B: 550,
    addons: { valvePrice: 0 },
    stock: 20000,
    description: "Kemasan kopi sachet sekali seduh."
  }
];

const importData = async () => {
  try {
    // Hapus semua produk lama agar tidak duplikat
    await Product.deleteMany();

    // Masukkan data baru
    await Product.insertMany(products);

    console.log('Data Produk Berhasil Diimport! 🚀');
    process.exit();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

const destroyData = async () => {
  try {
    await Product.deleteMany();
    console.log('Data Produk Berhasil Dihapus! 🗑️');
    process.exit();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

// Logika untuk menjalankan fungsi berdasarkan argumen di terminal
if (process.argv[2] === '-d') {
  destroyData();
} else {
  importData();
}