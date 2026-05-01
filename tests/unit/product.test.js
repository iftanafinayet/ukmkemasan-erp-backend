const request = require('supertest');
const app = require('../../app');
const Product = require('../../models/Product');
const User = require('../../models/User');
const jwt = require('jsonwebtoken');

jest.mock('../../models/Product');
jest.mock('../../models/User');
jest.mock('../../config/db');

describe('Product Controller Unit Tests', () => {
  let adminToken;

  beforeAll(async () => {
    // Mock a token for admin
    adminToken = jwt.sign({ id: 'admin123', role: 'admin' }, process.env.JWT_SECRET || 'secret');
  });

  it('should get all products', async () => {
    Product.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue([
        { name: 'Product 1', sku: 'SKU1', variants: [] },
        { name: 'Product 2', sku: 'SKU2', variants: [] }
      ])
    });

    const res = await request(app).get('/api/products');
    expect(res.statusCode).toEqual(200);
    expect(res.body.length).toBe(2);
  });

  it('should get a product by ID', async () => {
    Product.findById.mockResolvedValue({ name: 'Product 1', sku: 'SKU1' });

    const res = await request(app).get('/api/products/prod123');
    expect(res.statusCode).toEqual(200);
    expect(res.body.name).toBe('Product 1');
  });

  it('should return 404 for non-existent product', async () => {
    Product.findById.mockResolvedValue(null);

    const res = await request(app).get('/api/products/nonexistent');
    expect(res.statusCode).toEqual(404);
  });
});
