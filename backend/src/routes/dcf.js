const express = require('express');
const router = express.Router();
const { validateDCFPayload } = require('../middleware/validate');
const { calculateDCF, calculateSensitivity, calculateScenarios } = require('../services/dcfService');
const DCFModel = require('../models/DCFModel');

// POST /api/dcf/calculate
// Run a full DCF calculation
router.post('/calculate', validateDCFPayload, (req, res) => {
  try {
    const result = calculateDCF(req.body.assumptions);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/dcf/sensitivity
// Returns sensitivity grid (WACC × TGR)
router.post('/sensitivity', (req, res) => {
  try {
    const { assumptions, waccOffsets, tgrValues } = req.body;
    if (!assumptions || !waccOffsets || !tgrValues) {
      return res.status(400).json({ error: 'Missing sensitivity parameters' });
    }
    const grid = calculateSensitivity(assumptions, waccOffsets, tgrValues);
    res.json({ grid, tgrValues });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/dcf/scenarios
// Computes Bull/Base/Bear scenarios
router.post('/scenarios', (req, res) => {
  try {
    const { baseRevenue, scenarios, cash, debt, sharesOutstanding } = req.body;
    if (!baseRevenue || !scenarios) {
      return res.status(400).json({ error: 'Missing scenario parameters' });
    }
    const results = calculateScenarios(baseRevenue, scenarios, cash || 0, debt || 0, sharesOutstanding);
    res.json({ results });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/dcf/save
// Save a DCF model run to MongoDB
router.post('/save', async (req, res) => {
  try {
    const { ticker, companyName, assumptions, results } = req.body;
    if (!ticker || !assumptions || !results) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const model = await DCFModel.create({ ticker: ticker.toUpperCase(), companyName, assumptions, results });
    res.status(201).json({ id: model._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dcf/recent
// Get 10 most recently calculated models
router.get('/recent', async (req, res) => {
  try {
    const models = await DCFModel.find({}, 'ticker companyName results.intrinsicPerShare createdAt')
      .sort({ createdAt: -1 }).limit(10).lean();
    res.json(models);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
