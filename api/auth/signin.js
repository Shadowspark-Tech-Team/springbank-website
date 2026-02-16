// POST /api/auth/signin — Mock authentication (demo account)
// Returns a short-lived JWT for demo purposes only.
// NOT a production auth system — replace with real identity provider before live launch.
const jwt = require('jsonwebtoken');
const { getDb } = require('../_db');
const { setCorsHeaders, handleOptions, rateLimit } = require('../_cors');

const JWT_EXPIRY = '1h';

module.exports = async function handler(req, res) {
  setCorsHeaders(res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { limited } = await rateLimit(req, res, { key: 'signin', max: 10, windowSecs: 900 });
  if (limited) return;

  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'PLACEHOLDER') {
    console.error('[/api/auth/signin] JWT_SECRET not configured');
    return res.status(503).json({ error: 'Authentication service not configured.' });
  }

  // Demo credentials check (env-controlled)
  const demoUser = process.env.DEMO_USER_ID || 'demo@springbank.com';
  const demoPass = process.env.DEMO_PASSWORD || 'SpringDemo2026!';

  if (username !== demoUser || password !== demoPass) {
    // Log failed attempt to DB if available
    try {
      const sql = getDb();
      await sql`
        INSERT INTO auth_attempts (username, ip, success)
        VALUES (${username}, ${req.headers['x-forwarded-for'] || 'unknown'}, false)
      `;
    } catch { /* ignore DB errors for auth logging */ }

    // Consistent timing to prevent user enumeration
    await new Promise(r => setTimeout(r, 500 + Math.random() * 200));
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  // Issue JWT
  const payload = {
    sub: 'demo-user-001',
    email: demoUser,
    name: 'Demo User',
    role: 'personal',
    iss: 'springbank.com',
    iat: Math.floor(Date.now() / 1000),
  };

  const token = jwt.sign(payload, secret, { expiresIn: JWT_EXPIRY, algorithm: 'HS256' });

  // Log successful auth
  try {
    const sql = getDb();
    await sql`
      INSERT INTO auth_attempts (username, ip, success)
      VALUES (${username}, ${req.headers['x-forwarded-for'] || 'unknown'}, true)
    `;
  } catch { /* ignore */ }

  return res.status(200).json({
    success: true,
    token,
    expiresIn: 3600,
    user: {
      name: payload.name,
      email: payload.email,
      role: payload.role,
      lastLogin: new Date().toISOString(),
    },
  });
};
