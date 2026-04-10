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
}, { timestamps: true });

module.exports = mongoose.model('LandingContent', LandingContentSchema);
