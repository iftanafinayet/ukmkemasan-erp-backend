const request = require('supertest');
const app = require('../../app');
const Product = require('../../models/Product');
const Order = require('../../models/Order');
const User = require('../../models/User');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

jest.mock('../../models/Product');
jest.mock('../../models/Order');
jest.mock('../../models/User');
jest.mock('../../config/db');
jest.mock('../../config/cloudinary', () => ({
  uploadToCloudinary: jest.fn().mockResolvedValue({ url: 'https://cdn.test/img.avif', publicId: 'products/img123' }),
  deleteFromCloudinary: jest.fn().mockResolvedValue(true),
}));

describe('Product Controller Unit Tests', () => {
  let adminToken;

  beforeAll(() => {
    adminToken = jwt.sign({ id: 'admin123', role: 'admin' }, process.env.JWT_SECRET || 'secret');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Default User.findById mock for admin auth
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: 'admin123', role: 'admin', name: 'Admin' }),
    });
  });

  // ============ GET all products ============
  it('should get all products', async () => {
    Product.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue([
        { name: 'Product 1', sku: 'SKU1', variants: [] },
        { name: 'Product 2', sku: 'SKU2', variants: [] },
      ]),
    });

    const res = await request(app).get('/api/products');
    expect(res.statusCode).toEqual(200);
    expect(res.body.length).toBe(2);
  });

  // ============ GET product by ID ============
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

  // ============ GET popular products ============
  describe('GET /api/products/popular', () => {
    it('should return popular products based on sales', async () => {
      Order.aggregate.mockResolvedValue([
        { _id: 'prod1', totalQuantity: 500 },
        { _id: 'prod2', totalQuantity: 300 },
      ]);

      Product.find.mockResolvedValue([
        { _id: { toString: () => 'prod1' }, name: 'Popular Product', sku: 'SKU1', variants: [] },
        { _id: { toString: () => 'prod2' }, name: 'Product 2', sku: 'SKU2', variants: [] },
      ]);

      const res = await request(app).get('/api/products/popular');
      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return fallback products when no sales data exists', async () => {
      Order.aggregate.mockResolvedValue([]);

      Product.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([
            { name: 'New Product', sku: 'SKU1', variants: [] },
          ]),
        }),
      });

      const res = await request(app).get('/api/products/popular');
      expect(res.statusCode).toEqual(200);
    });
  });

  // ============ POST create product ============
  describe('POST /api/products', () => {
    it('should create a product', async () => {
      const mockProduct = {
        _id: 'newprod123',
        name: 'New Product',
        sku: 'SKU-NEW',
        category: 'Pouch',
        material: 'Plastic',
        variants: [],
        save: jest.fn().mockResolvedValue({
          _id: 'newprod123',
          name: 'New Product',
          sku: 'SKU-NEW',
          category: 'Pouch',
        }),
      };

      // Mock Product constructor
      Product.mockImplementation(() => mockProduct);

      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'New Product',
          category: 'Pouch',
          material: 'Plastic',
          sku: 'SKU-NEW',
        });

      expect(res.statusCode).toEqual(201);
    });
  });

  // ============ PUT update product ============
  describe('PUT /api/products/:id', () => {
    it('should update a product', async () => {
      const mockProduct = {
        _id: 'prod123',
        name: 'Old Name',
        sku: 'SKU1',
        category: 'Pouch',
        images: [],
        variants: [],
        save: jest.fn().mockResolvedValue({
          _id: 'prod123',
          name: 'Updated Name',
        }),
      };

      Product.findById.mockResolvedValue(mockProduct);

      const res = await request(app)
        .put('/api/products/prod123')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Name' });

      expect(res.statusCode).toEqual(200);
    });

    it('should return 404 for non-existent product on update', async () => {
      Product.findById.mockResolvedValue(null);

      const res = await request(app)
        .put('/api/products/nonexistent')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated' });

      expect(res.statusCode).toEqual(404);
    });
  });

  // ============ DELETE product ============
  describe('DELETE /api/products/:id', () => {
    it('should delete a product', async () => {
      Product.findById.mockResolvedValue({
        _id: 'prod123',
        name: 'Product',
        images: [],
      });
      Product.findByIdAndDelete.mockResolvedValue(true);

      const res = await request(app)
        .delete('/api/products/prod123')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toMatch(/berhasil/i);
    });

    it('should return 404 for non-existent product on delete', async () => {
      Product.findById.mockResolvedValue(null);

      const res = await request(app)
        .delete('/api/products/nonexistent')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(404);
    });

    it('should delete cloudinary images when deleting product', async () => {
      const { deleteFromCloudinary } = require('../../config/cloudinary');

      Product.findById.mockResolvedValue({
        _id: 'prod123',
        images: [
          { publicId: 'products/img1', url: 'https://cdn.test/img1.avif' },
          { publicId: 'products/img2', url: 'https://cdn.test/img2.avif' },
        ],
      });
      Product.findByIdAndDelete.mockResolvedValue(true);

      const res = await request(app)
        .delete('/api/products/prod123')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(deleteFromCloudinary).toHaveBeenCalledTimes(2);
    });
  });

  // ============ GET low stock products ============
  describe('GET /api/products/low-stock', () => {
    it('should return low stock products', async () => {
      Product.find.mockResolvedValue([
        { name: 'Low Stock Product', stockPolos: 100 },
      ]);

      const res = await request(app)
        .get('/api/products/low-stock')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
    });
  });
});
