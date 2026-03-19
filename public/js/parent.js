async function loadParentData() {
  try {
    const [weekRes, monthlyRes, goalsRes] = await Promise.all([
      fetch('/api/parent/week'),
      fetch('/api/parent/monthly'),
      fetch('/api/parent/goals'),
    ]);

    if (weekRes.status === 401 || monthlyRes.status === 401) {
      window.location.href = '/parent';
      return;
    }

    const weekData = await weekRes.json();
    const monthlyData = await monthlyRes.json();
    const goalsData = await goalsRes.json();

    renderDailyGoals(goalsData.goals);
    renderParentWeek(weekData);
    renderRewardConfig(weekData.rewards);
    renderMonthlyConfig(monthlyData);

    document.getElementById('questNameInput').value = weekData.questName;
    document.getElementById('childNameInput').value = weekData.childName || '';
  } catch (err) {
    console.error('Failed to load parent data:', err);
  }
}

function renderDailyGoals(goals) {
  const container = document.getElementById('dailyGoals');
  container.innerHTML = '';

  for (const g of goals) {
    const row = document.createElement('div');
    row.className = 'goal-row' + (g.isToday ? ' goal-today' : '');
    row.innerHTML = `
      <span class="goal-day-label ${g.isToday ? 'today' : ''}">${g.dayName}</span>
      <input type="text" class="goal-input" id="goal_${g.date}" value="${escapeHtml(g.goal)}"
             placeholder="例: ドリル5ページ、漢字プリント1枚">
      <button class="goal-save-btn" onclick="saveGoal('${g.date}')">保存</button>
    `;
    container.appendChild(row);
  }
}

async function saveGoal(date) {
  const input = document.getElementById(`goal_${date}`);
  try {
    await fetch('/api/parent/goals', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, description: input.value }),
    });
    input.classList.add('goal-saved');
    setTimeout(() => input.classList.remove('goal-saved'), 1000);
  } catch (err) {
    alert('保存に失敗しました');
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

    const rewardType = r.reward_type || 'cash';
    const isItem = rewardType === 'item';

    row.innerHTML = `
      <span class="reward-config-label">${r.day_number}日達成</span>
      <select id="reward_type_${r.day_number}" onchange="toggleRewardFields(${r.day_number})">
        <option value="cash" ${rewardType === 'cash' ? 'selected' : ''}>現金 (円)</option>
        <option value="robux" ${rewardType === 'robux' ? 'selected' : ''}>Robux</option>
        <option value="item" ${rewardType === 'item' ? 'selected' : ''}>アイテム</option>
      </select>
      <input type="number" id="reward_amount_${r.day_number}" value="${r.reward_amount}"
             min="0" step="50" class="${isItem ? 'hidden' : ''}" placeholder="金額">
      <input type="text" id="reward_desc_${r.day_number}" value="${r.reward_description}"
             placeholder="${isItem ? 'アイテム名を入力' : '説明'}">
    `;
    container.appendChild(row);
  }
}

function toggleRewardFields(dayNumber) {
  const type = document.getElementById(`reward_type_${dayNumber}`).value;
  const amountInput = document.getElementById(`reward_amount_${dayNumber}`);
  const descInput = document.getElementById(`reward_desc_${dayNumber}`);

  if (type === 'item') {
    amountInput.classList.add('hidden');
    descInput.placeholder = 'アイテム名を入力';
  } else {
    amountInput.classList.remove('hidden');
    descInput.placeholder = '説明';
  }
}

function renderMonthlyConfig(data) {
  const container = document.getElementById('monthlyConfig');
  container.innerHTML = `
    <div class="monthly-config">
      <div class="monthly-stats">
        今月のクリア日数: <strong>${data.clearedDays}日</strong> / 目標 ${data.target}日
        ${data.clearedDays >= data.target ? ' &#x1F389; 達成！' : ''}
      </div>
      <label>月間目標日数</label>
      <div class="input-group">
        <input type="number" id="monthlyTarget" value="${data.target}" min="1" max="26" step="1">
        <button onclick="saveMonthlyTarget()">保存</button>
      </div>
    </div>
  `;

  // Wishlist management
  const wishEl = document.getElementById('wishlistManage');
  let html = '';

  if (data.wishlist.length === 0) {
    html += '<p class="note">子供がまだ欲しいものを追加していません</p>';
  } else {
    html += '<div class="parent-wishlist">';
    for (const item of data.wishlist) {
      html += `
        <div class="parent-wish-row">
          <span class="wish-text">${escapeHtml(item.description)}</span>
          <div class="wish-actions">
            <button class="confirm-btn confirm" onclick="grantWish(${item.id})">プレゼント</button>
            <button class="confirm-btn undo" onclick="deleteWish(${item.id})">削除</button>
          </div>
        </div>`;
    }
    html += '</div>';
  }

  if (data.grantedThisMonth.length > 0) {
    html += '<div class="granted-title" style="margin-top:16px;">&#x1F381; 今月プレゼント済み</div>';
    for (const item of data.grantedThisMonth) {
      html += `<div class="granted-item">${escapeHtml(item.description)}</div>`;
    }
  }

  wishEl.innerHTML = html;
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
  for (let i = 1; i <= 6; i++) {
    rewards.push({
      day_number: i,
      reward_amount: parseInt(document.getElementById(`reward_amount_${i}`).value) || 0,
      reward_type: document.getElementById(`reward_type_${i}`).value,
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

async function saveMonthlyTarget() {
  try {
    await fetch('/api/parent/monthly-target', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: parseInt(document.getElementById('monthlyTarget').value) || 20 }),
    });
    alert('保存しました');
    loadParentData();
  } catch (err) {
    alert('保存に失敗しました');
  }
}

async function grantWish(id) {
  if (!confirm('このアイテムをプレゼント済みにしますか？')) return;
  try {
    await fetch(`/api/parent/wishlist/${id}/grant`, { method: 'POST' });
    loadParentData();
  } catch (err) {
    alert('エラーが発生しました');
  }
}

async function deleteWish(id) {
  if (!confirm('このアイテムを削除しますか？')) return;
  try {
    await fetch(`/api/parent/wishlist/${id}`, { method: 'DELETE' });
    loadParentData();
  } catch (err) {
    alert('エラーが発生しました');
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function updateChildName() {
  const name = document.getElementById('childNameInput').value.trim();

  try {
    await fetch('/api/parent/child-name', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    alert('保存しました');
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

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/parent';
}

async function changePassword() {
  const pw = document.getElementById('newPassword').value;
  if (!pw) return alert('新しいパスワードを入力してください');

  try {
    const res = await fetch('/api/parent/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    if (res.ok) {
      alert('パスワードを変更しました');
      document.getElementById('newPassword').value = '';
    } else {
      alert('変更に失敗しました');
    }
  } catch (err) {
    alert('通信エラーが発生しました');
  }
}

// Auto refresh every 30 seconds
setInterval(loadParentData, 30000);

// Initial load
loadParentData();
