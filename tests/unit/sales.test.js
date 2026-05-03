const request = require('supertest');
const app = require('../../app');
const Invoice = require('../../models/Invoice');
const Order = require('../../models/Order');
const PaymentReceived = require('../../models/PaymentReceived');
const SalesReturn = require('../../models/SalesReturn');
const StockCard = require('../../models/StockCard');
const Warehouse = require('../../models/Warehouse');
const Product = require('../../models/Product');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

jest.mock('../../models/Invoice');
jest.mock('../../models/Order');
jest.mock('../../models/PaymentReceived');
jest.mock('../../models/SalesReturn');
jest.mock('../../models/StockCard');
jest.mock('../../models/Warehouse');
jest.mock('../../models/Product');
jest.mock('../../config/db');
jest.mock('../../middleware/authMiddleware', () => ({
  protect: (req, res, next) => {
    req.user = { _id: 'admin123', role: 'admin' };
    next();
  },
  admin: (req, res, next) => next(),
}));

// Helper: builds a mock query that forwards any chained method and finally resolves
const mockQuery = (result) => {
  const handler = {
    get(target, prop) {
      if (prop === 'then') {
        return (...args) => Promise.resolve(result).then(...args);
      }
      return jest.fn().mockReturnValue(new Proxy({}, handler));
    },
  };
  // Override 'then' so it resolves
  const proxy = new Proxy({}, handler);
  // Make it thenable so `await` works
  proxy.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return proxy;
};

// Helper: returns a mock that, no matter how many .populate/.sort are called, resolves to result
const chainableMock = (result) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.sort = jest.fn().mockReturnValue(chain);
  chain.select = jest.fn().mockReturnValue(chain);
  chain.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  chain[Symbol.iterator] = function* () { for (const item of result) yield item; };
  return chain;
};

describe('Sales Controller Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // GET /api/sales/invoices
  // ============================================================
  describe('GET /api/sales/invoices', () => {
    it('should list all invoices', async () => {
      const mockInvoices = [
        { _id: 'inv1', invoiceNumber: 'INV-2026-0001', totalAmount: 100000, paidAmount: 0, status: 'Issued', save: jest.fn() },
        { _id: 'inv2', invoiceNumber: 'INV-2026-0002', totalAmount: 50000, paidAmount: 50000, status: 'Paid', save: jest.fn() },
      ];

      Invoice.find.mockReturnValue(chainableMock(mockInvoices));

      const res = await request(app).get('/api/sales/invoices');
      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return 500 on server error', async () => {
      Invoice.find.mockImplementation(() => {
        throw new Error('DB Error');
      });

      const res = await request(app).get('/api/sales/invoices');
      expect(res.statusCode).toEqual(500);
    });
  });

  // ============================================================
  // POST /api/sales/invoices
  // ============================================================
  describe('POST /api/sales/invoices', () => {
    it('should create an invoice from a valid order', async () => {
      const mockOrder = {
        _id: 'order123',
        orderNumber: 'UKM-2026-0001',
        customer: { _id: 'cust123', name: 'Test' },
        product: { _id: 'prod123', name: 'Product' },
        totalPrice: 100000,
        status: 'Quotation',
        details: { quantity: 100, unitPrice: 1000 },
        save: jest.fn().mockResolvedValue(true),
      };

      // createInvoice calls: Order.findById(orderId).populate().populate()
      Order.findById.mockReturnValue(chainableMock(mockOrder));
      Invoice.findOne.mockResolvedValue(null);
      Invoice.countDocuments.mockResolvedValue(0);

      const createdInvoice = {
        _id: 'inv123',
        invoiceNumber: 'INV-2026-0001',
        totalAmount: 100000,
        paidAmount: 0,
        status: 'Issued',
      };
      Invoice.create.mockResolvedValue(createdInvoice);
      // populateInvoiceQuery(Invoice.findById(invoice._id))
      Invoice.findById.mockReturnValue(chainableMock(createdInvoice));

      const res = await request(app)
        .post('/api/sales/invoices')
        .send({ orderId: 'order123' });

      expect(res.statusCode).toEqual(201);
    });

    it('should return 404 if order not found', async () => {
      Order.findById.mockReturnValue(chainableMock(null));

      const res = await request(app)
        .post('/api/sales/invoices')
        .send({ orderId: 'nonexistent' });

      expect(res.statusCode).toEqual(404);
    });

    it('should return 400 if invoice already exists for order', async () => {
      const mockOrder = {
        _id: 'order123',
        customer: { _id: 'cust123' },
        product: { _id: 'prod123' },
        totalPrice: 100000,
        details: { quantity: 100, unitPrice: 1000 },
      };

      Order.findById.mockReturnValue(chainableMock(mockOrder));
      Invoice.findOne.mockResolvedValue({ _id: 'existing-inv' });

      const res = await request(app)
        .post('/api/sales/invoices')
        .send({ orderId: 'order123' });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toMatch(/sudah ada/i);
    });

    it('should return 400 for invalid due date', async () => {
      const mockOrder = {
        _id: 'order123',
        customer: { _id: 'cust123' },
        product: { _id: 'prod123' },
        totalPrice: 100000,
        details: { quantity: 100, unitPrice: 1000 },
      };

      Order.findById.mockReturnValue(chainableMock(mockOrder));
      Invoice.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/sales/invoices')
        .send({ orderId: 'order123', dueDate: 'not-a-date' });

      expect(res.statusCode).toEqual(400);
    });

    it('should return 400 if order data is not ready for invoice', async () => {
      const mockOrder = {
        _id: 'order123',
        customer: { _id: 'cust123' },
        product: { _id: 'prod123' },
        totalPrice: 0,
        details: { quantity: 0, unitPrice: 0 },
      };

      Order.findById.mockReturnValue(chainableMock(mockOrder));
      Invoice.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/sales/invoices')
        .send({ orderId: 'order123' });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toMatch(/belum siap/i);
    });

    it('should return 400 on server error', async () => {
      Order.findById.mockImplementation(() => {
        throw new Error('DB Error');
      });

      const res = await request(app)
        .post('/api/sales/invoices')
        .send({ orderId: 'order123' });

      expect(res.statusCode).toEqual(400);
    });
  });

  // ============================================================
  // GET /api/sales/payments
  // ============================================================
  describe('GET /api/sales/payments', () => {
    it('should list all payments', async () => {
      const mockPayments = [
        { _id: 'pay1', amount: 50000 },
      ];

      PaymentReceived.find.mockReturnValue(chainableMock(mockPayments));

      const res = await request(app).get('/api/sales/payments');
      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return 500 on server error', async () => {
      PaymentReceived.find.mockImplementation(() => {
        throw new Error('DB Error');
      });

      const res = await request(app).get('/api/sales/payments');
      expect(res.statusCode).toEqual(500);
    });
  });

  // ============================================================
  // POST /api/sales/payments
  // ============================================================
  describe('POST /api/sales/payments', () => {
    it('should create a payment receipt successfully', async () => {
      const mockInvoice = {
        _id: 'inv123',
        order: 'order123',
        customer: 'cust123',
        totalAmount: 100000,
        paidAmount: 0,
        status: 'Issued',
        dueDate: new Date('2099-01-01'),
        save: jest.fn().mockResolvedValue(true),
      };

      Invoice.findById.mockResolvedValue(mockInvoice);

      const mockPayment = {
        _id: 'pay123',
        paymentNumber: 'PAY-2026-0001',
        amount: 50000,
      };
      PaymentReceived.create.mockResolvedValue(mockPayment);
      PaymentReceived.countDocuments.mockResolvedValue(0);
      PaymentReceived.findById.mockReturnValue(chainableMock(mockPayment));

      // syncOrderCommercialStatus
      Order.findById.mockResolvedValue({
        _id: 'order123',
        status: 'Payment',
        isPaid: false,
        save: jest.fn().mockResolvedValue(true),
      });
      Invoice.findOne.mockResolvedValue(mockInvoice);

      const res = await request(app)
        .post('/api/sales/payments')
        .send({ invoiceId: 'inv123', amount: 50000 });

      expect(res.statusCode).toEqual(201);
    });

    it('should return 404 if invoice not found', async () => {
      Invoice.findById.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/sales/payments')
        .send({ invoiceId: 'nonexistent', amount: 50000 });

      expect(res.statusCode).toEqual(404);
    });

    it('should return 400 for zero amount', async () => {
      const mockInvoice = {
        _id: 'inv123',
        totalAmount: 100000,
        paidAmount: 0,
        status: 'Issued',
        dueDate: new Date('2099-01-01'),
        save: jest.fn(),
      };
      Invoice.findById.mockResolvedValue(mockInvoice);

      const res = await request(app)
        .post('/api/sales/payments')
        .send({ invoiceId: 'inv123', amount: 0 });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toMatch(/lebih besar dari 0/i);
    });

    it('should return 400 if amount exceeds outstanding', async () => {
      const mockInvoice = {
        _id: 'inv123',
        totalAmount: 100000,
        paidAmount: 80000,
        status: 'Partially Paid',
        dueDate: new Date('2099-01-01'),
        save: jest.fn(),
      };
      Invoice.findById.mockResolvedValue(mockInvoice);

      const res = await request(app)
        .post('/api/sales/payments')
        .send({ invoiceId: 'inv123', amount: 30000 });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toMatch(/melebihi/i);
    });

    it('should return 400 if payment date is invalid', async () => {
      const mockInvoice = {
        _id: 'inv123',
        totalAmount: 100000,
        paidAmount: 0,
        save: jest.fn(),
      };
      Invoice.findById.mockResolvedValue(mockInvoice);

      const res = await request(app)
        .post('/api/sales/payments')
        .send({ invoiceId: 'inv123', amount: 50000, paymentDate: 'invalid-date' });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toMatch(/Tanggal pembayaran tidak valid/i);
    });

    it('should return 400 on server error', async () => {
      Invoice.findById.mockImplementation(() => {
        throw new Error('DB Error');
      });

      const res = await request(app)
        .post('/api/sales/payments')
        .send({ invoiceId: 'inv123', amount: 50000 });

      expect(res.statusCode).toEqual(400);
    });
  });
 
  // ============================================================

  // GET /api/sales/returns
  // ============================================================

  describe('GET /api/sales/returns', () => {
    it('should list all sales returns', async () => {
      const mockReturns = [{ _id: 'ret1', quantity: 10 }];

      SalesReturn.find.mockReturnValue(chainableMock(mockReturns));

      const res = await request(app).get('/api/sales/returns');
      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return 500 on server error', async () => {
      SalesReturn.find.mockImplementation(() => {
        throw new Error('DB Error');
      });

      const res = await request(app).get('/api/sales/returns');
      expect(res.statusCode).toEqual(500);
    });
  });

  // ============================================================
  // POST /api/sales/returns
  // ============================================================
  describe('POST /api/sales/returns', () => {
    it('should create a sales return with restock', async () => {
      const mockOrder = {
        _id: 'order123',
        customer: 'cust123',
        product: 'prod123',
        details: { quantity: 100, unitPrice: 1000 },
      };
      const mockProduct = {
        _id: 'prod123',
        stockPolos: 900,
        save: jest.fn().mockResolvedValue(true),
      };
      const mockWarehouse = {
        _id: 'wh123',
        isActive: true,
        type: 'Main',
      };

      Order.findById.mockResolvedValue(mockOrder);
      Invoice.findById.mockResolvedValue(null);
      Warehouse.findById.mockResolvedValue(null);
      Warehouse.findOne.mockReturnValue({ sort: jest.fn().mockResolvedValue(mockWarehouse) });
      Product.findById.mockResolvedValue(mockProduct);
      SalesReturn.find.mockResolvedValue([]);
      SalesReturn.countDocuments.mockResolvedValue(0);

      const createdReturn = {
        _id: 'ret123',
        returnNumber: 'RET-2026-0001',
        quantity: 10,
        totalAmount: 10000,
      };
      SalesReturn.create.mockResolvedValue(createdReturn);
      SalesReturn.findById.mockReturnValue(chainableMock(createdReturn));
      StockCard.create.mockResolvedValue({});

      const res = await request(app)
        .post('/api/sales/returns')
        .send({
          orderId: 'order123',
          quantity: 10,
          reason: 'Produk cacat',
          restocked: true,
        });

      expect(res.statusCode).toEqual(201);
    });

    it('should return 404 if order not found', async () => {
      Order.findById.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/sales/returns')
        .send({ orderId: 'nonexistent', quantity: 10, reason: 'Defect' });

      expect(res.statusCode).toEqual(404);
    });

    it('should return 400 if return quantity exceeds limit', async () => {
      const mockOrder = {
        _id: 'order123',
        customer: 'cust123',
        product: 'prod123',
        details: { quantity: 100 },
      };
      const mockProduct = { _id: 'prod123', stockPolos: 900 };

      Order.findById.mockResolvedValue(mockOrder);
      Invoice.findById.mockResolvedValue(null);
      Warehouse.findById.mockResolvedValue(null);
      Product.findById.mockResolvedValue(mockProduct);
      SalesReturn.find.mockResolvedValue([{ quantity: 95 }]);

      const res = await request(app)
        .post('/api/sales/returns')
        .send({ orderId: 'order123', quantity: 10, reason: 'Defect' });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toMatch(/Maksimal retur/i);
    });

    it('should return 400 if reason is missing', async () => {
      const res = await request(app)
        .post('/api/sales/returns')
        .send({ orderId: 'order123', quantity: 10 });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toMatch(/Alasan/i);
    });

    it('should return 400 for zero quantity', async () => {
      const res = await request(app)
        .post('/api/sales/returns')
        .send({ orderId: 'order123', quantity: 0, reason: 'Defect' });

      expect(res.statusCode).toEqual(400);
    });

    it('should return 400 for invalid return date', async () => {
      const mockOrder = {
        _id: 'order123',
        details: { quantity: 100 },
      };
      Order.findById.mockResolvedValue(mockOrder);
      Invoice.findById.mockResolvedValue(null);
      Warehouse.findById.mockResolvedValue(null);
      Product.findById.mockResolvedValue({ _id: 'p1' });
      SalesReturn.find.mockResolvedValue([]);

      const res = await request(app)
        .post('/api/sales/returns')
        .send({ orderId: 'order123', quantity: 10, reason: 'Defect', returnDate: 'invalid-date' });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toMatch(/Tanggal retur tidak valid/i);
    });

    it('should return 404 if product not found', async () => {
      const mockOrder = { _id: 'order123', product: 'prod123' };
      Order.findById.mockResolvedValue(mockOrder);
      Product.findById.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/sales/returns')
        .send({ orderId: 'order123', quantity: 10, reason: 'Defect' });

      expect(res.statusCode).toEqual(404);
      expect(res.body.message).toMatch(/Produk pada order tidak ditemukan/i);
    });

    it('should return 400 if warehouse is inactive', async () => {
      const mockOrder = { _id: 'order123', product: 'prod123', details: { quantity: 100 } };
      const mockWarehouse = { _id: 'wh1', isActive: false };
      Order.findById.mockResolvedValue(mockOrder);
      Warehouse.findById.mockResolvedValue(mockWarehouse);
      Product.findById.mockResolvedValue({ _id: 'p1' });
      SalesReturn.find.mockResolvedValue([]);

      const res = await request(app)
        .post('/api/sales/returns')
        .send({ orderId: 'order123', warehouseId: 'wh1', quantity: 10, reason: 'Defect' });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toMatch(/Gudang nonaktif/i);
    });

    it('should return 400 on server error', async () => {
      Order.findById.mockImplementation(() => {
        throw new Error('DB Error');
      });

      const res = await request(app)
        .post('/api/sales/returns')
        .send({ orderId: 'order123', quantity: 10, reason: 'Defect' });

      expect(res.statusCode).toEqual(400);
    });
  });
 
  // ============================================================

  // GET /api/sales/overview
  // ============================================================
  describe('GET /api/sales/overview', () => {
    it('should return sales overview with summary', async () => {
      const mockOrders = [
        {
          _id: 'order1',
          orderNumber: 'UKM-2026-0001',
          totalPrice: 100000,
          status: 'Payment',
          details: { quantity: 100 },
          toObject: jest.fn().mockReturnValue({
            _id: 'order1',
            orderNumber: 'UKM-2026-0001',
            totalPrice: 100000,
            details: { quantity: 100 },
          }),
        },
      ];

      const mockInvoices = [
        {
          _id: 'inv1',
          order: { _id: 'order1' },
          totalAmount: 100000,
          paidAmount: 50000,
          status: 'Partially Paid',
          save: jest.fn(),
        },
      ];

      const mockPayments = [{ _id: 'pay1', amount: 50000 }];
      const mockReturns = [];
      const mockWarehouses = [{ _id: 'wh1', name: 'Main' }];

      Order.find.mockReturnValue(chainableMock(mockOrders));
      Invoice.find.mockReturnValue(chainableMock(mockInvoices));
      PaymentReceived.find.mockReturnValue(chainableMock(mockPayments));
      SalesReturn.find.mockReturnValue(chainableMock(mockReturns));
      Warehouse.find.mockReturnValue(chainableMock(mockWarehouses));

      const res = await request(app).get('/api/sales/overview');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('summary');
      expect(res.body).toHaveProperty('processing');
      expect(res.body).toHaveProperty('invoices');
    });

    it('should return 500 on server error', async () => {
      Order.find.mockImplementation(() => {
        throw new Error('DB Error');
      });

      const res = await request(app).get('/api/sales/overview');
      expect(res.statusCode).toEqual(500);
    });
    it('should return 500 on server error during export invoices', async () => {
      Invoice.find.mockImplementation(() => {
        throw new Error('Export Error');
      });

      const res = await request(app).get('/api/sales/invoices/export');
      expect(res.statusCode).toEqual(500);
    });
 
    it('should return 500 on server error during export overview', async () => {
      Order.find.mockImplementation(() => {
        throw new Error('Export Error');
      });
 
      const res = await request(app).get('/api/sales/overview/export');
      expect(res.statusCode).toEqual(500);
    });

  });
});
