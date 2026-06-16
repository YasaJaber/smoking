# Smoking POS - Sync Server (Vercel + MongoDB Atlas)

Central API that keeps every tablet/phone in sync against a **MongoDB Atlas**
cloud database, deployed as **free Vercel serverless functions**. Each device
works fully offline on its own local SQLite DB and, whenever the internet is
back, pushes its local changes and pulls everyone else's — so any device that
logs in sees the same products, stock and sales.

```
Phone (SQLite, offline-first)  --HTTP /api/sync-->  Vercel function  <-->  MongoDB Atlas (cloud)
```

Why Vercel free: no 15-minute sleep like Render, no expiring credits like
Railway. Cold starts are sub-second and sync runs in the background, so the
cashier never waits.

## 1) MongoDB Atlas

1. Create a free cluster (M0) at https://www.mongodb.com/atlas
2. Create a database user (username + password).
3. **Network Access → Add IP → `0.0.0.0/0`** (Vercel functions use dynamic IPs).
4. **Connect → Drivers** → copy the connection string, e.g.
   `mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`

## 2) Deploy to Vercel

1. Push this repo to GitHub (the `server/` folder is what we deploy).
2. On https://vercel.com → **Add New Project → Import** your repo.
3. Set **Root Directory** to `server`.
4. Add Environment Variables:
   - `MONGODB_URI` = your Atlas connection string
   - `MONGODB_DB` = `smoking_pos` (optional)
   - `SYNC_TOKEN` = a long random token used by the app in the `x-sync-token` header
5. **Deploy**. You get a URL like `https://your-project.vercel.app`.

Generate a token locally with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use the same generated value in:

- Vercel server env: `SYNC_TOKEN`
- App build/local env: `EXPO_PUBLIC_SYNC_TOKEN`

Or via CLI from the `server/` folder:

```bash
npm install
npx vercel            # first deploy / link project
npx vercel env add MONGODB_URI
npx vercel --prod     # production deploy
```

## 3) Point the app at it

In the app: **الإعدادات → المزامنة السحابية → عنوان السيرفر** and enter your
Vercel URL **without** a trailing path, e.g. `https://your-project.vercel.app`
(the app calls `/api/sync` automatically). Enter the same `SYNC_TOKEN` in
**توكن المزامنة**. Press **حفظ** then **مزامنة الآن**.

For a default value in development/builds, copy the root `.env.example` to
`.env` and set `EXPO_PUBLIC_SYNC_SERVER_URL` and `EXPO_PUBLIC_SYNC_TOKEN`.

## Endpoints

- `POST /api/sync` – bidirectional sync
- `GET /api/health` – `{ ok: true }`
- `GET /api/stats` – document counts per collection

`/api/sync` and `/api/stats` require the header:

```http
x-sync-token: your-long-random-secret
```

```jsonc
// POST /api/sync request
{ "deviceId": "…", "lastSyncAt": 0,
  "changes": { "categories": [], "products": [], "invoices": [], "invoice_items": [] } }

// response
{ "serverTime": 1733900000000,
  "changes": { "categories": [], "products": [], "invoices": [], "invoice_items": [] } }
```

## Local development

```bash
cp .env.example .env   # put your MONGODB_URI here
npm install
npm run dev            # runs `vercel dev` on http://localhost:3000
```

## Notes

- Conflicts on products/categories are resolved **Last-Write-Wins** by
  `updated_at`. Invoices are append-only.
- Collections are created automatically on first sync, with a unique index on
  `id`. The Mongo connection is cached across warm invocations and uses a small
  pool to respect Atlas free-tier connection limits.
- Never commit `.env`; it holds your Atlas password.
