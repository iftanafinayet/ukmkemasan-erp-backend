const { notFound, errorHandler } = require('../../middleware/errorMiddleware');

describe('Error Middleware Unit Tests', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      originalUrl: '/api/test-url',
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      statusCode: 200,
    };
    next = jest.fn();
  });

  describe('notFound', () => {
    it('should set status to 404 with proper message', () => {
      notFound(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        status: 'fail',
        message: 'Endpoint /api/test-url tidak ditemukan',
      });
    });
  });

  describe('errorHandler', () => {
    it('should use 500 if res.statusCode is 200', () => {
      const error = new Error('Internal Server Error');
      res.statusCode = 200;

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Internal Server Error',
        stack: error.stack,
      });
    });

    it('should use existing res.statusCode if it is not 200', () => {
      const error = new Error('Bad Request');
      res.statusCode = 400;

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Bad Request',
        stack: error.stack,
      });
    });

    it('should not include stack trace in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const error = new Error('Production Error');
      res.statusCode = 500;

      errorHandler(error, req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Production Error',
      });

      process.env.NODE_ENV = originalEnv;
    });
  });
});
