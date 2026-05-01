const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const orderRoutes = require('./routes/orderRoutes');
const customerRoutes = require('./routes/customerRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const salesRoutes = require('./routes/salesRoutes');
const landingContentRoutes = require('./routes/landingContentRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

const DEFAULT_BACKEND_URL = 'https://ukmkemasan-erp-backend-production.up.railway.app';
const DEFAULT_FRONTEND_URL = 'https://ukmkemasan-erp-frontend.vercel.app';

const app = express();
const backendUrl = process.env.BACKEND_URL || DEFAULT_BACKEND_URL;
const frontendUrl = process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL;
const allowedOrigins = (process.env.ALLOWED_ORIGINS || [
  'http://localhost:5173',
  frontendUrl,
  backendUrl,
].join(','))
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(express.json());
app.use(cors(corsOptions));
app.use(helmet());
if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
  app.use(morgan('dev'));
}

app.get('/', (req, res) => {
  res.json({
    message: 'API is Running',
    url: backendUrl,
    frontendUrl,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/uploads', express.static(path.join(__dirname, '/uploads')));
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/landing-content', landingContentRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
