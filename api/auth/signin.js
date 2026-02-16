// POST /api/auth/signin — Mock authentication (demo account)
// Returns a short-lived JWT. NOT a production auth system.
const jwt = require('jsonwebtoken');
const { neon } = require('@neondatabase/serverless');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'PLACEHOLDER') {
    return res.status(503).json({ error: 'Authentication service not configured.' });
  }

  const demoUser = (process.env.DEMO_USER_ID || 'demo@springbank.com').trim();
  const demoPass = (process.env.DEMO_PASSWORD || 'SpringDemo2026!').trim();

  // Log attempt
  try {
    const sql = neon(process.env.DATABASE_URL);
    const success = (username.trim() === demoUser && password === demoPass);

    await sql`
      INSERT INTO auth_attempts (username, ip, success)
      VALUES (${username}, ${req.headers['x-forwarded-for'] || 'unknown'}, ${success})
    `;

    if (!success) {
      await new Promise(r => setTimeout(r, 500 + Math.random() * 200));
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const payload = {
      sub: 'demo-user-001',
      email: demoUser,
      name: 'Demo User',
      role: 'personal',
      iss: 'springbank.com',
    };
    const token = jwt.sign(payload, secret, { expiresIn: '1h', algorithm: 'HS256' });

    return res.status(200).json({
      success: true,
      token,
      expiresIn: 3600,
      user: { name: payload.name, email: payload.email, role: payload.role },
    });
  } catch (err) {
    console.error('[/api/auth/signin]', err);
    return res.status(500).json({ error: 'Authentication service unavailable.' });
  }
};
