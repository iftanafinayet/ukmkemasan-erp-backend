const LandingContent = require('../models/LandingContent');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');

const LANDING_CONTENT_KEY = 'customer-portal-home';
const DEFAULT_ACTIVITY_ACCENT = 'from-slate-900 via-slate-800 to-cyan-900';

const DEFAULT_LANDING_CONTENT = {
  articles: [
    {
      category: 'Artikel Baru',
      title: 'Tren desain kemasan 2026 untuk brand UMKM yang ingin naik kelas.',
      date: '10 April 2026',
      excerpt: 'Insight singkat tentang kombinasi warna, finishing, dan struktur kemasan yang lebih menarik di rak maupun marketplace.',
    },
    {
      category: 'Business Insight',
      title: 'Kapan saat yang tepat beralih dari kemasan polos ke kemasan custom?',
      date: '8 April 2026',
      excerpt: 'Panduan memilih momentum upgrade packaging agar biaya tetap terkontrol tetapi persepsi brand meningkat.',
    },
    {
      category: 'Packaging Tips',
      title: 'Cara memilih ukuran pouch yang pas untuk kopi, snack, dan produk frozen.',
      date: '5 April 2026',
      excerpt: 'Ukuran yang tepat membantu efisiensi produksi, tampilan display, dan pengalaman customer saat menerima produk.',
    },
  ],
  activities: [
    {
      label: 'Pameran',
      title: 'Booth UKM Kemasan di expo kemasan dan printing regional.',
      date: 'April 2026',
      location: 'Surabaya',
      summary: 'Menampilkan sampel standing pouch, diskusi kebutuhan brand, dan konsultasi langsung dengan calon client.',
      accent: 'from-slate-900 via-slate-800 to-cyan-900',
    },
    {
      label: 'Workshop',
      title: 'Sesi edukasi packaging branding untuk pelaku UMKM kuliner.',
      date: 'Maret 2026',
      location: 'Malang',
      summary: 'Berbagi insight tentang struktur kemasan, visual shelf impact, dan strategi upgrade kemasan bertahap.',
      accent: 'from-primary via-cyan-700 to-emerald-700',
    },
    {
      label: 'Production Visit',
      title: 'Dokumentasi review material dan approval sample bersama client.',
      date: 'Maret 2026',
      location: 'Sidoarjo',
      summary: 'Aktivitas quality checking dan finalisasi spesifikasi sebelum masuk tahap order berjalan.',
      accent: 'from-amber-500 via-orange-500 to-rose-500',
    },
  ],
};

const normalizeText = (value = '') => String(value || '').trim();

const parsePayload = (rawPayload) => {
  if (!rawPayload) return {};
  if (typeof rawPayload !== 'string') return rawPayload;

  try {
    return JSON.parse(rawPayload);
  } catch {
    throw new Error('Format payload landing content tidak valid.');
  }
};

const sanitizeArticle = (article = {}, existingArticle = null) => ({
  ...(existingArticle?._id ? { _id: existingArticle._id } : article._id ? { _id: article._id } : {}),
  category: normalizeText(article.category),
  title: normalizeText(article.title),
  date: normalizeText(article.date),
  excerpt: normalizeText(article.excerpt),
  imageUrl: normalizeText(article.imageUrl || existingArticle?.imageUrl),
  imagePublicId: normalizeText(article.imagePublicId || existingArticle?.imagePublicId),
  imageAlt: normalizeText(article.imageAlt || article.title || existingArticle?.imageAlt),
});

const sanitizeActivity = (activity = {}, existingActivity = null) => ({
  ...(existingActivity?._id ? { _id: existingActivity._id } : activity._id ? { _id: activity._id } : {}),
  label: normalizeText(activity.label),
  title: normalizeText(activity.title),
  date: normalizeText(activity.date),
  location: normalizeText(activity.location),
  summary: normalizeText(activity.summary),
  accent: normalizeText(activity.accent) || DEFAULT_ACTIVITY_ACCENT,
  imageUrl: normalizeText(activity.imageUrl || existingActivity?.imageUrl),
  imagePublicId: normalizeText(activity.imagePublicId || existingActivity?.imagePublicId),
  imageAlt: normalizeText(activity.imageAlt || activity.title || existingActivity?.imageAlt),
});

const getOrCreateLandingContent = async () => {
  let content = await LandingContent.findOne({ key: LANDING_CONTENT_KEY });
  if (!content) {
    content = await LandingContent.create({
      key: LANDING_CONTENT_KEY,
      ...DEFAULT_LANDING_CONTENT,
    });
  }
  return content;
};

// @desc    Ambil konten homepage customer
// @route   GET /api/landing-content
exports.getLandingContent = async (req, res) => {
  try {
    const content = await getOrCreateLandingContent();
    res.json(content);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update konten homepage customer
// @route   PUT /api/landing-content
exports.updateLandingContent = async (req, res) => {
  try {
    const content = await getOrCreateLandingContent();
    const payload = parsePayload(req.body.payload || req.body);

    const articlesPayload = Array.isArray(payload.articles) ? payload.articles : [];
    const activitiesPayload = Array.isArray(payload.activities) ? payload.activities : [];

    const existingArticlesById = new Map(
      (content.articles || []).map((article) => [String(article._id), article.toObject ? article.toObject() : article])
    );
    const existingActivitiesById = new Map(
      (content.activities || []).map((activity) => [String(activity._id), activity.toObject ? activity.toObject() : activity])
    );
    const uploadedFiles = new Map((req.files || []).map((file) => [file.fieldname, file]));

    const nextArticles = [];
    const retainedArticleIds = new Set();

    for (const article of articlesPayload) {
      const existingArticle = existingArticlesById.get(String(article._id)) || null;
      const clientId = normalizeText(article.clientId || article._id);
      const uploadField = clientId ? `articleImage:${clientId}` : '';
      const file = uploadField ? uploadedFiles.get(uploadField) : null;
      const shouldRemoveImage = article.removeImage === true || article.removeImage === 'true';

      const nextArticle = sanitizeArticle(article, existingArticle);

      if (file) {
        if (existingArticle?.imagePublicId) {
          await deleteFromCloudinary(existingArticle.imagePublicId);
        }

        const uploadedImage = await uploadToCloudinary(file.buffer, 'landing-content');
        nextArticle.imageUrl = uploadedImage.url;
        nextArticle.imagePublicId = uploadedImage.publicId;
        nextArticle.imageAlt = normalizeText(article.imageAlt || article.title || existingArticle?.imageAlt);
      } else if (shouldRemoveImage) {
        if (existingArticle?.imagePublicId) {
          await deleteFromCloudinary(existingArticle.imagePublicId);
        }
        nextArticle.imageUrl = '';
        nextArticle.imagePublicId = '';
      }

      if (!nextArticle.title) {
        continue;
      }

      if (nextArticle._id) {
        retainedArticleIds.add(String(nextArticle._id));
      }

      nextArticles.push(nextArticle);
    }

    // Cleanup deleted article images
    for (const existingArticle of content.articles || []) {
      const existingId = String(existingArticle._id);
      if (!retainedArticleIds.has(existingId) && existingArticle.imagePublicId) {
        await deleteFromCloudinary(existingArticle.imagePublicId);
      }
    }

    const retainedActivityIds = new Set();
    const nextActivities = [];

    for (const activity of activitiesPayload) {
      const existingActivity = existingActivitiesById.get(String(activity._id)) || null;
      const clientId = normalizeText(activity.clientId || activity._id);
      const uploadField = clientId ? `activityImage:${clientId}` : '';
      const file = uploadField ? uploadedFiles.get(uploadField) : null;
      const shouldRemoveImage = activity.removeImage === true || activity.removeImage === 'true';

      const nextActivity = sanitizeActivity(activity, existingActivity);

      if (file) {
        if (existingActivity?.imagePublicId) {
          await deleteFromCloudinary(existingActivity.imagePublicId);
        }

        const uploadedImage = await uploadToCloudinary(file.buffer, 'landing-content');
        nextActivity.imageUrl = uploadedImage.url;
        nextActivity.imagePublicId = uploadedImage.publicId;
        nextActivity.imageAlt = normalizeText(activity.imageAlt || activity.title || existingActivity?.imageAlt);
      } else if (shouldRemoveImage) {
        if (existingActivity?.imagePublicId) {
          await deleteFromCloudinary(existingActivity.imagePublicId);
        }
        nextActivity.imageUrl = '';
        nextActivity.imagePublicId = '';
      }

      if (!nextActivity.title) {
        continue;
      }

      if (nextActivity._id) {
        retainedActivityIds.add(String(nextActivity._id));
      }

      nextActivities.push(nextActivity);
    }

    for (const existingActivity of content.activities || []) {
      const existingId = String(existingActivity._id);
      if (!retainedActivityIds.has(existingId) && existingActivity.imagePublicId) {
        await deleteFromCloudinary(existingActivity.imagePublicId);
      }
    }

    content.articles = nextArticles;
    content.activities = nextActivities;

    if (payload.articleSectionConfig) {
      content.articleSectionConfig = payload.articleSectionConfig;
    }
    if (payload.gallerySectionConfig) {
      content.gallerySectionConfig = payload.gallerySectionConfig;
    }

    const updatedContent = await content.save();
    res.json(updatedContent);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
