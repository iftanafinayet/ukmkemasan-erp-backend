const request = require('supertest');
const app = require('../../app');
const LandingContent = require('../../models/LandingContent');
const { uploadToCloudinary, deleteFromCloudinary } = require('../../config/cloudinary');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

jest.mock('../../models/LandingContent');
jest.mock('../../config/db');
jest.mock('../../config/cloudinary', () => ({
  uploadToCloudinary: jest.fn(),
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

    it('should return 500 on server error', async () => {
      LandingContent.findOne.mockRejectedValue(new Error('DB Error'));
      const res = await request(app).get('/api/landing-content');
      expect(res.statusCode).toEqual(500);
      expect(res.body.message).toBe('DB Error');
    });
  });

  describe('PUT /api/landing-content', () => {
    const createMockContent = (overrides = {}) => ({
      _id: 'content123',
      key: 'customer-portal-home',
      articles: [],
      activities: [],
      portfolios: [],
      ...overrides,
      save: jest.fn().mockImplementation(function() { return Promise.resolve(this); }),
    });

    it('should update landing content with basic payload', async () => {
      const mockContent = createMockContent();
      LandingContent.findOne.mockResolvedValue(mockContent);

      const res = await request(app)
        .put('/api/landing-content')
        .send({
          articles: [{ title: 'Updated Article', category: 'New', date: 'May 2026', excerpt: 'Updated' }],
          activities: [],
          portfolios: [],
        });

      expect(res.statusCode).toEqual(200);
      expect(mockContent.articles[0].title).toBe('Updated Article');
      expect(mockContent.save).toHaveBeenCalled();
    });

    it('should update using the payload wrapper', async () => {
      const mockContent = createMockContent();
      LandingContent.findOne.mockResolvedValue(mockContent);

      const res = await request(app)
        .put('/api/landing-content')
        .send({
          payload: {
            articles: [{ title: 'Wrapped Article', category: 'New', date: 'May 2026', excerpt: 'Updated' }],
            activities: [],
            portfolios: [],
          }
        });

      expect(res.statusCode).toEqual(200);
      expect(mockContent.articles[0].title).toBe('Wrapped Article');
    });

    it('should handle image uploads and replace existing images', async () => {
      const mockContent = createMockContent({
        articles: [{ 
          _id: 'art1', 
          title: 'Old Article', 
          imagePublicId: 'old-pid', 
          imageUrl: 'old-url' 
        }]
      });
      LandingContent.findOne.mockResolvedValue(mockContent);
      uploadToCloudinary.mockResolvedValue({ url: 'new-url', publicId: 'new-pid' });

      const res = await request(app)
        .put('/api/landing-content')
        .field('payload', JSON.stringify({
          articles: [{ _id: 'art1', title: 'Updated Article' }],
        }))
        .attach('articleImage:art1', Buffer.from('fake-image'), 'test.jpg');

      expect(res.statusCode).toEqual(200);
      expect(deleteFromCloudinary).toHaveBeenCalledWith('old-pid');
      expect(uploadToCloudinary).toHaveBeenCalled();
      expect(mockContent.articles[0].imageUrl).toBe('new-url');
      expect(mockContent.articles[0].imagePublicId).toBe('new-pid');
    });

    it('should remove images when removeImage is true', async () => {
      const mockContent = createMockContent({
        activities: [{ 
          _id: 'act1', 
          title: 'Old Activity', 
          imagePublicId: 'act-pid', 
          imageUrl: 'act-url' 
        }]
      });
      LandingContent.findOne.mockResolvedValue(mockContent);

      const res = await request(app)
        .put('/api/landing-content')
        .send({
          activities: [{ _id: 'act1', title: 'Updated Activity', removeImage: true }],
          articles: [],
          portfolios: [],
        });

      expect(res.statusCode).toEqual(200);
      expect(deleteFromCloudinary).toHaveBeenCalledWith('act-pid');
      expect(mockContent.activities[0].imageUrl).toBe('');
      expect(mockContent.activities[0].imagePublicId).toBe('');
    });

    it('should cleanup images for deleted articles/activities/portfolios', async () => {
      const mockContent = createMockContent({
        articles: [{ _id: 'art1', title: 'Deleted', imagePublicId: 'del-pid' }],
        activities: [{ _id: 'act1', title: 'Deleted', imagePublicId: 'del-act-pid' }],
        portfolios: [{ _id: 'port1', clientName: 'Deleted', imagePublicId: 'del-port-pid' }],
      });
      LandingContent.findOne.mockResolvedValue(mockContent);

      const res = await request(app)
        .put('/api/landing-content')
        .send({
          articles: [],
          activities: [],
          portfolios: [],
        });

      expect(res.statusCode).toEqual(200);
      expect(deleteFromCloudinary).toHaveBeenCalledWith('del-pid');
      expect(deleteFromCloudinary).toHaveBeenCalledWith('del-act-pid');
      expect(deleteFromCloudinary).toHaveBeenCalledWith('del-port-pid');
    });

    it('should skip items without required fields (title for articles/activities, clientName for portfolios)', async () => {
      const mockContent = createMockContent();
      LandingContent.findOne.mockResolvedValue(mockContent);

      const res = await request(app)
        .put('/api/landing-content')
        .send({
          articles: [{ category: 'No Title' }],
          activities: [{ label: 'No Title' }],
          portfolios: [{ title: 'No Client Name' }],
        });

      expect(res.statusCode).toEqual(200);
      expect(mockContent.articles).toHaveLength(0);
      expect(mockContent.activities).toHaveLength(0);
      expect(mockContent.portfolios).toHaveLength(0);
    });

    it('should update section configurations', async () => {
      const mockContent = createMockContent();
      LandingContent.findOne.mockResolvedValue(mockContent);

      const res = await request(app)
        .put('/api/landing-content')
        .send({
          articles: [],
          activities: [],
          portfolios: [],
          articleSectionConfig: { showTitle: false },
          gallerySectionConfig: { layout: 'grid' },
          portfolioSectionConfig: { limit: 5 },
        });

      expect(res.statusCode).toEqual(200);
      expect(mockContent.articleSectionConfig).toEqual({ showTitle: false });
      expect(mockContent.gallerySectionConfig).toEqual({ layout: 'grid' });
      expect(mockContent.portfolioSectionConfig).toEqual({ limit: 5 });
    });

    it('should return 400 for invalid JSON payload', async () => {
      const mockContent = createMockContent();
      LandingContent.findOne.mockResolvedValue(mockContent);

      const res = await request(app)
        .put('/api/landing-content')
        .send({ payload: '{invalid-json' });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toBe('Format payload landing content tidak valid.');
    });

    it('should return 400 on server error during update', async () => {
      LandingContent.findOne.mockRejectedValue(new Error('Update Error'));
      const res = await request(app).put('/api/landing-content').send({});
      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toBe('Update Error');
    });
  });
});
