// Simple health check endpoint — no dependencies
module.exports = function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({
    ok: true,
    env: {
      hasDb: !!process.env.DATABASE_URL,
      hasJwt: !!process.env.JWT_SECRET,
      hasResend: !!process.env.RESEND_API_KEY,
    },
    node: process.version,
    time: new Date().toISOString(),
  });
};
