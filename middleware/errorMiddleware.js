const { fail } = require('../utils/apiResponse');

const notFound = (req, res, next) => {
  fail(res, `Endpoint ${req.originalUrl} tidak ditemukan`, 404);
};

const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    status: 'error',
    message: err.message || 'Terjadi kesalahan server',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

module.exports = { notFound, errorHandler };