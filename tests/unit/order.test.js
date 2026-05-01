const request = require('supertest');
const app = require('../../app');
const Order = require('../../models/Order');
const Product = require('../../models/Product');
const Warehouse = require('../../models/Warehouse');
const StockCard = require('../../models/StockCard');
const calculateQuote = require('../../utils/quoteCalculator');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

jest.mock('../../models/Order');
jest.mock('../../models/Product');
jest.mock('../../models/Warehouse');
jest.mock('../../models/StockCard');
jest.mock('../../utils/quoteCalculator');
jest.mock('../../config/db');
jest.mock('../../middleware/authMiddleware', () => ({
  protect: (req, res, next) => {
    req.user = { _id: 'user123', role: 'customer' };
    next();
  },
  admin: (req, res, next) => next(),
}));

describe('Order Controller Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============ POST /api/orders ============
  describe('POST /api/orders', () => {
    it('should create an order successfully', async () => {
      Product.findById.mockResolvedValue({
        _id: 'prod123',
        name: 'Test Product',
        sku: 'TEST-SKU',
        material: 'Plastic',
        variants: {
          id: jest.fn().mockReturnValue({ _id: 'var123', sku: 'SKU1', stock: 1000, size: '10x10', color: 'Clear' }),
        },
        stockPolos: 1000,
      });
      Order.countDocuments.mockResolvedValue(10);
      Order.prototype.save = jest.fn().mockResolvedValue({
        _id: 'order123',
        orderNumber: 'UKM-2026-0011',
      });
      calculateQuote.mockReturnValue({
        unitPriceFinal: 1000,
        totalAmount: 100000,
      });
      Product.findOneAndUpdate.mockResolvedValue({
        variants: {
          id: jest.fn().mockReturnValue({ stock: 900 }),
        },
      });
      Warehouse.findOne.mockReturnValue({ sort: jest.fn().mockResolvedValue({ _id: 'wh123', name: 'Main Warehouse' }) });
      StockCard.create.mockResolvedValue({});

      const res = await request(app)
        .post('/api/orders')
        .send({
          productId: 'prod123',
          quantity: 100,
          variantId: 'var123',
          useValve: true,
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('order');
    });

    it('should fail if stock is insufficient', async () => {
      Product.findById.mockResolvedValue({
        _id: 'prod123',
        name: 'Test Product',
        variants: {
          id: jest.fn().mockReturnValue({ sku: 'SKU1', stock: 10 }),
        },
        stockPolos: 10,
        material: 'Plastic',
      });

      const res = await request(app)
        .post('/api/orders')
        .send({
          productId: 'prod123',
          quantity: 100,
          variantId: 'var123',
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toMatch(/Stok tidak mencukupi/);
    });

    it('should fail for non-multiple-of-100 quantity', async () => {
      Product.findById.mockResolvedValue({
        _id: 'prod123',
        name: 'Test Product',
        material: 'Plastic',
        variants: { id: jest.fn().mockReturnValue({ stock: 1000 }) },
        stockPolos: 1000,
      });

      const res = await request(app)
        .post('/api/orders')
        .send({
          productId: 'prod123',
          quantity: 75,
          variantId: 'var123',
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toMatch(/kelipatan 100/i);
    });

    it('should fail for zero quantity', async () => {
      const res = await request(app)
        .post('/api/orders')
        .send({
          productId: 'prod123',
          quantity: 0,
        });

      expect(res.statusCode).toEqual(400);
    });

    it('should return 404 for non-existent product', async () => {
      Product.findById.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/orders')
        .send({
          productId: 'nonexistent',
          quantity: 100,
        });

      expect(res.statusCode).toEqual(404);
    });

    it('should fail if variant not found', async () => {
      Product.findById.mockResolvedValue({
        _id: 'prod123',
        name: 'Test Product',
        material: 'Plastic',
        variants: { id: jest.fn().mockReturnValue(null) },
        stockPolos: 1000,
      });

      const res = await request(app)
        .post('/api/orders')
        .send({
          productId: 'prod123',
          quantity: 100,
          variantId: 'nonexistent-variant',
        });

      expect(res.statusCode).toEqual(400);
    });
  });

  // ============ GET /api/orders/myorders ============
  describe('GET /api/orders/myorders', () => {
    it('should get current user orders', async () => {
      Order.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue([
            { orderNumber: 'UKM-2026-0001', totalPrice: 100000 },
          ]),
        }),
      });

      const res = await request(app).get('/api/orders/myorders');
      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ============ GET /api/orders/:id ============
  describe('GET /api/orders/:id', () => {
    it('should return order by ID for owner', async () => {
      const mockOrder = {
        _id: 'order123',
        orderNumber: 'UKM-2026-0001',
        customer: { _id: 'user123', name: 'Test' },
        product: { _id: 'prod123', name: 'Product' },
      };
      Order.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockOrder),
        }),
      });

      const res = await request(app).get('/api/orders/order123');
      expect(res.statusCode).toEqual(200);
    });

    it('should return 403 if not owner and not admin', async () => {
      const mockOrder = {
        _id: 'order123',
        customer: { _id: 'otheruser', name: 'Other' },
        product: { _id: 'prod123' },
      };
      Order.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockOrder),
        }),
      });

      const res = await request(app).get('/api/orders/order123');
      expect(res.statusCode).toEqual(403);
    });

    it('should return 404 for non-existent order', async () => {
      Order.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(null),
        }),
      });

      const res = await request(app).get('/api/orders/nonexistent');
      expect(res.statusCode).toEqual(404);
    });
  });

  // ============ PUT /api/orders/:id/status ============
  describe('PUT /api/orders/:id/status', () => {
    it('should update order status as admin', async () => {
      const mockOrder = {
        _id: 'order123',
        orderNumber: 'UKM-2026-0001',
        status: 'Pending',
        isPaid: false,
        details: { productId: 'prod123', quantity: 100 },
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(mockOrder);
        }),
        toJSON: jest.fn().mockImplementation(function () {
          return { ...mockOrder };
        }),
      };
      Order.findById.mockResolvedValue(mockOrder);
      Product.findOneAndUpdate.mockResolvedValue({
        stockPolos: 1100,
      });
      Warehouse.findOne.mockReturnValue({ sort: jest.fn().mockResolvedValue({ _id: 'wh123' }) });
      StockCard.create.mockResolvedValue({});

      const res = await request(app)
        .put('/api/orders/order123/status')
        .send({ status: 'Cancelled' });

      expect(res.statusCode).toEqual(200);
      expect(res.body.status).toEqual('Cancelled');
    });

    it('should return 404 for non-existent order', async () => {
      Order.findById.mockResolvedValue(null);

      const res = await request(app)
        .put('/api/orders/nonexistent/status')
        .send({ status: 'Cancelled' });

      expect(res.statusCode).toEqual(404);
    });

    it('should update non-cancellation status without stock restoration', async () => {
      const mockOrder = {
        _id: 'order123',
        status: 'Pending',
        isPaid: false,
        details: { productId: 'prod123', quantity: 100 },
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(mockOrder);
        }),
      };
      Order.findById.mockResolvedValue(mockOrder);

      const res = await request(app)
        .put('/api/orders/order123/status')
        .send({ status: 'Production' });

      expect(res.statusCode).toEqual(200);
      // Stock-related functions should not be called for non-cancellation
      expect(Product.findOneAndUpdate).not.toHaveBeenCalled();
    });
  });
});
