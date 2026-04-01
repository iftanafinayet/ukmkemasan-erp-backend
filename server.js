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
const corsOptions = {
  origin: ['http://localhost:5173', 'https://bucolic-stroopwafel-19285b.netlify.app'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true // Penting jika nanti pakai cookie
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

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});