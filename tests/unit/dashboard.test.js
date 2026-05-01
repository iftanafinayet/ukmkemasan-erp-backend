const request = require('supertest');
const app = require('../../app');
const Order = require('../../models/Order');
const User = require('../../models/User');
const jwt = require('jsonwebtoken');

jest.mock('../../models/Order');
jest.mock('../../models/User');
jest.mock('../../config/db');
jest.mock('../../middleware/authMiddleware', () => ({
  protect: (req, res, next) => {
    req.user = { _id: 'admin123', role: 'admin' };
    next();
  },
  admin: (req, res, next) => next(),
}));

describe('Dashboard Controller Unit Tests', () => {
  it('should get category analytics', async () => {
    Order.aggregate.mockResolvedValue([
      { _id: 'Packaging', totalOrders: 10, revenue: 1000000 }
    ]);

    const res = await request(app).get('/api/dashboard/categories');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('categoryStats');
  });

  it('should get admin stats', async () => {
    Order.countDocuments.mockResolvedValue(100);
    User.countDocuments.mockResolvedValue(50);
    Order.aggregate
      .mockResolvedValueOnce([
        { _id: null, totalRevenue: 5000000 }
      ])
      .mockResolvedValueOnce([
        { _id: 'Paid', count: 60 },
        { _id: 'Pending', count: 40 }
      ])
      .mockResolvedValueOnce([
        { _id: 'prod1', name: 'Product 1', totalSold: 100 }
      ]);

    const res = await request(app).get('/api/dashboard/stats');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('summary');
  });
});
