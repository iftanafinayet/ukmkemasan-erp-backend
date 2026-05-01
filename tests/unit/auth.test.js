const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret-key';

jest.mock('../../models/User');
jest.mock('../../config/db');

describe('Auth Controller Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============ POST /api/auth/register ============
  describe('POST /api/auth/register', () => {
    it('should register a user successfully', async () => {
      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue({
        _id: 'user123',
        name: 'Test User',
        email: 'test@example.com',
        role: 'customer',
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'Password123!',
          phone: '08123456789',
          role: 'customer',
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('token');
    });

    it('should fail if user already exists', async () => {
      User.findOne.mockResolvedValue({ _id: 'existing' });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'Password123!',
        });

      expect(res.statusCode).toEqual(400);
    });

    it('should fail if required fields are missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com' });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toMatch(/field wajib/i);
    });
  });

  // ============ POST /api/auth/login ============
  describe('POST /api/auth/login', () => {
    it('should login successfully', async () => {
      User.findOne.mockResolvedValue({
        _id: 'user123',
        email: 'test@example.com',
        name: 'Test',
        role: 'customer',
        password: 'hashedPassword',
        matchPassword: jest.fn().mockResolvedValue(true),
        loginAttempts: 0,
        save: jest.fn().mockResolvedValue(true),
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123!',
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('token');
    });

    it('should fail with wrong credentials', async () => {
      User.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'wrong@example.com',
          password: 'Password123!',
        });

      expect(res.statusCode).toEqual(401);
    });

    it('should fail if email/password missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });

      expect(res.statusCode).toEqual(400);
    });

    it('should return 403 if account is locked', async () => {
      User.findOne.mockResolvedValue({
        _id: 'user123',
        email: 'test@example.com',
        lockUntil: Date.now() + 30 * 60 * 1000, // locked for 30 more minutes
        matchPassword: jest.fn(),
        save: jest.fn(),
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123!',
        });

      expect(res.statusCode).toEqual(403);
      expect(res.body.message).toMatch(/terkunci/i);
    });

    it('should increment login attempts on wrong password', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        password: 'hashed',
        loginAttempts: 2,
        matchPassword: jest.fn().mockResolvedValue(false),
        save: jest.fn().mockResolvedValue(true),
      };
      User.findOne.mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword!',
        });

      expect(res.statusCode).toEqual(401);
      expect(mockUser.loginAttempts).toEqual(3);
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should lock account after 5 failed attempts', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        password: 'hashed',
        loginAttempts: 4, // this will be the 5th attempt
        matchPassword: jest.fn().mockResolvedValue(false),
        save: jest.fn().mockResolvedValue(true),
      };
      User.findOne.mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword!',
        });

      expect(res.statusCode).toEqual(401);
      expect(mockUser.loginAttempts).toEqual(5);
      expect(mockUser.lockUntil).toBeDefined();
    });
  });

  // ============ GET /api/auth/profile ============
  describe('GET /api/auth/profile', () => {
    it('should return user profile', async () => {
      const mockUser = {
        _id: 'user123',
        name: 'Test',
        email: 'test@example.com',
        role: 'customer',
      };
      // First call is from authMiddleware.protect
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const token = jwt.sign({ id: 'user123', role: 'customer' }, process.env.JWT_SECRET);

      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.name).toEqual('Test');
    });

    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/auth/profile');
      expect(res.statusCode).toEqual(401);
    });
  });

  // ============ PUT /api/auth/profile ============
  describe('PUT /api/auth/profile', () => {
    it('should update user profile', async () => {
      const mockUser = {
        _id: 'user123',
        name: 'Old Name',
        email: 'test@example.com',
        role: 'customer',
        phone: '',
        address: '',
        save: jest.fn().mockResolvedValue({
          _id: 'user123',
          name: 'New Name',
          email: 'test@example.com',
          role: 'customer',
        }),
      };

      // authMiddleware uses findById().select()
      User.findById
        .mockReturnValueOnce({ select: jest.fn().mockResolvedValue(mockUser) }) // protect middleware
        .mockResolvedValueOnce(mockUser); // controller

      const token = jwt.sign({ id: 'user123', role: 'customer' }, process.env.JWT_SECRET);

      const res = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Name' });

      expect(res.statusCode).toEqual(200);
    });
  });

  // ============ PUT /api/auth/password ============
  describe('PUT /api/auth/password', () => {
    it('should change password successfully', async () => {
      const mockUser = {
        _id: 'user123',
        matchPassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
      };

      User.findById
        .mockReturnValueOnce({ select: jest.fn().mockResolvedValue(mockUser) })
        .mockResolvedValueOnce(mockUser);

      const token = jwt.sign({ id: 'user123', role: 'customer' }, process.env.JWT_SECRET);

      const res = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword456!',
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toMatch(/berhasil/i);
    });

    it('should return 401 for wrong old password', async () => {
      const mockUser = {
        _id: 'user123',
        matchPassword: jest.fn().mockResolvedValue(false),
      };

      User.findById
        .mockReturnValueOnce({ select: jest.fn().mockResolvedValue(mockUser) })
        .mockResolvedValueOnce(mockUser);

      const token = jwt.sign({ id: 'user123', role: 'customer' }, process.env.JWT_SECRET);

      const res = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'WrongOldPassword!',
          newPassword: 'NewPassword456!',
        });

      expect(res.statusCode).toEqual(401);
    });

    it('should return 400 if fields are missing', async () => {
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({ _id: 'user123' }),
      });

      const token = jwt.sign({ id: 'user123', role: 'customer' }, process.env.JWT_SECRET);

      const res = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'Old123!' });

      expect(res.statusCode).toEqual(400);
    });
  });
});
