const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
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
const webhookRoutes = require('./routes/webhookRoutes');
const productionTaskRoutes = require('./routes/productionTaskRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const shippingRoutes = require('./routes/shippingRoutes');
const settingsRoutes = require('./routes/settingsRoutes');

const DEFAULT_BACKEND_URL = 'https://ukmkemasan-erp-backend-production.up.railway.app';
const DEFAULT_FRONTEND_URL = 'https://ukmkemasan-erp-frontend.vercel.app';

const app = express();
const backendUrl = process.env.BACKEND_URL || DEFAULT_BACKEND_URL;
const frontendUrl = process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL;
const allowedOrigins = (process.env.ALLOWED_ORIGINS || [
  'http://localhost:5173',
  'http://[IP_ADDRESS]',
  frontendUrl,
  backendUrl,
].join(','))
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const isPrivateNetworkOrigin = (origin) => {
  try {
    const { hostname } = new URL(origin);
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') return true;
    const ipPattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(:\d+)?$/;
    const match = hostname.match(ipPattern);
    if (!match) return false;
    const [, a, b, c] = match.map(Number);
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  } catch { }
  return false;
};

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || isPrivateNetworkOrigin(origin)) {
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
app.use('/api/webhooks', webhookRoutes);
app.use('/api/production-tasks', productionTaskRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/settings', settingsRoutes);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCssUrl: 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.20.1/swagger-ui.min.css',
  customJs: [
    'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.20.1/swagger-ui-bundle.js',
    'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.20.1/swagger-ui-standalone-preset.js',
  ],
}));

app.use(notFound);
app.use(errorHandler);

module.exports = app;