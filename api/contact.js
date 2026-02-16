// POST /api/contact — Submit contact form, send email via Resend, save to DB
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

  const { firstName, lastName, email, phone, subject, message } = req.body || {};

  if (!firstName || !lastName || !email || !subject || !message) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }
  if (message.length > 2000) {
    return res.status(400).json({ error: 'Message too long (max 2000 characters).' });
  }

  try {
    // 1. Persist to database
    const sql = neon(process.env.DATABASE_URL);
    await sql`
      INSERT INTO contact_submissions (first_name, last_name, email, phone, subject, message)
      VALUES (${firstName}, ${lastName}, ${email}, ${phone || null}, ${subject}, ${message})
    `;

    // 2. Send email via Resend (if configured)
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey && resendKey !== 'PLACEHOLDER') {
      const { Resend } = require('resend');
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'noreply@springbank.com',
        to: process.env.CONTACT_TO_EMAIL || 'support@springbank.com',
        replyTo: email,
        subject: `[Spring Bank Contact] ${subject}`,
        html: `
          <h2>New Contact Form Submission</h2>
          <table>
            <tr><td><b>Name</b></td><td>${firstName} ${lastName}</td></tr>
            <tr><td><b>Email</b></td><td>${email}</td></tr>
            <tr><td><b>Phone</b></td><td>${phone || 'N/A'}</td></tr>
            <tr><td><b>Subject</b></td><td>${subject}</td></tr>
            <tr><td><b>Message</b></td><td>${message.replace(/\n/g, '<br>')}</td></tr>
          </table>
        `,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Your message has been received. We'll be in touch within 1–2 business days.",
    });
  } catch (err) {
    console.error('[/api/contact]', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again or call 1-800-774-6461.' });
  }
};
