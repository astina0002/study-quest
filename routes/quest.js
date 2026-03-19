const express = require('express');
const router = express.Router();
const { getDb } = require('../db/init');

// Get Monday of the current week (JST)
function getWeekMonday() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000); // JST
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday=1
  const monday = new Date(now);
  monday.setUTCDate(monday.getUTCDate() + diff);
  return monday.toISOString().split('T')[0];
}

// Get today's date in JST
function getTodayJST() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return now.toISOString().split('T')[0];
}

// Get day of week (1=Mon, 7=Sun) in JST
function getDayOfWeekJST() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const day = now.getUTCDay();
  return day === 0 ? 7 : day;
}

// GET /api/quest/week - Get current week's quest status
router.get('/week', (req, res) => {
  const db = getDb();
  try {
    const monday = getWeekMonday();
    const today = getTodayJST();
    const dayOfWeek = getDayOfWeekJST();

    // Generate dates for Mon-Sat
    const weekDates = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      weekDates.push(d.toISOString().split('T')[0]);
    }

    // Get quests for this week
    const placeholders = weekDates.map(() => '?').join(',');
    const quests = db
      .prepare(`SELECT * FROM daily_quests WHERE date IN (${placeholders})`)
      .all(...weekDates);

    const questMap = {};
    for (const q of quests) {
      questMap[q.date] = q;
    }

    // Get reward config
    const rewards = db.prepare('SELECT * FROM reward_config ORDER BY day_number').all();

    // Get settings
    const questNameSetting = db.prepare("SELECT value FROM settings WHERE key = 'quest_name'").get();
    const questName = questNameSetting ? questNameSetting.value : '今日の勉強ミッション';
    const childNameSetting = db.prepare("SELECT value FROM settings WHERE key = 'child_name'").get();
    const childName = childNameSetting ? childNameSetting.value : '';

    // Build week data
    const dayNames = ['月', '火', '水', '木', '金', '土'];
    const week = weekDates.map((date, i) => {
      const quest = questMap[date] || null;
      return {
        date,
        dayNumber: i + 1,
        dayName: dayNames[i],
        isToday: date === today,
        isPast: date < today,
        childCompleted: quest ? !!quest.child_completed : false,
        parentConfirmed: quest ? !!quest.parent_confirmed : false,
        cleared: quest ? !!(quest.child_completed && quest.parent_confirmed) : false,
      };
    });

    // Count cleared days this week
    const clearedCount = week.filter((d) => d.cleared).length;

    res.json({
      today,
      dayOfWeek,
      isSunday: dayOfWeek === 7,
      questName,
      childName,
      week,
      rewards,
      clearedCount,
      weekMonday: monday,
    });
  } finally {
    db.close();
  }
});

// POST /api/quest/complete - Child marks today as complete
router.post('/complete', (req, res) => {
  const db = getDb();
  try {
    const today = getTodayJST();
    const dayOfWeek = getDayOfWeekJST();

    if (dayOfWeek === 7) {
      return res.status(400).json({ error: '日曜日は休みです！ゆっくり休んでね 🎮' });
    }

    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO daily_quests (date, child_completed, child_completed_at)
       VALUES (?, 1, ?)
       ON CONFLICT(date) DO UPDATE SET child_completed = 1, child_completed_at = ?`
    ).run(today, now, now);

    res.json({ success: true, date: today });
  } finally {
    db.close();
  }
});

// GET /api/quest/monthly - Get monthly reward info
router.get('/monthly', (req, res) => {
  const db = getDb();
  try {
    const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const month = now.toISOString().slice(0, 7);

    let monthly = db.prepare('SELECT * FROM monthly_rewards WHERE month = ?').get(month);
    if (!monthly) {
      monthly = { month, reward_description: '', reward_amount: 0, achieved: 0 };
    }

    // Count total cleared days this month
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

    res.json({
      month,
      ...monthly,
      clearedDays: result.count,
    });
  } finally {
    db.close();
  }
});

module.exports = router;
