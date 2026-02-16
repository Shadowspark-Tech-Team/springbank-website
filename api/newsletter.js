// POST /api/newsletter — Subscribe email to newsletter / waitlist
const { neon } = require('@neondatabase/serverless');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, name, source } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    await sql`
      INSERT INTO subscribers (email, name, source)
      VALUES (${email.toLowerCase()}, ${name || null}, ${source || 'footer'})
      ON CONFLICT (email) DO UPDATE SET updated_at = NOW(), source = EXCLUDED.source
    `;

    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey && resendKey !== 'PLACEHOLDER') {
      const { Resend } = require('resend');
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'noreply@springbank.com',
        to: email,
        subject: 'Welcome to Spring Bank updates',
        html: `
          <h2>You're subscribed!</h2>
          <p>Hi${name ? ' ' + name : ''},</p>
          <p>Thanks for signing up. You'll be the first to hear about new products and offers from Spring Bank.</p>
          <p style="font-size:12px;color:#666">Spring Bank, N.A. · 1 Spring Plaza, New York, NY 10001</p>
        `,
      });
    }

    return res.status(200).json({
      success: true,
      message: "You're subscribed! Check your inbox for a confirmation.",
    });
  } catch (err) {
    console.error('[/api/newsletter]', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
