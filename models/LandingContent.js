const mongoose = require('mongoose');

const LandingArticleSchema = new mongoose.Schema({
  category: {
    type: String,
    trim: true,
    default: '',
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  date: {
    type: String,
    trim: true,
    default: '',
  },
  excerpt: {
    type: String,
    trim: true,
    default: '',
  },
}, { _id: true });

const LandingActivitySchema = new mongoose.Schema({
  label: {
    type: String,
    trim: true,
    default: '',
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  date: {
    type: String,
    trim: true,
    default: '',
  },
  location: {
    type: String,
    trim: true,
    default: '',
  },
  summary: {
    type: String,
    trim: true,
    default: '',
  },
  accent: {
    type: String,
    trim: true,
    default: 'from-slate-900 via-slate-800 to-cyan-900',
  },
  imageUrl: {
    type: String,
    trim: true,
    default: '',
  },
  imagePublicId: {
    type: String,
    trim: true,
    default: '',
  },
  imageAlt: {
    type: String,
    trim: true,
    default: '',
  },
}, { _id: true });

const LandingContentSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    default: 'customer-portal-home',
  },
  articles: {
    type: [LandingArticleSchema],
    default: [],
  },
  activities: {
    type: [LandingActivitySchema],
    default: [],
  },
  articleSectionConfig: {
    pillText: { type: String, default: 'Informasi Menarik' },
    title: { type: String, default: 'Artikel Pilihan Untuk Meningkatkan Produk Anda' },
    subtitle: { type: String, default: 'Selalu update dengan tren dan teknologi terbaru di dunia kemasan. Baca artikel-artikel pilihan kami untuk menemukan solusi kemasan yang tepat bagi bisnis Anda.' },
  },
  gallerySectionConfig: {
    pillText: { type: String, default: 'Galeri' },
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
  },
}, { timestamps: true });

module.exports = mongoose.model('LandingContent', LandingContentSchema);
