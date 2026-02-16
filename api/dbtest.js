// Isolated DB connectivity test
const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return res.status(500).json({ error: 'No DATABASE_URL' });

  try {
    const sql = neon(dbUrl);
    const rows = await sql`SELECT key, value FROM stats WHERE active = true ORDER BY sort_order LIMIT 4`;
    return res.status(200).json({ ok: true, rows });
  } catch (err) {
    return res.status(200).json({ ok: false, error: err.message, code: err.code });
  }
};
