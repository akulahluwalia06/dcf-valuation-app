const express = require('express');
const axios   = require('axios');
const router  = express.Router();

// Cache news in memory for 15 min — no DB needed
let cache = { data: null, at: 0 };
const TTL = 15 * 60 * 1000;

router.get('/', async (req, res) => {
  try {
    if (cache.data && Date.now() - cache.at < TTL) {
      return res.json(cache.data);
    }

    const { data } = await axios.get('https://api.polygon.io/v2/reference/news', {
      params: {
        limit: 10,
        order: 'desc',
        sort: 'published_utc',
        apiKey: process.env.POLYGON_API_KEY,
      },
      timeout: 10000,
    });

    const articles = (data.results || []).map(a => ({
      id:          a.id,
      title:       a.title,
      publisher:   a.publisher?.name || '',
      published:   a.published_utc,
      url:         a.article_url,
      tickers:     (a.tickers || []).slice(0, 4),
      description: (a.description || '').slice(0, 160),
    }));

    cache = { data: articles, at: Date.now() };
    res.json(articles);
  } catch (err) {
    console.error('News error:', err.message);
    res.status(502).json({ error: 'Failed to fetch news' });
  }
});

module.exports = router;
