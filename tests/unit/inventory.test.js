const request = require('supertest');
const app = require('../../app');
const Warehouse = require('../../models/Warehouse');
const InventoryAdjustment = require('../../models/InventoryAdjustment');
const StockCard = require('../../models/StockCard');
const Product = require('../../models/Product');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

jest.mock('../../models/Warehouse');
jest.mock('../../models/InventoryAdjustment');
jest.mock('../../models/StockCard');
jest.mock('../../models/Product');
jest.mock('../../config/db');
jest.mock('../../middleware/authMiddleware', () => ({
  protect: (req, res, next) => {
    req.user = { _id: 'admin123', role: 'admin' };
    next();
  },
  admin: (req, res, next) => next(),
}));

describe('Inventory Controller Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============ GET Warehouses ============
  describe('GET /api/inventory/warehouses', () => {
    it('should get all warehouses', async () => {
      Warehouse.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([
          { _id: 'wh1', name: 'Main', type: 'Main', isActive: true },
        ]),
      });

      const res = await request(app).get('/api/inventory/warehouses');
      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should filter warehouses by type', async () => {
      Warehouse.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([
          { _id: 'wh1', name: 'Main', type: 'Main' },
        ]),
      });

      const res = await request(app).get('/api/inventory/warehouses?type=Main');
      expect(res.statusCode).toEqual(200);
    });

    it('should filter active warehouses', async () => {
      Warehouse.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      });

      const res = await request(app).get('/api/inventory/warehouses?active=true');
      expect(res.statusCode).toEqual(200);
    });
  });

  // ============ POST Create Warehouse ============
  describe('POST /api/inventory/warehouses', () => {
    it('should create a warehouse', async () => {
      Warehouse.findOne.mockResolvedValue(null);
      Warehouse.create.mockResolvedValue({
        _id: 'wh123',
        name: 'New Warehouse',
        type: 'Main',
      });

      const res = await request(app)
        .post('/api/inventory/warehouses')
        .send({ name: 'New Warehouse', type: 'Main' });

      expect(res.statusCode).toEqual(201);
    });

    it('should return 400 for missing name', async () => {
      const res = await request(app)
        .post('/api/inventory/warehouses')
        .send({ type: 'Main' });

      expect(res.statusCode).toEqual(400);
    });

    it('should return 400 for duplicate warehouse', async () => {
      Warehouse.findOne.mockResolvedValue({ _id: 'existing' });

      const res = await request(app)
        .post('/api/inventory/warehouses')
        .send({ name: 'Main', type: 'Main' });

      expect(res.statusCode).toEqual(400);
    });
  });

  // ============ PUT Update Warehouse ============
  describe('PUT /api/inventory/warehouses/:id', () => {
    it('should update a warehouse', async () => {
      const mockWarehouse = {
        _id: 'wh123',
        name: 'Old Name',
        type: 'Main',
        location: '',
        isActive: true,
        save: jest.fn().mockResolvedValue({
          _id: 'wh123',
          name: 'Updated Name',
          type: 'Main',
        }),
      };
      Warehouse.findById.mockResolvedValue(mockWarehouse);
      Warehouse.findOne.mockResolvedValue(null); // no duplicate

      const res = await request(app)
        .put('/api/inventory/warehouses/wh123')
        .send({ name: 'Updated Name' });

      expect(res.statusCode).toEqual(200);
    });

    it('should return 404 for non-existent warehouse', async () => {
      Warehouse.findById.mockResolvedValue(null);

      const res = await request(app)
        .put('/api/inventory/warehouses/nonexistent')
        .send({ name: 'Updated' });

      expect(res.statusCode).toEqual(404);
    });

    it('should return 400 for duplicate name+type on update', async () => {
      const mockWarehouse = {
        _id: 'wh123',
        name: 'Old Name',
        type: 'Main',
        location: '',
        isActive: true,
        save: jest.fn(),
      };
      Warehouse.findById.mockResolvedValue(mockWarehouse);
      Warehouse.findOne.mockResolvedValue({ _id: 'other-wh' }); // duplicate exists

      const res = await request(app)
        .put('/api/inventory/warehouses/wh123')
        .send({ name: 'Duplicate Name' });

      expect(res.statusCode).toEqual(400);
    });
  });

  // ============ DELETE Warehouse ============
  describe('DELETE /api/inventory/warehouses/:id', () => {
    it('should delete a warehouse with no history', async () => {
      const mockWarehouse = {
        _id: 'wh123',
        deleteOne: jest.fn().mockResolvedValue(true),
      };
      Warehouse.findById.mockResolvedValue(mockWarehouse);
      InventoryAdjustment.countDocuments.mockResolvedValue(0);
      StockCard.countDocuments.mockResolvedValue(0);

      const res = await request(app).delete('/api/inventory/warehouses/wh123');
      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toMatch(/berhasil/i);
    });

    it('should return 404 for non-existent warehouse', async () => {
      Warehouse.findById.mockResolvedValue(null);

      const res = await request(app).delete('/api/inventory/warehouses/nonexistent');
      expect(res.statusCode).toEqual(404);
    });

    it('should return 400 if warehouse has stock history', async () => {
      Warehouse.findById.mockResolvedValue({ _id: 'wh123' });
      InventoryAdjustment.countDocuments.mockResolvedValue(5);
      StockCard.countDocuments.mockResolvedValue(3);

      const res = await request(app).delete('/api/inventory/warehouses/wh123');
      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toMatch(/histori/i);
    });
  });

  // ============ POST Adjustment ============
  describe('POST /api/inventory/adjustments', () => {
    it('should create a stock-in adjustment', async () => {
      const mockProduct = {
        _id: 'prod123',
        name: 'Test Product',
        sku: 'SKU1',
        stockPolos: 100,
        variants: [],
        save: jest.fn().mockResolvedValue(true),
      };
      const mockWarehouse = { _id: 'wh123', isActive: true };
      const createdAdj = {
        _id: 'adj123',
        toObject: jest.fn().mockReturnValue({ _id: 'adj123', type: 'In', quantity: 50 }),
      };

      Product.findById.mockResolvedValue(mockProduct);
      Warehouse.findById.mockResolvedValue(mockWarehouse);
      InventoryAdjustment.create.mockResolvedValue(createdAdj);
      InventoryAdjustment.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(createdAdj),
        }),
      });
      StockCard.create.mockResolvedValue({});

      const res = await request(app)
        .post('/api/inventory/adjustments')
        .send({
          productId: 'prod123',
          warehouseId: 'wh123',
          type: 'In',
          quantity: 50,
          reason: 'Restock from supplier',
        });

      expect(res.statusCode).toEqual(201);
    });

    it('should return 400 for stock-out exceeding available stock', async () => {
      const mockProduct = {
        _id: 'prod123',
        stockPolos: 10,
        variants: [],
      };
      Product.findById.mockResolvedValue(mockProduct);
      Warehouse.findById.mockResolvedValue({ _id: 'wh123', isActive: true });

      const res = await request(app)
        .post('/api/inventory/adjustments')
        .send({
          productId: 'prod123',
          warehouseId: 'wh123',
          type: 'Out',
          quantity: 50,
          reason: 'Damaged goods',
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toMatch(/Stok tidak mencukupi/i);
    });

    it('should return 400 for invalid adjustment type', async () => {
      Product.findById.mockResolvedValue({ _id: 'prod123', variants: [] });
      Warehouse.findById.mockResolvedValue({ _id: 'wh123', isActive: true });

      const res = await request(app)
        .post('/api/inventory/adjustments')
        .send({
          productId: 'prod123',
          warehouseId: 'wh123',
          type: 'Invalid',
          quantity: 10,
          reason: 'Test',
        });

      expect(res.statusCode).toEqual(400);
    });

    it('should return 400 for missing reason', async () => {
      Product.findById.mockResolvedValue({ _id: 'prod123', variants: [] });
      Warehouse.findById.mockResolvedValue({ _id: 'wh123', isActive: true });

      const res = await request(app)
        .post('/api/inventory/adjustments')
        .send({
          productId: 'prod123',
          warehouseId: 'wh123',
          type: 'In',
          quantity: 10,
        });

      expect(res.statusCode).toEqual(400);
    });

    it('should return 400 for inactive warehouse', async () => {
      Product.findById.mockResolvedValue({ _id: 'prod123', variants: [] });
      Warehouse.findById.mockResolvedValue({ _id: 'wh123', isActive: false });

      const res = await request(app)
        .post('/api/inventory/adjustments')
        .send({
          productId: 'prod123',
          warehouseId: 'wh123',
          type: 'In',
          quantity: 10,
          reason: 'Test',
        });

      expect(res.statusCode).toEqual(400);
    });

    it('should return 404 for non-existent product', async () => {
      Product.findById.mockResolvedValue(null);
      Warehouse.findById.mockResolvedValue({ _id: 'wh123', isActive: true });

      const res = await request(app)
        .post('/api/inventory/adjustments')
        .send({
          productId: 'nonexistent',
          warehouseId: 'wh123',
          type: 'In',
          quantity: 10,
          reason: 'Test',
        });

      expect(res.statusCode).toEqual(404);
    });
  });

  // ============ GET Stock Cards ============
  describe('GET /api/inventory/stock-cards/:productId', () => {
    it('should return stock cards for a product', async () => {
      StockCard.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue([
              { product: 'prod123', quantityChange: -50, balanceAfter: 950 },
            ]),
          }),
        }),
      });

      const res = await request(app).get('/api/inventory/stock-cards/prod123');
      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ============ GET Product Options ============
  describe('GET /api/inventory/products', () => {
    it('should return product options', async () => {
      Product.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue([
            {
              _id: 'prod123',
              name: 'Product 1',
              sku: 'SKU1',
              category: 'Pouch',
              material: 'Plastic',
              stockPolos: 100,
              variants: [],
            },
          ]),
        }),
      });

      const res = await request(app).get('/api/inventory/products');
      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
