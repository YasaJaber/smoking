// ============================================================
// GET /api/health - liveness probe
// ============================================================

const { getDb } = require('../lib/mongo');

module.exports = async (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    await getDb(); // verifies the Atlas connection
    res.status(200).json({ ok: true, time: Date.now() });
  } catch (err) {
    res.status(500).json({ ok: false, message: String(err.message || err) });
  }
};
