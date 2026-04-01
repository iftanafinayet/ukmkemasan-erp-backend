const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const users = [
  {
    name: "Admin UKM Kemasan",
    email: "admin@ukmkemasan.com",
    password: "password123", // Nanti akan di-hash otomatis oleh Pre-save Hook di Model User
    role: "admin"
  },
  {
    name: "Customer Coffee Shop",
    email: "customer@coffeeshop.com",
    password: "password123",
    role: "customer"
  }
];

const importUsers = async () => {
  try {
    // Hapus user lama (Opsional, hati-hati jika sudah ada data asli)
    await User.deleteMany();

    // Gunakan .create agar Mongoose menjalankan Middleware 'save' (hashing password)
    await User.create(users);

    console.log('User Seeded Successfully! 👤✅');
    process.exit();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

importUsers();