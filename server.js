const express = require('express');
const dotenv = require('dotenv');

// Load env vars FIRST before requiring routes that depend on them
dotenv.config();

const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const path = require('path');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const dashboardRoutes = require('./routes/dashboardRoutes');
const orderRoutes = require('./routes/orderRoutes');
const customerRoutes = require('./routes/customerRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const corsOptions = {
  origin: ['http://localhost:5173', 'https://ukmkemasan-erp-frontend.vercel.app'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

connectDB();
const app = express();

// Middleware
app.use(express.json());
app.use(cors(corsOptions));
app.use(helmet());
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ROUTE DASAR
app.get('/', (req, res) => {
  res.send('API is Running');
});
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/uploads', express.static(path.join(__dirname, '/uploads')));
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/orders', orderRoutes);
// (Duplicate removed)
app.use('/api/customers', customerRoutes);
app.use('/api/inventory', inventoryRoutes);

// TEMPORARY ROUTE: CLEAR DB
app.get('/api/clear-db-now', async (req, res) => {
  try {
    const Order = require('./models/Order');
    const Product = require('./models/Product');
    const User = require('./models/User');
    
    await Order.deleteMany({});
    await Product.deleteMany({});
    await User.deleteMany({ role: { $ne: 'admin' } });
    
    res.send('✅ Database berhasil dibersihkan (kecuali Admin)!');
  } catch (err) {
    res.status(500).send('❌ Gagal: ' + err.message);
  }
});

// TEMPORARY ROUTE: SEED CSV
app.get('/api/seed-csv-now', async (req, res) => {
  try {
    const importCsv = require('./seederCsv');
    const count = await importCsv();
    res.send(`✅ Berhasil import ${count} produk dari file CSV!`);
  } catch (err) {
    res.status(500).send('❌ Gagal import CSV: ' + err.message);
  }
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});