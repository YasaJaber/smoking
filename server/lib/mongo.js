// ============================================================
// MongoDB Atlas connection helper (serverless-friendly)
//
// In a serverless platform (Vercel) every request may run in a fresh
// invocation. To avoid opening a new TCP/TLS connection each time, we cache
// the MongoClient connect() promise on `globalThis` so warm invocations reuse
// the same pool. Pool is kept small to stay within Atlas free-tier limits.
// ============================================================

require('dotenv').config();
const { MongoClient } = require('mongodb');

const URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || 'smoking_pos';

const OPTIONS = {
  maxPoolSize: 5,
  minPoolSize: 0,
  family: 4, // force IPv4 - avoids slow IPv6 fallback on cold starts
  serverSelectionTimeoutMS: 8000,
};

/** Lazily create (once) and reuse the connection promise across invocations. */
function getClientPromise() {
  if (!URI) {
    throw new Error('MONGODB_URI is not set');
  }
  if (!globalThis._mongoClientPromise) {
    const client = new MongoClient(URI, OPTIONS);
    globalThis._mongoClientPromise = client.connect();
  }
  return globalThis._mongoClientPromise;
}

/**
 * Ensure useful indexes without blocking the request path. On cold starts,
 * waiting for every createIndex can consume most of Vercel's function window.
 */
function ensureIndexes(db) {
  if (globalThis._mongoIndexesPromise) return;

  const collections = ['categories', 'products', 'invoices', 'invoice_items', 'purchases', 'purchase_items', 'inventory_movements'];
  globalThis._mongoIndexesPromise = Promise.all(
    collections.map(async (name) => {
      const coll = db.collection(name);
      await coll.createIndex({ id: 1 }, { unique: true });
      await coll.createIndex({ srv_ts: 1 });
      await coll.createIndex({ device_id: 1, srv_ts: 1 });
    })
  ).catch(() => {
    globalThis._mongoIndexesPromise = null;
  });
}

/**
 * Get the connected database.
 */
async function getDb() {
  const client = await getClientPromise();
  const db = client.db(DB_NAME);

  if (!globalThis._mongoIndexesPromise) {
    ensureIndexes(db);
  }

  return db;
}

module.exports = { getDb, DB_NAME };
