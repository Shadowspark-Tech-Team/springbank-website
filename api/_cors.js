// CORS headers + Upstash Redis rate limiting for all API routes
const { Redis } = require('@upstash/redis');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'https://www.springbank.com',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function setCorsHeaders(res) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
}

function handleOptions(req, res) {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    res.status(204).end();
    return true;
  }
  return false;
}

// Rate limiter: returns { limited: true } if over threshold
async function rateLimit(req, res, { key, max = 10, windowSecs = 60 } = {}) {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!upstashUrl || !upstashToken || upstashUrl === 'PLACEHOLDER') {
    // Rate limiting disabled — allow all requests
    return { limited: false };
  }

  try {
    const redis = new Redis({ url: upstashUrl, token: upstashToken });
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '127.0.0.1';
    const rateKey = `rl:${key}:${ip}`;

    const count = await redis.incr(rateKey);
    if (count === 1) await redis.expire(rateKey, windowSecs);

    if (count > max) {
      setCorsHeaders(res);
      res.status(429).json({ error: 'Too many requests. Please try again later.' });
      return { limited: true };
    }
    return { limited: false };
  } catch {
    // Redis unavailable — fail open (allow request)
    return { limited: false };
  }
}

module.exports = { setCorsHeaders, handleOptions, rateLimit };
