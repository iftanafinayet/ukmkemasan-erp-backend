const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
  key: { type: String, default: 'global', unique: true },

  // Origin (alamat gudang asal untuk Store Order)
  originDestinationId: Number,
  originPinPoint: String,
  origin: {
    name: String,
    phone: String,
    email: String,
    address: String,
  },

  // Preferensi pengiriman
  defaultVehicle: { type: String, default: 'Motor' },
  labelPageFormat: { type: String, default: 'page_5' },

  // Monitoring saldo
  shippingDepositBalance: { type: Number, default: 0 },
  komshipApiKeyConfigured: { type: Boolean, default: false },
  lowBalanceThreshold: { type: Number, default: 50000 },
}, { timestamps: true });

SettingsSchema.statics.getGlobal = async function getGlobal() {
  const existing = await this.findOne({ key: 'global' });
  return existing || this.create({ key: 'global' });
};

module.exports = mongoose.model('Settings', SettingsSchema);
