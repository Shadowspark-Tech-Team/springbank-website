// GET /api/stats — Return live bank stats for homepage stats bar
const { getDb } = require('./_db');
const { setCorsHeaders, handleOptions } = require('./_cors');

// Fallback static stats if DB is unavailable
const FALLBACK_STATS = [
  { label: 'Customers Served', value: '5M+', icon: 'customers' },
  { label: 'ATMs & Branches', value: '4,800+', icon: 'locations' },
  { label: 'Monthly Fee', value: '$0', icon: 'fee' },
  { label: 'App Uptime', value: '99.9%', icon: 'uptime' },
];

let cache = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

module.exports = async function handler(req, res) {
  setCorsHeaders(res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Serve from cache if fresh
  if (cache && Date.now() - cacheTime < CACHE_TTL) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json({ stats: cache });
  }

  try {
    const sql = getDb();
    const rows = await sql`
      SELECT key, label, value, icon, sort_order
      FROM stats
      WHERE active = true
      ORDER BY sort_order ASC
      LIMIT 8
    `;

    const stats = rows.length > 0 ? rows : FALLBACK_STATS;
    cache = stats;
    cacheTime = Date.now();

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json({ stats });
  } catch (err) {
    console.error('[/api/stats] DB error, using fallback:', err.message);
    return res.status(200).json({ stats: FALLBACK_STATS, source: 'fallback' });
  }
};
