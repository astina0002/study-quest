const express = require('express');
const path = require('path');
const fs = require('fs');
const { initDb } = require('./db/init');
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

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/quest', questRoutes);
app.use('/api/parent', parentRoutes);

// SPA fallback
app.get('/parent', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'parent.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Study Quest server running on port ${PORT}`);
});
