// ============================================================
// POST /api/sync - bidirectional sync endpoint (Vercel serverless function)
// ============================================================

const { getDb } = require('../lib/mongo');
const { runSync } = require('../lib/syncCore');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-sync-token');
}

function isAuthorized(req) {
  const expected = process.env.SYNC_TOKEN;
  if (!expected) return false;
  return req.headers['x-sync-token'] === expected;
}

module.exports = async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!process.env.SYNC_TOKEN) {
    return res.status(503).json({ error: 'sync_token_not_configured' });
  }
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    // Vercel parses JSON bodies automatically; fall back if it's a string.
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }

    const db = await getDb();
    const payload = await runSync(db, body || {});
    return res.status(200).json(payload);
  } catch (err) {
    console.error('Sync error:', err);
    return res.status(500).json({ error: 'sync_failed', message: String(err.message || err) });
  }
};
