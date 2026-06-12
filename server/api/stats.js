// ============================================================
// GET /api/stats - row counts per collection
// ============================================================

const { getDb } = require('../lib/mongo');
const { TABLES } = require('../lib/syncCore');

module.exports = async (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const db = await getDb();
    const counts = await Promise.all(
      TABLES.map((name) => db.collection(name).countDocuments())
    );
    const result = {};
    TABLES.forEach((name, i) => {
      result[name] = counts[i];
    });
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
};
