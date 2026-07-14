const request = require('supertest');
const app = require('../../app');
const ProductionTask = require('../../models/ProductionTask');
const Order = require('../../models/Order');

jest.mock('../../models/ProductionTask');
jest.mock('../../models/Order');
jest.mock('../../services/productionService');
jest.mock('../../services/notificationService');

const productionService = require('../../services/productionService');

describe('ProductionTask Webhook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/webhooks/erp-order', () => {
    it('should return 400 if required fields are missing', async () => {
      const res = await request(app)
        .post('/api/webhooks/erp-order')
        .send({ orderNumber: 'UKM-2026-0001' });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toMatch(/Missing required fields/);
    });

    it('should return 400 if orderNumber is missing', async () => {
      const res = await request(app)
        .post('/api/webhooks/erp-order')
        .send({ orderId: 'erp123', event: 'order.confirmed' });

      expect(res.statusCode).toEqual(400);
    });

    it('should return 200 and create task for valid payload', async () => {
      productionService.handleErpWebhook.mockResolvedValue({
        _id: 'task123',
        taskNumber: 'PROD-2026-0001',
        status: 'Pending',
        priority: 'Medium',
      });

      const res = await request(app)
        .post('/api/webhooks/erp-order')
        .send({
          orderId: 'erp123',
          orderNumber: 'UKM-2026-0001',
          event: 'order.confirmed',
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('task');
      expect(res.body.task.taskNumber).toBe('PROD-2026-0001');
    });

    it('should return 500 if service throws', async () => {
      productionService.handleErpWebhook.mockRejectedValue(new Error('Order not found'));

      const res = await request(app)
        .post('/api/webhooks/erp-order')
        .send({
          orderId: 'erp123',
          orderNumber: 'UKM-2026-9999',
          event: 'order.confirmed',
        });

      expect(res.statusCode).toEqual(500);
    });
  });
});
