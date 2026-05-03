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
     User.findById.mockReturnValue({
       select: jest.fn().mockResolvedValue({ _id: 'admin123', role: 'admin', name: 'Admin' }),
     });
   });


  // ============ GET all products ============
  describe('GET /api/products', () => {
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

    it('should filter products by category', async () => {
      Product.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([{ name: 'Pouch 1' }]),
      });

      const res = await request(app).get('/api/products?category=Pouch');
      expect(res.statusCode).toEqual(200);
      expect(Product.find).toHaveBeenCalledWith({ category: 'Pouch' });
    });

    it('should search products', async () => {
      Product.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([{ name: 'Search Result' }]),
      });

      const res = await request(app).get('/api/products?search=test');
      expect(res.statusCode).toEqual(200);
      expect(Product.find).toHaveBeenCalledWith(expect.objectContaining({
        $or: expect.any(Array)
      }));
    });

    it('should return 500 on server error', async () => {
      Product.find.mockReturnValue({
        sort: jest.fn().mockRejectedValue(new Error('DB Error')),
      });

      const res = await request(app).get('/api/products');
      expect(res.statusCode).toEqual(500);
      expect(res.body.message).toBe('DB Error');
    });
  });

  // ============ GET product by ID ============
  describe('GET /api/products/:id', () => {
    it('should get a product by ID', async () => {
      Product.findById.mockResolvedValue({ name: 'Product 1', sku: 'SKU1', variants: [] });

      const res = await request(app).get('/api/products/prod123');
      expect(res.statusCode).toEqual(200);
      expect(res.body.name).toBe('Product 1');
    });

    it('should return 404 for non-existent product', async () => {
      Product.findById.mockResolvedValue(null);

      const res = await request(app).get('/api/products/nonexistent');
      expect(res.statusCode).toEqual(404);
    });

    it('should return 500 on server error', async () => {
      Product.findById.mockRejectedValue(new Error('DB Error'));

      const res = await request(app).get('/api/products/prod123');
      expect(res.statusCode).toEqual(500);
    });
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
      expect(res.body[0].totalSold).toBe(500);
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
      expect(res.body[0].totalSold).toBe(0);
    });

    it('should return 500 on server error', async () => {
      Order.aggregate.mockRejectedValue(new Error('Aggregation Error'));

      const res = await request(app).get('/api/products/popular');
      expect(res.statusCode).toEqual(500);
    });
  });

  // ============ POST create product ============
  describe('POST /api/products', () => {
    it('should create a product with valid payload', async () => {
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
        }),
      };

      Product.mockImplementation(() => mockProduct);

      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'New Product',
          category: 'Pouch',
          material: 'Plastic',
          sku: 'SKU-NEW',
          variants: [{ sku: 'V1', color: 'Red', size: 'S', priceB2C: 100, priceB2B: 80, stock: 10 }]
        });

      expect(res.statusCode).toEqual(201);
    });

    it('should upload images when files are provided', async () => {
      const mockProduct = {
        save: jest.fn().mockResolvedValue({ _id: 'p1' }),
      };
      Product.mockImplementation(() => mockProduct);

      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('images', Buffer.from('fake-image'), 'test.jpg')
        .field('name', 'Image Product')
        .field('category', 'Pouch')
        .field('material', 'Plastic')
        .field('variants', JSON.stringify([{ sku: 'V1', color: 'Red', size: 'S', priceB2C: 100, priceB2B: 80, stock: 10 }]));

      expect(res.statusCode).toEqual(201);
    });

    it('should handle legacy payload (single variant fields)', async () => {
      const mockProduct = {
        save: jest.fn().mockResolvedValue({ _id: 'p1' }),
      };
      Product.mockImplementation(() => mockProduct);

      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Legacy Product',
          category: 'Pouch',
          material: 'Plastic',
          sku: 'LEGACY-SKU',
          priceB2C: 1000,
          priceB2B: 800,
          stock: 50,
          color: 'Blue',
          size: 'M'
        });

      expect(res.statusCode).toEqual(201);
    });

    it('should return 400 for invalid variants format', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Product',
          category: 'Pouch',
          material: 'Plastic',
          variants: 'not-an-array'
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toMatch(/Format variants tidak valid|Format variants harus berupa array/);
    });

    it('should return 400 on save error', async () => {
      const mockProduct = {
        save: jest.fn().mockRejectedValue(new Error('Save Error')),
      };
      Product.mockImplementation(() => mockProduct);

      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Error Product',
          category: 'Pouch',
          material: 'Plastic',
          variants: [{ sku: 'V1', color: 'Red', size: 'S', priceB2C: 100, priceB2B: 80, stock: 10 }]
        });

      expect(res.statusCode).toEqual(400);
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

    it('should delete images from Cloudinary when deleteImageIds is provided', async () => {
      const mockProduct = {
        _id: 'prod123',
        images: [{ publicId: 'img1' }, { publicId: 'img2' }],
        save: jest.fn().mockResolvedValue({ _id: 'prod123' }),
      };
      Product.findById.mockResolvedValue(mockProduct);

      const res = await request(app)
        .put('/api/products/prod123')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ deleteImageIds: ['img1'] });

      expect(res.statusCode).toEqual(200);
      expect(mockProduct.images).toHaveLength(1);
      expect(mockProduct.images[0].publicId).toBe('img2');
    });

    it('should upload new images and append them', async () => {
      const mockProduct = {
        _id: 'prod123',
        images: [{ publicId: 'img1', url: 'url1' }],
        save: jest.fn().mockResolvedValue({ _id: 'prod123' }),
      };
      Product.findById.mockResolvedValue(mockProduct);

      const res = await request(app)
        .put('/api/products/prod123')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('images', Buffer.from('fake-image'), 'test.jpg')
        .field('name', 'Updated Name');

      expect(res.statusCode).toEqual(200);
      expect(mockProduct.images).toHaveLength(2);
    });

    it('should return 404 for non-existent product on update', async () => {
      Product.findById.mockResolvedValue(null);

      const res = await request(app)
        .put('/api/products/nonexistent')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated' });

      expect(res.statusCode).toEqual(404);
    });

    it('should return 400 on save error', async () => {
      const mockProduct = {
        _id: 'prod123',
        save: jest.fn().mockRejectedValue(new Error('Save Error')),
      };
      Product.findById.mockResolvedValue(mockProduct);

      const res = await request(app)
        .put('/api/products/prod123')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated' });

      expect(res.statusCode).toEqual(400);
    });
  });

  // ============ DELETE product ============
  describe('DELETE /api/products/:id', () => {
    it('should delete a product and its images', async () => {
      Product.findById.mockResolvedValue({
        _id: 'prod123',
        images: [{ publicId: 'img1' }, { publicId: 'img2' }],
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

    it('should return 500 on delete error', async () => {
      Product.findById.mockResolvedValue({ _id: 'p1' });
      Product.findByIdAndDelete.mockRejectedValue(new Error('Delete Error'));

      const res = await request(app)
        .delete('/api/products/p1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(500);
    });
  });

  // ============ GET low stock products ============
  describe('GET /api/products/low-stock', () => {
    it('should return low stock products', async () => {
      Product.find.mockResolvedValueOnce([
        { name: 'Low Stock Product', stockPolos: 100 },
      ]);
 
      const res = await request(app)
        .get('/api/products/low-stock')
        .set('Authorization', `Bearer ${adminToken}`);
 
      expect(res.statusCode).toEqual(200);
    });
 
    it('should return 500 on server error', async () => {
      Product.find.mockRejectedValueOnce(new Error('DB Error'));
 
      const res = await request(app)
        .get('/api/products/low-stock')
        .set('Authorization', `Bearer ${adminToken}`);
 
      expect(res.statusCode).toEqual(500);
    });


  });

  // ============ GET /api/products/export ============
  describe('GET /api/products/export', () => {
    it('should export products to excel', async () => {
      Product.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([
          { name: 'Prod 1', sku: 'S1', category: 'C1', material: 'M1', stockPolos: 10, minOrder: 100, variants: [] },
        ]),
      });

      const res = await request(app)
        .get('/api/products/export')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    });

    it('should return 500 on server error during export', async () => {
      Product.find.mockImplementation(() => {
        throw new Error('Export Error');
      });

      const res = await request(app)
        .get('/api/products/export')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(500);
    });
  });
});
