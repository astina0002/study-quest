const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'quest.db');

function getDb() {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function initDb() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_quests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      child_completed INTEGER DEFAULT 0,
      child_completed_at TEXT,
      parent_confirmed INTEGER DEFAULT 0,
      parent_confirmed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS reward_config (
      day_number INTEGER PRIMARY KEY,
      reward_amount INTEGER NOT NULL,
      reward_type TEXT DEFAULT 'cash',
      reward_description TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS daily_goals (
      date TEXT PRIMARY KEY,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wishlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL,
      granted INTEGER DEFAULT 0,
      granted_month TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Default reward config (days 1-6)
  const insert = db.prepare(
    'INSERT OR IGNORE INTO reward_config (day_number, reward_amount, reward_type, reward_description) VALUES (?, ?, ?, ?)'
  );
  const defaults = [
    [1, 100, 'cash', '1日達成ボーナス'],
    [2, 100, 'cash', '2日達成ボーナス'],
    [3, 200, 'cash', '3日達成ボーナス'],
    [4, 200, 'cash', '4日達成ボーナス'],
    [5, 800, 'robux', '5日達成ボーナス'],
    [6, 2000, 'robux', '6日達成ボーナス'],
  ];
  for (const row of defaults) {
    insert.run(...row);
  }

  // Migrate: add reward_type column if missing
  const cols = db.prepare("PRAGMA table_info(reward_config)").all();
  if (!cols.find(c => c.name === 'reward_type')) {
    db.exec("ALTER TABLE reward_config ADD COLUMN reward_type TEXT DEFAULT 'cash'");
    db.exec("UPDATE reward_config SET reward_type = 'robux' WHERE day_number >= 5");
  }

  // Default settings
  db.prepare(
    "INSERT OR IGNORE INTO settings (key, value) VALUES ('quest_name', '今日の勉強ミッション')"
  ).run();
  db.prepare(
    "INSERT OR IGNORE INTO settings (key, value) VALUES ('child_name', '')"
  ).run();
  db.prepare(
    "INSERT OR IGNORE INTO settings (key, value) VALUES ('monthly_target', '20')"
  ).run();
  db.prepare(
    "INSERT OR IGNORE INTO settings (key, value) VALUES ('parent_password', '1234')"
  ).run();

  db.close();
}

module.exports = { getDb, initDb };
