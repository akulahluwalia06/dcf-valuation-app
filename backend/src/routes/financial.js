const express = require('express');
const router = express.Router();
const { validateTicker } = require('../middleware/validate');
const { getFinancialSnapshot, getQuote } = require('../services/financialService');

router.get('/:ticker/snapshot', validateTicker, async (req, res) => {
  try {
    const snapshot = await getFinancialSnapshot(req.ticker);

    if (!snapshot.currentPrice && !snapshot.snapshot.revenue) {
      return res.status(404).json({ error: `No financial data found for ${req.ticker}. Check the ticker symbol.` });
    }
    res.json(snapshot);
  } catch (err) {
    console.error(`Snapshot error for ${req.ticker}:`, err.message);
    res.status(502).json({ error: 'Failed to fetch financial data', detail: err.message });
  }
});

router.get('/:ticker/quote', validateTicker, async (req, res) => {
  try {
    const quote = await getQuote(req.ticker);
    res.json(quote);
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch quote', detail: err.message });
  }
});

module.exports = router;
