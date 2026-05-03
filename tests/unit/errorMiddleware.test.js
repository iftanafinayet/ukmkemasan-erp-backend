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
    it('should set status to 404 and call next with a Not Found error', () => {
      notFound(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe('Not Found - /api/test-url');
    });
  });

  describe('errorHandler', () => {
    it('should use 500 if res.statusCode is 200', () => {
      const error = new Error('Internal Server Error');
      res.statusCode = 200;

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
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
        message: 'Production Error',
        stack: null,
      });

      process.env.NODE_ENV = originalEnv;
    });
  });
});
