const Settings = require('../models/Settings');
const komship = require('../config/komship');
const rajaongkirCostService = require('../services/rajaongkirCostService');
const { success, error } = require('../utils/apiResponse');

// @desc    Ambil pengaturan global (termasuk pengiriman)
exports.getSettings = async (req, res) => {
  try {
    const settings = await Settings.getGlobal();
    settings.komshipApiKeyConfigured = komship.isConfigured();
    await settings.save();
    success(res, settings);
  } catch (e) {
    error(res, e.message);
  }
};

// @desc    Update pengaturan global
exports.updateSettings = async (req, res) => {
  try {
    const settings = await Settings.getGlobal();
    const editable = [
      'originDestinationId',
      'originPinPoint',
      'origin',
      'defaultVehicle',
      'labelPageFormat',
      'lowBalanceThreshold',
    ];
    editable.forEach((field) => {
      if (req.body[field] !== undefined) settings[field] = req.body[field];
    });
    await settings.save();
    success(res, settings);
  } catch (e) {
    error(res, e.message);
  }
};

// @desc    Proxy Search Destination (picker origin) via API Shipping Cost
exports.searchDestination = async (req, res) => {
  try {
    const { keyword } = req.query;
    if (!keyword) return error(res, 'Parameter keyword wajib diisi', 400);
    const data = await rajaongkirCostService.searchDestination(keyword);
    success(res, data);
  } catch (e) {
    error(res, e.message, e.httpStatus || 500);
  }
};
