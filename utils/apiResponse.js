const success = (res, data, statusCode = 200) => {
  res.status(statusCode).json({
    status: 'success',
    data
  });
};

const created = (res, data) => success(res, data, 201);

const fail = (res, message, statusCode = 400, details = null) => {
  const body = {
    status: 'fail',
    message
  };
  if (details) body.details = details;
  res.status(statusCode).json(body);
};

const error = (res, message, statusCode = 500) => {
  res.status(statusCode).json({
    status: 'error',
    message
  });
};

const notFound = (res, message = 'Resource tidak ditemukan') => fail(res, message, 404);
const unauthorized = (res, message = 'Tidak memiliki akses') => fail(res, message, 401);
const forbidden = (res, message = 'Akses ditolak') => fail(res, message, 403);

module.exports = { success, created, fail, error, notFound, unauthorized, forbidden };
