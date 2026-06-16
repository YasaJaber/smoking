// ============================================================
// LOCAL TEST SERVER (no database setup required)
//
// Runs the *real* sync logic (lib/syncCore.js) over plain HTTP, backed by a
// tiny in-memory store that mimics the slice of the MongoDB collection API the
// sync uses. Data lives only in RAM and resets when you stop the process.
//
// Use it to test the whole app -> server flow on your machine BEFORE deploying
// to Vercel + Atlas. Production keeps using api/* with real MongoDB.
//
//   node local.js          (or)   npm run test:local
// ============================================================

const http = require('http');
const os = require('os');
const { runSync, TABLES } = require('./lib/syncCore');

const PORT = process.env.PORT || 4000;

// ---- In-memory MongoDB-compatible shim -------------------------------------
function createMemoryDb() {
  const store = {};
  return {
    collection(name) {
      if (!store[name]) store[name] = [];
      const docs = store[name];
      return {
        async findOne(query) {
          return docs.find((d) => d.id === query.id) || null;
        },
        async replaceOne(query, doc) {
          const i = docs.findIndex((d) => d.id === query.id);
          if (i >= 0) docs[i] = { ...doc };
          else docs.push({ ...doc });
          return { acknowledged: true };
        },
        find(query) {
          let rows = docs;
          if (query.id?.$in) {
            const wanted = new Set(query.id.$in);
            rows = rows.filter((d) => wanted.has(d.id));
          } else if (query.srv_ts?.$gt !== undefined) {
            const since = query.srv_ts.$gt;
            const ne = query.device_id.$ne;
            rows = rows.filter((d) => d.srv_ts > since && d.device_id !== ne);
          }
          rows = rows.map(({ _id, srv_ts, device_id, ...rest }) => rest);
          return {
            sort(spec) {
              const key = Object.keys(spec)[0];
              rows = [...rows].sort((a, b) => (a[key] > b[key] ? 1 : -1));
              return this;
            },
            async toArray() {
              return rows;
            },
          };
        },
        async bulkWrite(ops) {
          for (const op of ops) {
            if (!op.replaceOne) continue;
            await this.replaceOne(
              op.replaceOne.filter,
              op.replaceOne.replacement,
              { upsert: op.replaceOne.upsert }
            );
          }
          return { acknowledged: true };
        },
        async countDocuments() {
          return docs.length;
        },
      };
    },
  };
}

const db = createMemoryDb();

// ---- Tiny HTTP router ------------------------------------------------------
function sendJson(res, status, obj) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-sync-token',
  });
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  const url = (req.url || '').split('?')[0];

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-sync-token',
    });
    return res.end();
  }

  if (req.method === 'GET' && url === '/api/health') {
    return sendJson(res, 200, { ok: true, time: Date.now() });
  }

  if (req.method === 'GET' && (url === '/api/stats' || url === '/')) {
    return Promise.all(TABLES.map((t) => db.collection(t).countDocuments()))
      .then((counts) => {
        const result = {};
        TABLES.forEach((t, i) => (result[t] = counts[i]));
        sendJson(res, 200, { localTestServer: true, counts: result });
      })
      .catch((err) => sendJson(res, 500, { error: String(err.message || err) }));
  }

  if (req.method === 'POST' && url === '/api/sync') {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', async () => {
      try {
        const body = raw ? JSON.parse(raw) : {};
        const payload = await runSync(db, body);
        sendJson(res, 200, payload);
      } catch (err) {
        console.error('Sync error:', err);
        sendJson(res, 500, { error: 'sync_failed', message: String(err.message || err) });
      }
    });
    return;
  }

  sendJson(res, 404, { error: 'not_found' });
});

function lanAddresses() {
  const nets = os.networkInterfaces();
  const out = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) out.push(net.address);
    }
  }
  return out;
}

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n=== Smoking POS LOCAL TEST server (in-memory DB) ===');
  console.log(`Listening on http://localhost:${PORT}`);
  const ips = lanAddresses();
  if (ips.length) {
    console.log('\nUse one of these in the app (Settings > Cloud sync > Server URL):');
    ips.forEach((ip) => console.log(`   http://${ip}:${PORT}`));
    console.log('\nAndroid emulator instead uses:  http://10.0.2.2:' + PORT);
  }
  console.log('\nData is in-memory and resets on restart. Ctrl+C to stop.\n');
});
