// POST /api/contact — Submit contact form, send email via Resend
const { getDb } = require('./_db');
const { setCorsHeaders, handleOptions, rateLimit } = require('./_cors');

module.exports = async function handler(req, res) {
  setCorsHeaders(res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { limited } = await rateLimit(req, res, { key: 'contact', max: 5, windowSecs: 300 });
  if (limited) return;

  const { firstName, lastName, email, phone, subject, message } = req.body || {};

  // Validate required fields
  if (!firstName || !lastName || !email || !subject || !message) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  if (message.length > 2000) {
    return res.status(400).json({ error: 'Message too long (max 2000 characters).' });
  }

  try {
    // 1. Persist to database
    const sql = getDb();
    await sql`
      INSERT INTO contact_submissions (first_name, last_name, email, phone, subject, message)
      VALUES (${firstName}, ${lastName}, ${email}, ${phone || null}, ${subject}, ${message})
    `;

    // 2. Send email via Resend (if configured)
    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@springbank.com';
    const toEmail = process.env.CONTACT_TO_EMAIL || 'support@springbank.com';

    if (resendKey && resendKey !== 'PLACEHOLDER') {
      const { Resend } = require('resend');
      const resend = new Resend(resendKey);

      await resend.emails.send({
        from: fromEmail,
        to: toEmail,
        replyTo: email,
        subject: `[Spring Bank Contact] ${subject}`,
        html: `
          <h2>New Contact Form Submission</h2>
          <table style="border-collapse:collapse;width:100%">
            <tr><td style="padding:8px;font-weight:bold">Name</td><td style="padding:8px">${firstName} ${lastName}</td></tr>
            <tr><td style="padding:8px;font-weight:bold">Email</td><td style="padding:8px">${email}</td></tr>
            <tr><td style="padding:8px;font-weight:bold">Phone</td><td style="padding:8px">${phone || 'N/A'}</td></tr>
            <tr><td style="padding:8px;font-weight:bold">Subject</td><td style="padding:8px">${subject}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;vertical-align:top">Message</td><td style="padding:8px">${message.replace(/\n/g, '<br>')}</td></tr>
          </table>
        `,
      });
    }

    return res.status(200).json({ success: true, message: 'Your message has been received. We\'ll be in touch within 1–2 business days.' });
  } catch (err) {
    console.error('[/api/contact] Error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again or call 1-800-774-6461.' });
  }
};
