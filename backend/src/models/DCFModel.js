const mongoose = require('mongoose');

const dcfModelSchema = new mongoose.Schema({
  ticker: { type: String, required: true, uppercase: true },
  companyName: String,
  assumptions: {
    revGrowthRates: [Number],   // 7 years
    ebitMargin: Number,
    taxRate: Number,
    grossMargin: Number,
    daPercent: Number,
    capexPercent: Number,
    nwcPercent: Number,
    terminalGrowthRate: Number,
    exitMultiple: Number,
    wacc: Number,
    cash: Number,
    debt: Number,
    sharesOutstanding: Number,
  },
  results: {
    pvFCFFs: Number,
    pvTerminalGGM: Number,
    pvTerminalExit: Number,
    evGGM: Number,
    evExit: Number,
    evBlended: Number,
    equityValueGGM: Number,
    equityValueExit: Number,
    equityValueBlended: Number,
    intrinsicPerShareGGM: Number,
    intrinsicPerShareExit: Number,
    intrinsicPerShareBlended: Number,
  },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('DCFModel', dcfModelSchema);
