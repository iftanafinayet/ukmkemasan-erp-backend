const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const connectDB = require('./config/db');
const setupSocket = require('./services/socketService');
const dotenv = require('dotenv');

dotenv.config();

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  const server = http.createServer(app);

  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        const envAllowed = (process.env.ALLOWED_ORIGINS || '')
          .split(',')
          .map((o) => o.trim().replace(/\/+$/, ''))
          .filter(Boolean);
        const allowedOrigins = [
          'http://localhost:5173',
          'https://ukmkemasan-erp-frontend.vercel.app',
          'https://ukmkemasan-erp-backend-production.up.railway.app',
          process.env.FRONTEND_URL,
          process.env.BACKEND_URL,
          ...envAllowed,
        ].filter(Boolean);
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`CORS origin not allowed: ${origin}`));
      },
      credentials: true,
    },
  });

  app.set('io', io);
  setupSocket(io);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

startServer().catch((error) => {
  console.error(`Failed to start server: ${error.message}`);
  process.exit(1);
});
