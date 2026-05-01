const request = require('supertest');
const app = require('../../app');
const Order = require('../../models/Order');
const Product = require('../../models/Product');
const Warehouse = require('../../models/Warehouse');
const StockCard = require('../../models/StockCard');
const calculateQuote = require('../../utils/quoteCalculator');
const jwt = require('jsonwebtoken');

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
  describe('POST /api/orders', () => {
    it('should create an order successfully', async () => {
      Product.findById.mockResolvedValue({
        _id: 'prod123',
        name: 'Test Product',
        sku: 'TEST-SKU',
        material: 'Plastic',
        variants: {
          id: jest.fn().mockReturnValue({ _id: 'var123', sku: 'SKU1', stock: 1000, size: '10x10', color: 'Clear' })
        },
        stockPolos: 1000,
      });
      Order.countDocuments.mockResolvedValue(10);
      Order.prototype.save = jest.fn().mockResolvedValue({
        _id: 'order123',
        orderNumber: 'UKM-2026-0011'
      });
      calculateQuote.mockReturnValue({
        unitPriceFinal: 1000,
        totalAmount: 100000
      });
      Product.findOneAndUpdate.mockResolvedValue({
        variants: {
          id: jest.fn().mockReturnValue({ stock: 900 })
        }
      });
      Warehouse.findOne.mockReturnValue({ sort: jest.fn().mockResolvedValue({ _id: 'wh123', name: 'Main Warehouse' }) });
      StockCard.create.mockResolvedValue({});

      const res = await request(app)
        .post('/api/orders')
        .send({
          productId: 'prod123',
          quantity: 100,
          variantId: 'var123',
          useValve: true
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('order');
    });

    it('should fail if stock is insufficient', async () => {
      Product.findById.mockResolvedValue({
        _id: 'prod123',
        name: 'Test Product',
        variants: {
          id: jest.fn().mockReturnValue({ sku: 'SKU1', stock: 10 })
        },
        stockPolos: 10,
        material: 'Plastic'
      });

      const res = await request(app)
        .post('/api/orders')
        .send({
          productId: 'prod123',
          quantity: 100,
          variantId: 'var123'
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toMatch(/Stok tidak mencukupi/);
    });
  });

  describe('GET /api/orders/myorders', () => {
    it('should get current user orders', async () => {
      Order.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue([
            { orderNumber: 'UKM-2026-0001', totalPrice: 100000 }
          ])
        })
      });

      const res = await request(app).get('/api/orders/myorders');
      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

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
        })
      };
      Order.findById.mockResolvedValue(mockOrder);
      Product.findOneAndUpdate.mockResolvedValue({
        stockPolos: 1100
      });
      Warehouse.findOne.mockReturnValue({ sort: jest.fn().mockResolvedValue({ _id: 'wh123' }) });
      StockCard.create.mockResolvedValue({});

      const res = await request(app)
        .put('/api/orders/order123/status')
        .send({ status: 'Cancelled' });

      expect(res.statusCode).toEqual(200);
      expect(res.body.status).toEqual('Cancelled');
    });
  });
});
