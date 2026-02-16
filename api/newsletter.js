// POST /api/newsletter — Subscribe email to newsletter / waitlist
const { getDb } = require('./_db');
const { setCorsHeaders, handleOptions, rateLimit } = require('./_cors');

module.exports = async function handler(req, res) {
  setCorsHeaders(res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { limited } = await rateLimit(req, res, { key: 'newsletter', max: 5, windowSecs: 3600 });
  if (limited) return;

  const { email, name, source } = req.body || {};

  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  try {
    const sql = getDb();

    // Upsert: ignore if already subscribed
    await sql`
      INSERT INTO subscribers (email, name, source)
      VALUES (${email.toLowerCase()}, ${name || null}, ${source || 'footer'})
      ON CONFLICT (email) DO UPDATE SET
        updated_at = NOW(),
        source = EXCLUDED.source
    `;

    // Send welcome email via Resend (if configured)
    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@springbank.com';

    if (resendKey && resendKey !== 'PLACEHOLDER') {
      const { Resend } = require('resend');
      const resend = new Resend(resendKey);

      await resend.emails.send({
        from: fromEmail,
        to: email,
        subject: 'Welcome to Spring Bank updates',
        html: `
          <h2>You're subscribed!</h2>
          <p>Hi${name ? ' ' + name : ''},</p>
          <p>Thanks for signing up. You'll be the first to hear about new products, offers, and banking tips from Spring Bank.</p>
          <p style="margin-top:24px;font-size:12px;color:#666">
            You can unsubscribe at any time by replying to this email with "UNSUBSCRIBE".<br>
            Spring Bank, N.A. · 1 Spring Plaza, New York, NY 10001
          </p>
        `,
      });
    }

    return res.status(200).json({ success: true, message: 'You\'re subscribed! Check your inbox for a confirmation.' });
  } catch (err) {
    console.error('[/api/newsletter] Error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
