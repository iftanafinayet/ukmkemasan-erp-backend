const request = require('supertest');
const app = require('../../app');
const Warehouse = require('../../models/Warehouse');
const Product = require('../../models/Product');
const StockCard = require('../../models/StockCard');
const jwt = require('jsonwebtoken');

jest.mock('../../models/Warehouse');
jest.mock('../../models/Product');
jest.mock('../../models/StockCard');
jest.mock('../../config/db');
jest.mock('../../middleware/authMiddleware', () => ({
  protect: (req, res, next) => {
    req.user = { _id: 'user123', role: 'customer' };
    next();
  },
  admin: (req, res, next) => next(),
}));

describe('Inventory Controller Unit Tests', () => {
  it('should get warehouses', async () => {
    Warehouse.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue([
        { name: 'Main Warehouse', type: 'Main' },
        { name: 'Buffer Warehouse', type: 'Buffer' }
      ])
    });

    const res = await request(app).get('/api/inventory/warehouses');
    expect(res.statusCode).toEqual(200);
    expect(res.body.length).toBe(2);
  });

  it('should create a warehouse as admin', async () => {
    Warehouse.create.mockResolvedValue({
      name: 'New Warehouse',
      type: 'Main'
    });

    const res = await request(app)
      .post('/api/inventory/warehouses')
      .send({ name: 'New Warehouse', type: 'Main' });

    expect(res.statusCode).toEqual(201);
    expect(res.body.name).toEqual('New Warehouse');
  });
});
