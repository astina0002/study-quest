async function loadParentData() {
  try {
    const [weekRes, monthlyRes] = await Promise.all([
      fetch('/api/parent/week'),
      fetch('/api/parent/monthly'),
    ]);
    const weekData = await weekRes.json();
    const monthlyData = await monthlyRes.json();

    renderParentWeek(weekData);
    renderRewardConfig(weekData.rewards);
    renderMonthlyConfig(monthlyData);

    document.getElementById('questNameInput').value = weekData.questName;
  } catch (err) {
    console.error('Failed to load parent data:', err);
  }
}

function renderParentWeek(data) {
  const container = document.getElementById('parentWeek');
  container.innerHTML = '';

  for (const day of data.week) {
    const row = document.createElement('div');
    row.className = 'parent-day-row';

    let statusBadge;
    if (day.cleared) {
      statusBadge = '<span class="status-badge cleared">クリア</span>';
    } else if (day.childCompleted) {
      statusBadge = '<span class="status-badge child-done">子供完了</span>';
    } else {
      statusBadge = '<span class="status-badge pending">未完了</span>';
    }

    let actionBtn;
    if (day.cleared) {
      actionBtn = `<button class="confirm-btn undo" onclick="unconfirmDay('${day.date}')">取消</button>`;
    } else if (day.childCompleted) {
      actionBtn = `<button class="confirm-btn confirm" onclick="confirmDay('${day.date}')">確認</button>`;
    } else {
      actionBtn = '<button class="confirm-btn" disabled>-</button>';
    }

    row.innerHTML = `
      <div class="parent-day-info">
        <span class="parent-day-label ${day.isToday ? 'today' : ''}">${day.dayName}</span>
        <span>${day.date}</span>
        ${statusBadge}
      </div>
      ${actionBtn}
    `;
    container.appendChild(row);
  }
}

function renderRewardConfig(rewards) {
  const container = document.getElementById('rewardConfig');
  container.innerHTML = '';

  for (const r of rewards) {
    const row = document.createElement('div');
    row.className = 'reward-config-row';

    const isFixed = r.day_number >= 5;

    row.innerHTML = `
      <span class="reward-config-label">${r.day_number}日目</span>
      <input type="number" id="reward_amount_${r.day_number}" value="${r.reward_amount}"
             ${isFixed ? 'disabled' : ''} min="0" step="50">
      <span>Robux</span>
      <input type="text" id="reward_desc_${r.day_number}" value="${r.reward_description}"
             placeholder="説明" ${isFixed ? 'disabled' : ''}>
    `;
    container.appendChild(row);
  }
}

function renderMonthlyConfig(data) {
  const container = document.getElementById('monthlyConfig');
  container.innerHTML = `
    <div class="monthly-config">
      <div class="monthly-stats">
        今月のクリア日数: <strong>${data.clearedDays}日</strong>
      </div>
      <label>報酬説明</label>
      <textarea id="monthlyDesc" placeholder="例: ロブロックスのアイテム">${data.reward_description || ''}</textarea>
      <label>報酬額 (Robux)</label>
      <input type="number" id="monthlyAmount" value="${data.reward_amount || 0}" min="0" step="100">
      <div class="achieved-toggle">
        <input type="checkbox" id="monthlyAchieved" ${data.achieved ? 'checked' : ''}>
        <label for="monthlyAchieved">達成済み</label>
      </div>
      <button class="save-btn" onclick="saveMonthly()">月間ボーナス保存</button>
    </div>
  `;
}

async function confirmDay(date) {
  try {
    await fetch('/api/parent/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date }),
    });
    loadParentData();
  } catch (err) {
    alert('エラーが発生しました');
  }
}

async function unconfirmDay(date) {
  try {
    await fetch('/api/parent/unconfirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date }),
    });
    loadParentData();
  } catch (err) {
    alert('エラーが発生しました');
  }
}

async function saveRewards() {
  const rewards = [];
  for (let i = 1; i <= 4; i++) {
    rewards.push({
      day_number: i,
      reward_amount: parseInt(document.getElementById(`reward_amount_${i}`).value) || 0,
      reward_description: document.getElementById(`reward_desc_${i}`).value,
    });
  }

  try {
    await fetch('/api/parent/rewards', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rewards }),
    });
    alert('保存しました');
    loadParentData();
  } catch (err) {
    alert('保存に失敗しました');
  }
}

async function saveMonthly() {
  try {
    await fetch('/api/parent/monthly', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reward_description: document.getElementById('monthlyDesc').value,
        reward_amount: parseInt(document.getElementById('monthlyAmount').value) || 0,
        achieved: document.getElementById('monthlyAchieved').checked,
      }),
    });
    alert('保存しました');
    loadParentData();
  } catch (err) {
    alert('保存に失敗しました');
  }
}

async function updateQuestName() {
  const name = document.getElementById('questNameInput').value.trim();
  if (!name) return alert('クエスト名を入力してください');

  try {
    await fetch('/api/parent/quest-name', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    alert('保存しました');
  } catch (err) {
    alert('保存に失敗しました');
  }
}

// Auto refresh every 30 seconds
setInterval(loadParentData, 30000);

// Initial load
loadParentData();
