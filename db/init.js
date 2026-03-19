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
      reward_description TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS monthly_rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL UNIQUE,
      reward_description TEXT DEFAULT '',
      reward_amount INTEGER DEFAULT 0,
      achieved INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Default reward config (days 1-6)
  const insert = db.prepare(
    'INSERT OR IGNORE INTO reward_config (day_number, reward_amount, reward_description) VALUES (?, ?, ?)'
  );
  const defaults = [
    [1, 100, '1日目クリア報酬'],
    [2, 100, '2日目クリア報酬'],
    [3, 200, '3日目クリア報酬'],
    [4, 200, '4日目クリア報酬'],
    [5, 800, '5日目クリア報酬'],
    [6, 2000, '6日目クリア報酬'],
  ];
  for (const row of defaults) {
    insert.run(...row);
  }

  // Default quest name
  db.prepare(
    "INSERT OR IGNORE INTO settings (key, value) VALUES ('quest_name', '今日の勉強ミッション')"
  ).run();

  db.close();
}

module.exports = { getDb, initDb };
