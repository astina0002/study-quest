const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { initDb, getDb } = require('./db/init');
const questRoutes = require('./routes/quest');
const parentRoutes = require('./routes/parent');

// Ensure data directory exists
const dataDir = process.env.DB_PATH
  ? path.dirname(process.env.DB_PATH)
  : path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
initDb();

const app = express();
const PORT = process.env.PORT || 3000;

// Secret for signing tokens (generated per server start)
const TOKEN_SECRET = crypto.randomBytes(32).toString('hex');

function createToken(timestamp) {
  const hmac = crypto.createHmac('sha256', TOKEN_SECRET);
  hmac.update(String(timestamp));
  return timestamp + '.' + hmac.digest('hex');
}

function verifyToken(token) {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const timestamp = parseInt(parts[0]);
  // Tokens expire after 24 hours
  if (Date.now() - timestamp > 24 * 60 * 60 * 1000) return false;
  const expected = createToken(timestamp);
  return token === expected;
}

function parseCookies(req) {
  const cookies = {};
  const header = req.headers.cookie || '';
  header.split(';').forEach(c => {
    const [key, ...val] = c.trim().split('=');
    if (key) cookies[key] = val.join('=');
  });
  return cookies;
}

function isParentAuthed(req) {
  const cookies = parseCookies(req);
  return verifyToken(cookies.parent_token);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Password hashing helpers
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return salt + ':' + hash;
}

function verifyPassword(password, stored) {
  // Support plain text (migration from old format)
  if (!stored.includes(':')) return password === stored;
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(password, salt, 64).toString('hex');
  return hash === test;
}

// Auth routes
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  const db = getDb();
  try {
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'parent_password'").get();
    const stored = setting ? setting.value : '1234';

    if (verifyPassword(password, stored)) {
      // Migrate plain text to hash on successful login
      if (!stored.includes(':')) {
        const hashed = hashPassword(password);
        db.prepare("UPDATE settings SET value = ? WHERE key = 'parent_password'").run(hashed);
      }
      const token = createToken(Date.now());
      res.setHeader('Set-Cookie', `parent_token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`);
      res.json({ success: true });
    } else {
      res.status(401).json({ error: 'パスワードが違います' });
    }
  } finally {
    db.close();
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'parent_token=; Path=/; HttpOnly; Max-Age=0');
  res.json({ success: true });
});

// API routes (no auth needed)
app.use('/api/quest', questRoutes);

// Parent auth middleware
function requireParentAuth(req, res, next) {
  if (isParentAuthed(req)) {
    next();
  } else {
    res.status(401).json({ error: 'ログインが必要です' });
  }
}

// Parent API routes (auth required)
app.use('/api/parent', requireParentAuth, parentRoutes);

// Parent page
app.get('/parent', (req, res) => {
  if (isParentAuthed(req)) {
    res.sendFile(path.join(__dirname, 'public', 'parent.html'));
  } else {
    res.sendFile(path.join(__dirname, 'public', 'parent-login.html'));
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Study Quest server running on port ${PORT}`);
});
