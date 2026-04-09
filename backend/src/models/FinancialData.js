const mongoose = require('mongoose');

const financialDataSchema = new mongoose.Schema({
  ticker: { type: String, required: true, uppercase: true, index: true },
  type: {
    type: String,
    enum: ['income', 'balance', 'cashflow', 'profile', 'quote', 'ratios'],
    required: true,
  },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  fetchedAt: { type: Date, default: Date.now },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h TTL
    index: { expireAfterSeconds: 0 },
  },
}, { timestamps: true });

financialDataSchema.index({ ticker: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('FinancialData', financialDataSchema);
