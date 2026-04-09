const express = require('express');
const router = express.Router();
const { validateTicker } = require('../middleware/validate');
const { getFinancialSnapshot, getQuote } = require('../services/fmpService');

// GET /api/financial/:ticker/snapshot
// Returns normalized financial data for DCF pre-population
router.get('/:ticker/snapshot', validateTicker, async (req, res) => {
  try {
    const snapshot = await getFinancialSnapshot(req.ticker);
    res.json(snapshot);
  } catch (err) {
    console.error(`Snapshot error for ${req.ticker}:`, err.message);
    res.status(502).json({ error: 'Failed to fetch financial data', detail: err.message });
  }
});

// GET /api/financial/:ticker/quote
// Returns live price quote (not cached)
router.get('/:ticker/quote', validateTicker, async (req, res) => {
  try {
    const quote = await getQuote(req.ticker);
    res.json(quote);
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch quote', detail: err.message });
  }
});

module.exports = router;
