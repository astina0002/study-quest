const express = require('express');
const router = express.Router();
const { getDb } = require('../db/init');

// GET /api/parent/week - Get week data for parent view
router.get('/week', (req, res) => {
  const db = getDb();
  try {
    // Get Monday of current week (JST)
    const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const day = now.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setUTCDate(monday.getUTCDate() + diff);
    const mondayStr = monday.toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];

    const weekDates = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      weekDates.push(d.toISOString().split('T')[0]);
    }

    const placeholders = weekDates.map(() => '?').join(',');
    const quests = db
      .prepare(`SELECT * FROM daily_quests WHERE date IN (${placeholders})`)
      .all(...weekDates);

    const questMap = {};
    for (const q of quests) questMap[q.date] = q;

    const dayNames = ['月', '火', '水', '木', '金', '土'];
    const week = weekDates.map((date, i) => {
      const quest = questMap[date] || null;
      return {
        date,
        dayNumber: i + 1,
        dayName: dayNames[i],
        isToday: date === today,
        childCompleted: quest ? !!quest.child_completed : false,
        childCompletedAt: quest ? quest.child_completed_at : null,
        parentConfirmed: quest ? !!quest.parent_confirmed : false,
        parentConfirmedAt: quest ? quest.parent_confirmed_at : null,
        cleared: quest ? !!(quest.child_completed && quest.parent_confirmed) : false,
      };
    });

    const rewards = db.prepare('SELECT * FROM reward_config ORDER BY day_number').all();
    const questNameSetting = db.prepare("SELECT value FROM settings WHERE key = 'quest_name'").get();
    const childNameSetting = db.prepare("SELECT value FROM settings WHERE key = 'child_name'").get();

    res.json({
      week,
      rewards,
      questName: questNameSetting ? questNameSetting.value : '今日の勉強ミッション',
      childName: childNameSetting ? childNameSetting.value : '',
    });
  } finally {
    db.close();
  }
});

// POST /api/parent/confirm - Parent confirms a day
router.post('/confirm', (req, res) => {
  const db = getDb();
  try {
    const { date } = req.body;
    if (!date) return res.status(400).json({ error: 'date is required' });

    const now = new Date().toISOString();

    // Only confirm if child has completed
    const quest = db.prepare('SELECT * FROM daily_quests WHERE date = ?').get(date);
    if (!quest || !quest.child_completed) {
      return res.status(400).json({ error: 'まだ子供が完了していません' });
    }

    db.prepare(
      `UPDATE daily_quests SET parent_confirmed = 1, parent_confirmed_at = ? WHERE date = ?`
    ).run(now, date);

    res.json({ success: true, date });
  } finally {
    db.close();
  }
});

// POST /api/parent/unconfirm - Parent removes confirmation
router.post('/unconfirm', (req, res) => {
  const db = getDb();
  try {
    const { date } = req.body;
    if (!date) return res.status(400).json({ error: 'date is required' });

    db.prepare(
      `UPDATE daily_quests SET parent_confirmed = 0, parent_confirmed_at = NULL WHERE date = ?`
    ).run(date);

    res.json({ success: true, date });
  } finally {
    db.close();
  }
});

// PUT /api/parent/rewards - Update reward config (all days)
router.put('/rewards', (req, res) => {
  const db = getDb();
  try {
    const { rewards } = req.body;
    if (!Array.isArray(rewards)) return res.status(400).json({ error: 'invalid rewards' });

    const update = db.prepare(
      'UPDATE reward_config SET reward_amount = ?, reward_type = ?, reward_description = ? WHERE day_number = ?'
    );

    for (const r of rewards) {
      update.run(r.reward_amount, r.reward_type || 'cash', r.reward_description || '', r.day_number);
    }

    res.json({ success: true });
  } finally {
    db.close();
  }
});

// GET /api/parent/monthly - Get monthly progress + wishlist
router.get('/monthly', (req, res) => {
  const db = getDb();
  try {
    const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const month = now.toISOString().slice(0, 7);

    const monthStart = month + '-01';
    const nextMonth = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
      .toISOString()
      .split('T')[0];

    const result = db
      .prepare(
        `SELECT COUNT(*) as count FROM daily_quests
         WHERE date >= ? AND date < ? AND child_completed = 1 AND parent_confirmed = 1`
      )
      .get(monthStart, nextMonth);

    const targetSetting = db.prepare("SELECT value FROM settings WHERE key = 'monthly_target'").get();
    const target = targetSetting ? parseInt(targetSetting.value) : 20;

    const wishlist = db.prepare('SELECT * FROM wishlist WHERE granted = 0 ORDER BY created_at DESC').all();
    const grantedThisMonth = db.prepare('SELECT * FROM wishlist WHERE granted = 1 AND granted_month = ? ORDER BY created_at DESC').all(month);

    res.json({ month, clearedDays: result.count, target, wishlist, grantedThisMonth });
  } finally {
    db.close();
  }
});

// PUT /api/parent/monthly-target - Update monthly target days
router.put('/monthly-target', (req, res) => {
  const db = getDb();
  try {
    const { target } = req.body;
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('monthly_target', ?)").run(String(target || 20));
    res.json({ success: true });
  } finally {
    db.close();
  }
});

// POST /api/parent/wishlist/:id/grant - Grant a wish item
router.post('/wishlist/:id/grant', (req, res) => {
  const db = getDb();
  try {
    const { id } = req.params;
    const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const month = now.toISOString().slice(0, 7);

    db.prepare('UPDATE wishlist SET granted = 1, granted_month = ? WHERE id = ?').run(month, id);
    res.json({ success: true });
  } finally {
    db.close();
  }
});

// DELETE /api/parent/wishlist/:id - Parent deletes a wish item
router.delete('/wishlist/:id', (req, res) => {
  const db = getDb();
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM wishlist WHERE id = ?').run(id);
    res.json({ success: true });
  } finally {
    db.close();
  }
});

// PUT /api/parent/quest-name - Update quest name
router.put('/quest-name', (req, res) => {
  const db = getDb();
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('quest_name', ?)").run(name);
    res.json({ success: true });
  } finally {
    db.close();
  }
});

// PUT /api/parent/child-name - Update child name
router.put('/child-name', (req, res) => {
  const db = getDb();
  try {
    const { name } = req.body;
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('child_name', ?)").run(name || '');
    res.json({ success: true });
  } finally {
    db.close();
  }
});

// GET /api/parent/goals - Get this week's goals
router.get('/goals', (req, res) => {
  const db = getDb();
  try {
    const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const day = now.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setUTCDate(monday.getUTCDate() + diff);

    const weekDates = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      weekDates.push(d.toISOString().split('T')[0]);
    }

    const placeholders = weekDates.map(() => '?').join(',');
    const goals = db.prepare(`SELECT * FROM daily_goals WHERE date IN (${placeholders})`).all(...weekDates);
    const goalMap = {};
    for (const g of goals) goalMap[g.date] = g.description;

    const dayNames = ['月', '火', '水', '木', '金', '土'];
    const today = now.toISOString().split('T')[0];
    const result = weekDates.map((date, i) => ({
      date,
      dayName: dayNames[i],
      isToday: date === today,
      goal: goalMap[date] || '',
    }));

    res.json({ goals: result });
  } finally {
    db.close();
  }
});

// PUT /api/parent/goals - Set a day's goal
router.put('/goals', (req, res) => {
  const db = getDb();
  try {
    const { date, description } = req.body;
    if (!date) return res.status(400).json({ error: 'date is required' });

    if (description && description.trim()) {
      db.prepare(
        'INSERT INTO daily_goals (date, description) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET description = ?'
      ).run(date, description.trim(), description.trim());
    } else {
      db.prepare('DELETE FROM daily_goals WHERE date = ?').run(date);
    }

    res.json({ success: true });
  } finally {
    db.close();
  }
});

// PUT /api/parent/password - Change parent password
router.put('/password', (req, res) => {
  const crypto = require('crypto');
  const db = getDb();
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'password is required' });

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    const hashed = salt + ':' + hash;

    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('parent_password', ?)").run(hashed);
    res.json({ success: true });
  } finally {
    db.close();
  }
});

module.exports = router;
