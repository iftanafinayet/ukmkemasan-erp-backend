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
  // ============ GET /api/customers ============
  describe('GET /api/customers', () => {
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

    it('should return 500 if there is a server error', async () => {
      User.find.mockReturnValue({
        select: jest.fn().mockRejectedValue(new Error('Database error')),
      });

      const res = await request(app).get('/api/customers');
      expect(res.statusCode).toEqual(500);
      expect(res.body.message).toBe('Database error');
    });
  });

  // ============ GET /api/customers/export ============
  describe('GET /api/customers/export', () => {
    it('should export customers to excel successfully', async () => {
      User.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([
          { 
            name: 'Cust 1', 
            email: 'cust1@test.com', 
            phone: '08123', 
            createdAt: new Date('2023-01-01') 
          },
          { 
            name: 'Cust 2', 
            email: 'cust2@test.com', 
            phone: '08456', 
            createdAt: null 
          },
        ])
      });

      const res = await request(app).get('/api/customers/export');
      expect(res.statusCode).toEqual(200);
      expect(res.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(res.headers['content-disposition']).toMatch(/attachment; filename=customers_export.xlsx/);
      expect(res.body).toBeDefined();
    });

    it('should return 500 if there is a server error during export', async () => {
      User.find.mockReturnValue({
        select: jest.fn().mockRejectedValue(new Error('Export failed')),
      });

      const res = await request(app).get('/api/customers/export');
      expect(res.statusCode).toEqual(500);
      expect(res.body.message).toBe('Export failed');
    });
  });
});
