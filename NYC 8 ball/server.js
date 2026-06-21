'use strict';

/*
 * NYC 8 Ball — zero-dependency Node.js server.
 *
 * Serves the responsive front-end and a small JSON REST API, plus a
 * password-protected admin API for managing "responses" (NYC activities):
 * create / edit / delete, toggle active, and reorder.
 *
 * No npm install required — uses only the Node standard library. Data is
 * persisted to data/db.json (seeded from data/seed.json on first run).
 *
 * Run:  node server.js   (then open http://localhost:3000)
 * Admin password: env ADMIN_PASSWORD, or "nyc8ball" by default.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'nyc8ball';
const MAX_COST = 50; // dollars per person, excluding transit

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const SEED_PATH = path.join(DATA_DIR, 'seed.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// ---------------------------------------------------------------------------
// Data store (JSON file)
// ---------------------------------------------------------------------------

function loadDb() {
  if (!fs.existsSync(DB_PATH)) {
    const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
    const activities = seed.map((a, i) => normalize(a, i));
    const db = { activities, nextId: activities.length + 1 };
    saveDb(db);
    return db;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function saveDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function normalize(a, index) {
  return {
    id: a.id != null ? a.id : index + 1,
    title: String(a.title || '').trim(),
    description: String(a.description || '').trim(),
    category: String(a.category || 'Other').trim(),
    borough: String(a.borough || 'Multiple').trim(),
    cost: clampCost(a.cost),
    costNote: String(a.costNote || '').trim(),
    url: String(a.url || '').trim(),
    active: a.active === undefined ? true : !!a.active,
    order: a.order != null ? a.order : index,
  };
}

function clampCost(value) {
  let n = Number(value);
  if (!isFinite(n) || n < 0) n = 0;
  if (n > MAX_COST) n = MAX_COST;
  return Math.round(n * 100) / 100;
}

let db = loadDb();

// ---------------------------------------------------------------------------
// Auth (in-memory sessions)
// ---------------------------------------------------------------------------

const sessions = new Set();

function makeToken() {
  return crypto.randomBytes(24).toString('hex');
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx > -1) out[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  });
  return out;
}

function isAuthed(req) {
  const token = parseCookies(req).nyc8_session;
  return token && sessions.has(token);
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function sendJson(res, status, body, headers = {}) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) reject(new Error('Payload too large'));
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/') rel = '/index.html';
  // Resolve safely inside PUBLIC_DIR (block path traversal).
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

function publicView(a) {
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    category: a.category,
    borough: a.borough,
    cost: a.cost,
    costNote: a.costNote,
    url: a.url,
  };
}

function sortedActivities() {
  return [...db.activities].sort((x, y) => x.order - y.order || x.id - y.id);
}

function findIndex(id) {
  return db.activities.findIndex((a) => a.id === Number(id));
}

async function handleApi(req, res, url) {
  const { pathname } = new URL(url, 'http://localhost');
  const method = req.method;

  // --- Public ---
  if (pathname === '/api/random' && method === 'GET') {
    const active = db.activities.filter((a) => a.active);
    if (!active.length) return sendJson(res, 404, { error: 'No active responses yet.' });
    const pick = active[Math.floor(Math.random() * active.length)];
    return sendJson(res, 200, publicView(pick));
  }

  if (pathname === '/api/activities' && method === 'GET') {
    return sendJson(res, 200, sortedActivities().filter((a) => a.active).map(publicView));
  }

  if (pathname === '/api/meta' && method === 'GET') {
    return sendJson(res, 200, {
      maxCost: MAX_COST,
      total: db.activities.length,
      active: db.activities.filter((a) => a.active).length,
      categories: [...new Set(db.activities.map((a) => a.category))].sort(),
      boroughs: [...new Set(db.activities.map((a) => a.borough))].sort(),
    });
  }

  // --- Auth ---
  if (pathname === '/api/admin/login' && method === 'POST') {
    const body = await readBody(req);
    if (body.password === ADMIN_PASSWORD) {
      const token = makeToken();
      sessions.add(token);
      return sendJson(res, 200, { ok: true }, {
        'Set-Cookie': `nyc8_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`,
      });
    }
    return sendJson(res, 401, { error: 'Incorrect password.' });
  }

  if (pathname === '/api/admin/logout' && method === 'POST') {
    const token = parseCookies(req).nyc8_session;
    if (token) sessions.delete(token);
    return sendJson(res, 200, { ok: true }, {
      'Set-Cookie': 'nyc8_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0',
    });
  }

  if (pathname === '/api/admin/session' && method === 'GET') {
    return sendJson(res, 200, { authed: isAuthed(req) });
  }

  // --- Everything below requires auth ---
  if (pathname.startsWith('/api/admin/')) {
    if (!isAuthed(req)) return sendJson(res, 401, { error: 'Not authenticated.' });
  }

  if (pathname === '/api/admin/activities' && method === 'GET') {
    return sendJson(res, 200, sortedActivities());
  }

  if (pathname === '/api/admin/activities' && method === 'POST') {
    const body = await readBody(req);
    if (!body.title || !body.title.trim()) {
      return sendJson(res, 400, { error: 'Title is required.' });
    }
    const maxOrder = db.activities.reduce((m, a) => Math.max(m, a.order), -1);
    const activity = normalize({ ...body, id: db.nextId, order: maxOrder + 1 }, 0);
    db.nextId += 1;
    db.activities.push(activity);
    saveDb(db);
    return sendJson(res, 201, activity);
  }

  const idMatch = pathname.match(/^\/api\/admin\/activities\/(\d+)$/);
  if (idMatch) {
    const idx = findIndex(idMatch[1]);
    if (idx === -1) return sendJson(res, 404, { error: 'Not found.' });

    if (method === 'PUT' || method === 'PATCH') {
      const body = await readBody(req);
      const current = db.activities[idx];
      const updated = {
        ...current,
        ...('title' in body ? { title: String(body.title).trim() } : {}),
        ...('description' in body ? { description: String(body.description).trim() } : {}),
        ...('category' in body ? { category: String(body.category).trim() } : {}),
        ...('borough' in body ? { borough: String(body.borough).trim() } : {}),
        ...('cost' in body ? { cost: clampCost(body.cost) } : {}),
        ...('costNote' in body ? { costNote: String(body.costNote).trim() } : {}),
        ...('url' in body ? { url: String(body.url).trim() } : {}),
        ...('active' in body ? { active: !!body.active } : {}),
      };
      if (!updated.title) return sendJson(res, 400, { error: 'Title is required.' });
      db.activities[idx] = updated;
      saveDb(db);
      return sendJson(res, 200, updated);
    }

    if (method === 'DELETE') {
      const [removed] = db.activities.splice(idx, 1);
      saveDb(db);
      return sendJson(res, 200, { ok: true, removed: removed.id });
    }
  }

  if (pathname === '/api/admin/reorder' && method === 'POST') {
    const body = await readBody(req);
    const order = Array.isArray(body.order) ? body.order : [];
    const pos = new Map(order.map((id, i) => [Number(id), i]));
    db.activities.forEach((a) => {
      if (pos.has(a.id)) a.order = pos.get(a.id);
    });
    saveDb(db);
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 404, { error: 'Unknown endpoint.' });
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/')) {
      await handleApi(req, res, req.url);
    } else {
      serveStatic(req, res, req.url);
    }
  } catch (err) {
    sendJson(res, 400, { error: err.message || 'Bad request.' });
  }
});

server.listen(PORT, () => {
  console.log(`\n  🎱  NYC 8 Ball running at  http://localhost:${PORT}`);
  console.log(`      Admin panel:           http://localhost:${PORT}/admin.html`);
  console.log(`      Admin password:        ${ADMIN_PASSWORD === 'nyc8ball' ? 'nyc8ball (default — set ADMIN_PASSWORD to change)' : '(from ADMIN_PASSWORD)'}`);
  console.log(`      Responses loaded:      ${db.activities.length}\n`);
});
