const request = require('supertest');
const crypto = require('crypto');
const app = require('../../app');
const Order = require('../../models/Order');
const Invoice = require('../../models/Invoice');
const PaymentReceived = require('../../models/PaymentReceived');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

jest.mock('../../models/Order');
jest.mock('../../models/Invoice');
jest.mock('../../models/PaymentReceived');
jest.mock('../../config/db');
jest.mock('../../middleware/authMiddleware', () => ({
  protect: (req, res, next) => {
    req.user = { _id: 'user123', role: 'customer' };
    next();
  },
  admin: (req, res, next) => next(),
}));

// Mock global fetch for Midtrans
global.fetch = jest.fn();

const buildPopulateChain = (result) => ({
  populate: jest.fn().mockReturnValue({
    populate: jest.fn().mockResolvedValue(result),
  }),
});

describe('Payment Controller Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.MIDTRANS_SERVER_KEY;
    delete process.env.MIDTRANS_CLIENT_KEY;
  });

  describe('GET /api/payments/orders/:orderId (getOrderPaymentSummary)', () => {
    it('should return payment summary for valid order', async () => {
      const mockOrder = {
        _id: 'order123',
        orderNumber: 'UKM-2026-0001',
        customer: { _id: 'user123', name: 'Test', email: 't@t.com', phone: '08123' },
        product: { _id: 'prod123', name: 'Product', sku: 'SKU1', category: 'Pouch' },
        totalPrice: 100000,
        status: 'Payment',
        details: { quantity: 100, unitPrice: 1000 },
      };

      Order.findById.mockReturnValue(buildPopulateChain(mockOrder));

      const mockInvoice = {
        _id: 'inv123',
        order: 'order123',
        customer: 'user123',
        product: 'prod123',
        totalAmount: 100000,
        paidAmount: 0,
        status: 'Issued',
        lastMidtransOrderId: null,
        save: jest.fn().mockResolvedValue(true),
      };
      Invoice.findOne.mockResolvedValue(mockInvoice);

      PaymentReceived.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue([]),
        }),
      });

      // Re-mock Order.findById for the refreshed order lookup
      Order.findById
        .mockReturnValueOnce(buildPopulateChain(mockOrder))
        .mockReturnValueOnce(buildPopulateChain(mockOrder));

      const res = await request(app).get('/api/payments/orders/order123');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('invoice');
      expect(res.body).toHaveProperty('paymentSummary');
    });

    it('should return 404 if order not found', async () => {
      Order.findById.mockReturnValue(buildPopulateChain(null));

      const res = await request(app).get('/api/payments/orders/nonexistent');
      expect(res.statusCode).toEqual(404);
    });

    it('should return 403 if user is not owner and not admin', async () => {
      const mockOrder = {
        _id: 'order123',
        customer: { _id: 'otheruser', name: 'Other' },
        product: { _id: 'prod123' },
      };
      Order.findById.mockReturnValue(buildPopulateChain(mockOrder));
      // Override middleware to non-admin, non-owner
      // Since middleware is mocked as user123, the order customer is 'otheruser'
      // but user role is 'customer', so access is denied

      const res = await request(app).get('/api/payments/orders/order123');
      expect(res.statusCode).toEqual(403);
    });
  });

  describe('POST /api/payments/orders/:orderId/midtrans/token (createMidtransSnapToken)', () => {
    it('should return 500 if MIDTRANS_SERVER_KEY is not configured', async () => {
      const mockOrder = {
        _id: 'order123',
        orderNumber: 'UKM-2026-0001',
        customer: { _id: 'user123', name: 'Test', email: 't@t.com', phone: '08123' },
        product: { _id: 'prod123', name: 'Product' },
        totalPrice: 100000,
        status: 'Payment',
        details: { quantity: 100, unitPrice: 1000 },
      };

      Order.findById.mockReturnValue(buildPopulateChain(mockOrder));
      Invoice.findOne.mockResolvedValue(null);

      const mockInvoice = {
        _id: 'inv123',
        order: 'order123',
        customer: 'user123',
        product: 'prod123',
        totalAmount: 100000,
        paidAmount: 0,
        status: 'Issued',
        save: jest.fn().mockResolvedValue(true),
      };
      Invoice.create.mockResolvedValue(mockInvoice);
      Invoice.countDocuments.mockResolvedValue(0);

      const res = await request(app)
        .post('/api/payments/orders/order123/midtrans/token');

      // Should fail because MIDTRANS_SERVER_KEY is not set
      expect(res.statusCode).toEqual(500);
    });

    it('should return 400 if invoice is already fully paid', async () => {
      const mockOrder = {
        _id: 'order123',
        orderNumber: 'UKM-2026-0001',
        customer: { _id: 'user123', name: 'Test', email: 't@t.com', phone: '08123' },
        product: { _id: 'prod123', name: 'Product' },
        totalPrice: 100000,
        status: 'Payment',
        details: { quantity: 100, unitPrice: 1000 },
      };

      Order.findById.mockReturnValue(buildPopulateChain(mockOrder));

      const mockInvoice = {
        _id: 'inv123',
        totalAmount: 100000,
        paidAmount: 100000,
        status: 'Paid',
        dueDate: new Date('2099-01-01'),
        save: jest.fn().mockResolvedValue(true),
      };
      Invoice.findOne.mockResolvedValue(mockInvoice);

      const res = await request(app)
        .post('/api/payments/orders/order123/midtrans/token');

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toMatch(/lunas/i);
    });

    it('should create snap token successfully when server key is configured', async () => {
      process.env.MIDTRANS_SERVER_KEY = 'test-server-key';
      process.env.MIDTRANS_CLIENT_KEY = 'test-client-key';

      const mockOrder = {
        _id: 'order123',
        orderNumber: 'UKM-2026-0001',
        customer: { _id: 'user123', name: 'Test', email: 't@t.com', phone: '08123' },
        product: { _id: 'prod123', name: 'Product' },
        totalPrice: 100000,
        status: 'Payment',
        details: { quantity: 100, unitPrice: 1000 },
        save: jest.fn().mockResolvedValue(true),
      };

      Order.findById.mockReturnValue(buildPopulateChain(mockOrder));

      const mockInvoice = {
        _id: 'aabbccddee112233aabbccdd',
        invoiceNumber: 'INV-2026-0001',
        order: 'order123',
        customer: 'user123',
        product: 'prod123',
        totalAmount: 100000,
        paidAmount: 0,
        status: 'Issued',
        dueDate: new Date('2099-01-01'),
        save: jest.fn().mockResolvedValue(true),
      };
      Invoice.findOne.mockResolvedValue(mockInvoice);

      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          token: 'snap-token-123',
          redirect_url: 'https://midtrans.com/snap/pay',
        }),
      });

      const res = await request(app)
        .post('/api/payments/orders/order123/midtrans/token');

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('token', 'snap-token-123');
      expect(res.body).toHaveProperty('redirectUrl');
    });
  });

  describe('POST /api/payments/midtrans/webhook (handleMidtransWebhook)', () => {
    it('should return 500 if server key is not configured', async () => {
      const res = await request(app)
        .post('/api/payments/midtrans/webhook')
        .send({ order_id: 'test', status_code: '200', gross_amount: '100000', signature_key: 'abc' });

      expect(res.statusCode).toEqual(500);
    });

    it('should return 401 for invalid signature', async () => {
      process.env.MIDTRANS_SERVER_KEY = 'test-server-key';

      const res = await request(app)
        .post('/api/payments/midtrans/webhook')
        .send({
          order_id: 'INV-aabbccddee112233aabbccdd-12345',
          status_code: '200',
          gross_amount: '100000',
          signature_key: 'invalid-signature',
        });

      expect(res.statusCode).toEqual(401);
    });

    it('should return 400 for unrecognized order_id format', async () => {
      process.env.MIDTRANS_SERVER_KEY = 'test-server-key';

      const orderId = 'INVALID-FORMAT';
      const statusCode = '200';
      const grossAmount = '100000';
      const expectedSig = crypto.createHash('sha512')
        .update(`${orderId}${statusCode}${grossAmount}test-server-key`)
        .digest('hex');

      const res = await request(app)
        .post('/api/payments/midtrans/webhook')
        .send({
          order_id: orderId,
          status_code: statusCode,
          gross_amount: grossAmount,
          signature_key: expectedSig,
        });

      expect(res.statusCode).toEqual(400);
    });

    it('should return 404 if invoice not found', async () => {
      process.env.MIDTRANS_SERVER_KEY = 'test-server-key';

      const invoiceId = 'aabbccddee112233aabbccdd';
      const orderId = `INV-${invoiceId}-12345`;
      const statusCode = '200';
      const grossAmount = '100000';
      const expectedSig = crypto.createHash('sha512')
        .update(`${orderId}${statusCode}${grossAmount}test-server-key`)
        .digest('hex');

      Invoice.findById.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/payments/midtrans/webhook')
        .send({
          order_id: orderId,
          status_code: statusCode,
          gross_amount: grossAmount,
          signature_key: expectedSig,
        });

      expect(res.statusCode).toEqual(404);
    });

    it('should process valid webhook with settlement status', async () => {
      process.env.MIDTRANS_SERVER_KEY = 'test-server-key';

      const invoiceId = 'aabbccddee112233aabbccdd';
      const orderId = `INV-${invoiceId}-12345`;
      const statusCode = '200';
      const grossAmount = '100000';
      const expectedSig = crypto.createHash('sha512')
        .update(`${orderId}${statusCode}${grossAmount}test-server-key`)
        .digest('hex');

      const mockInvoice = {
        _id: invoiceId,
        order: 'order123',
        customer: 'user123',
        totalAmount: 100000,
        paidAmount: 0,
        status: 'Issued',
        save: jest.fn().mockResolvedValue(true),
      };
      Invoice.findById.mockResolvedValue(mockInvoice);
      PaymentReceived.findOne.mockResolvedValue(null);
      PaymentReceived.create.mockResolvedValue({ _id: 'pay123' });
      PaymentReceived.countDocuments.mockResolvedValue(0);
      Order.findById.mockResolvedValue({
        _id: 'order123',
        status: 'Payment',
        isPaid: false,
        save: jest.fn().mockResolvedValue(true),
      });

      const res = await request(app)
        .post('/api/payments/midtrans/webhook')
        .send({
          order_id: orderId,
          status_code: statusCode,
          gross_amount: grossAmount,
          signature_key: expectedSig,
          transaction_status: 'settlement',
          transaction_id: 'txn-123',
          payment_type: 'bank_transfer',
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.received).toBe(true);
    });
  });
});
