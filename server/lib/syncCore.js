// ============================================================
// Shared sync logic (storage-agnostic apply/pull against a Mongo db)
// ============================================================

// Fields that arrive from the client for each collection (must match the app).
const DATA_COLUMNS = {
  categories: ['id', 'name', 'icon', 'color', 'sort_order', 'is_active', 'synced', 'created_at', 'updated_at'],
  products: ['id', 'category_id', 'name', 'barcode', 'cost_price', 'sell_price', 'quantity', 'min_quantity', 'image_uri', 'is_active', 'synced', 'created_at', 'updated_at'],
  invoices: ['id', 'invoice_number', 'invoice_name', 'user_id', 'subtotal', 'tax_amount', 'total', 'amount_paid', 'amount_due', 'payment_method', 'status', 'synced', 'created_at'],
  invoice_items: ['id', 'invoice_id', 'product_id', 'product_name', 'quantity', 'unit_cost', 'unit_price', 'total', 'created_at'],
};

const TABLES = Object.keys(DATA_COLUMNS);

// Collections that carry an `updated_at` field get Last-Write-Wins protection.
const LWW_TABLES = new Set(['categories', 'products']);

/** Build a clean document containing only the known data fields. */
function pickColumns(table, raw) {
  const doc = {};
  for (const c of DATA_COLUMNS[table]) {
    doc[c] = raw[c] === undefined ? null : raw[c];
  }
  return doc;
}

/**
 * Apply one collection's incoming rows.
 *  - LWW tables: only overwrite when incoming.updated_at >= existing.updated_at.
 *  - Append-only tables (invoices / items): plain upsert.
 */
async function applyIncoming(db, table, rows, now, deviceId) {
  if (!Array.isArray(rows) || rows.length === 0) return;
  const coll = db.collection(table);
  const isLww = LWW_TABLES.has(table);

  for (const raw of rows) {
    if (!raw || raw.id == null) continue;
    const doc = pickColumns(table, raw);
    doc.srv_ts = now;
    doc.device_id = deviceId;

    if (isLww) {
      const existing = await coll.findOne({ id: raw.id }, { projection: { updated_at: 1 } });
      if (existing && String(doc.updated_at) < String(existing.updated_at)) {
        continue; // server copy is newer -> keep it
      }
    }

    await coll.replaceOne({ id: raw.id }, doc, { upsert: true });
  }
}

/** Pull rows changed since `since` that were produced by a different device. */
async function pullChanges(db, table, since, deviceId) {
  const coll = db.collection(table);
  const projection = { _id: 0, srv_ts: 0, device_id: 0 };
  return coll
    .find({ srv_ts: { $gt: since }, device_id: { $ne: deviceId } }, { projection })
    .sort({ srv_ts: 1 })
    .toArray();
}

/**
 * Run a full bidirectional sync round-trip and return the response payload.
 */
async function runSync(db, body) {
  const { deviceId, lastSyncAt, changes } = body || {};
  const device = deviceId || 'unknown';
  const since = Number(lastSyncAt) || 0;
  const incoming = changes || {};
  const now = Date.now();

  // Apply incoming changes (parents first for referential sanity).
  await applyIncoming(db, 'categories', incoming.categories, now, device);
  await applyIncoming(db, 'products', incoming.products, now, device);
  await applyIncoming(db, 'invoices', incoming.invoices, now, device);
  await applyIncoming(db, 'invoice_items', incoming.invoice_items, now, device);

  // Collect everything changed since `since` by OTHER devices.
  const out = {
    categories: await pullChanges(db, 'categories', since, device),
    products: await pullChanges(db, 'products', since, device),
    invoices: await pullChanges(db, 'invoices', since, device),
    invoice_items: await pullChanges(db, 'invoice_items', since, device),
  };

  return { serverTime: now, changes: out };
}

module.exports = { DATA_COLUMNS, TABLES, LWW_TABLES, applyIncoming, pullChanges, runSync };
