const request = require('supertest');
const app = require('../../app');
const LandingContent = require('../../models/LandingContent');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

jest.mock('../../models/LandingContent');
jest.mock('../../config/db');
jest.mock('../../config/cloudinary', () => ({
  uploadToCloudinary: jest.fn().mockResolvedValue({ url: 'https://cdn.test/img.avif', publicId: 'landing/img123' }),
  deleteFromCloudinary: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../middleware/authMiddleware', () => ({
  protect: (req, res, next) => {
    req.user = { _id: 'admin123', role: 'admin' };
    next();
  },
  admin: (req, res, next) => next(),
}));

describe('Landing Content Controller Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/landing-content', () => {
    it('should return existing landing content', async () => {
      const mockContent = {
        _id: 'content123',
        key: 'customer-portal-home',
        articles: [{ title: 'Test Article', category: 'Artikel Baru', date: '10 April 2026', excerpt: 'Test' }],
        activities: [{ title: 'Test Activity', label: 'Workshop', date: 'April 2026', location: 'Jakarta', summary: 'Test', accent: 'from-slate-900' }],
        portfolios: [{ clientName: 'Client', title: 'Portfolio', category: 'Pouch', description: 'Test' }],
      };
      LandingContent.findOne.mockResolvedValue(mockContent);

      const res = await request(app).get('/api/landing-content');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('articles');
      expect(res.body).toHaveProperty('activities');
      expect(res.body).toHaveProperty('portfolios');
    });

    it('should create default content when none exists', async () => {
      LandingContent.findOne.mockResolvedValue(null);
      LandingContent.create.mockResolvedValue({
        _id: 'content123',
        key: 'customer-portal-home',
        articles: [{ title: 'Tren desain kemasan 2026' }],
        activities: [{ title: 'Booth UKM Kemasan' }],
        portfolios: [{ clientName: 'Kopi Kenangan' }],
      });

      const res = await request(app).get('/api/landing-content');
      expect(res.statusCode).toEqual(200);
      expect(LandingContent.create).toHaveBeenCalled();
    });
  });

  describe('PUT /api/landing-content', () => {
    it('should update landing content', async () => {
      const mockContent = {
        _id: 'content123',
        key: 'customer-portal-home',
        articles: [],
        activities: [],
        portfolios: [],
        save: jest.fn().mockResolvedValue({
          _id: 'content123',
          articles: [{ title: 'Updated Article', category: 'New', date: 'May 2026', excerpt: 'Updated' }],
          activities: [],
          portfolios: [],
        }),
      };
      LandingContent.findOne.mockResolvedValue(mockContent);

      const res = await request(app)
        .put('/api/landing-content')
        .send({
          articles: [{ title: 'Updated Article', category: 'New', date: 'May 2026', excerpt: 'Updated' }],
          activities: [],
          portfolios: [],
        });

      expect(res.statusCode).toEqual(200);
    });

    it('should return 400 for invalid payload', async () => {
      const mockContent = {
        _id: 'content123',
        articles: [],
        activities: [],
        portfolios: [],
        save: jest.fn(),
      };
      LandingContent.findOne.mockResolvedValue(mockContent);

      const res = await request(app)
        .put('/api/landing-content')
        .send({ payload: '{invalid-json' });

      expect(res.statusCode).toEqual(400);
    });
  });
});
