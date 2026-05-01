const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const { protect, admin } = require('../../middleware/authMiddleware');

process.env.JWT_SECRET = 'test-secret-key';

jest.mock('../../models/User');

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('Auth Middleware Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('protect middleware', () => {
    it('should call next() with valid token', async () => {
      const token = jwt.sign({ id: 'user123', role: 'customer' }, process.env.JWT_SECRET);
      const mockUser = { _id: 'user123', name: 'Test', role: 'customer' };
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });

      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockResponse();
      const next = jest.fn();

      await protect(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.user).toEqual(mockUser);
    });

    it('should return 401 if no token provided', async () => {
      const req = { headers: {} };
      const res = mockResponse();
      const next = jest.fn();

      await protect(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'No token provided' }));
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 for expired token', async () => {
      const token = jwt.sign({ id: 'user123' }, process.env.JWT_SECRET, { expiresIn: '-1s' });

      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockResponse();
      const next = jest.fn();

      await protect(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Token expired' }));
    });

    it('should return 401 for invalid token', async () => {
      const req = { headers: { authorization: 'Bearer invalid-token-xyz' } };
      const res = mockResponse();
      const next = jest.fn();

      await protect(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Invalid token' }));
    });

    it('should return 401 if user not found in DB', async () => {
      const token = jwt.sign({ id: 'deleteduser' }, process.env.JWT_SECRET);
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockResponse();
      const next = jest.fn();

      await protect(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('admin middleware', () => {
    it('should call next() for admin role', () => {
      const req = { user: { _id: 'admin123', role: 'admin' } };
      const res = mockResponse();
      const next = jest.fn();

      admin(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should return 403 for non-admin role', () => {
      const req = { user: { _id: 'user123', role: 'customer' } };
      const res = mockResponse();
      const next = jest.fn();

      admin(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
