// Sanitize ticker input — alphanumeric + dot/dash, max 15 chars (e.g. SHOP.TO, BRK.B)
function validateTicker(req, res, next) {
  const ticker = (req.params.ticker || req.query.ticker || '').toUpperCase().trim();
  if (!ticker || !/^[A-Z0-9.\-]{1,15}$/.test(ticker)) {
    return res.status(400).json({ error: 'Invalid ticker symbol' });
  }
  req.ticker = ticker;
  next();
}

function validateDCFPayload(req, res, next) {
  const { assumptions } = req.body;
  if (!assumptions) return res.status(400).json({ error: 'Missing assumptions payload' });

  const required = ['baseRevenue', 'revGrowthRates', 'ebitMargin', 'taxRate', 'wacc', 'terminalGrowthRate', 'sharesOutstanding'];
  for (const field of required) {
    if (assumptions[field] === undefined || assumptions[field] === null) {
      return res.status(400).json({ error: `Missing required field: ${field}` });
    }
  }
  if (!Array.isArray(assumptions.revGrowthRates) || assumptions.revGrowthRates.length !== 7) {
    return res.status(400).json({ error: 'revGrowthRates must be an array of 7 values' });
  }
  next();
}

module.exports = { validateTicker, validateDCFPayload };
