// Health check + module diagnostics endpoint
module.exports = async function handler(req, res) {
  const result = {
    ok: true,
    node: process.version,
    time: new Date().toISOString(),
    env: {
      hasDb: !!process.env.DATABASE_URL,
      hasJwt: !!process.env.JWT_SECRET,
      hasResend: !!process.env.RESEND_API_KEY,
      hasUpstashUrl: !!process.env.UPSTASH_REDIS_REST_URL,
    },
    modules: {},
  };

  // Test each module import
  try { require('@neondatabase/serverless'); result.modules.neon = 'ok'; }
  catch (e) { result.modules.neon = e.message; }

  try { require('@upstash/redis'); result.modules.upstash = 'ok'; }
  catch (e) { result.modules.upstash = e.message; }

  try { require('resend'); result.modules.resend = 'ok'; }
  catch (e) { result.modules.resend = e.message; }

  try { require('jsonwebtoken'); result.modules.jwt = 'ok'; }
  catch (e) { result.modules.jwt = e.message; }

  try { require('./_db'); result.modules._db = 'ok'; }
  catch (e) { result.modules._db = e.message; }

  try { require('./_cors'); result.modules._cors = 'ok'; }
  catch (e) { result.modules._cors = e.message; }

  res.setHeader('Content-Type', 'application/json');
  res.status(200).json(result);
};
