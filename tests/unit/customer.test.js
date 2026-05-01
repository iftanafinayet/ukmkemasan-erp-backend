const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const jwt = require('jsonwebtoken');

jest.mock('../../models/User');
jest.mock('../../config/db');
jest.mock('../../middleware/authMiddleware', () => ({
  protect: (req, res, next) => next(),
  admin: (req, res, next) => next(),
}));

describe('Customer Controller Unit Tests', () => {
  it('should get all customers', async () => {
    User.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([
        { name: 'Cust 1', email: 'cust1@test.com' },
        { name: 'Cust 2', email: 'cust2@test.com' }
      ])
    });

    const res = await request(app).get('/api/customers');
    expect(res.statusCode).toEqual(200);
    expect(res.body.length).toBe(2);
  });
});
