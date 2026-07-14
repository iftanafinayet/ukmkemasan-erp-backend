const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 requests per windowMs
  skip: (req, res) => process.env.NODE_ENV === 'test', // Skip rate limiting during testing
  message: {
    message: 'Terlalu banyak percobaan login, silakan coba lagi setelah 1 menit',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

module.exports = { authLimiter };
