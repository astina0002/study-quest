let weekData = null;

async function loadWeek() {
  try {
    const res = await fetch('/api/quest/week');
    weekData = await res.json();
    renderWeek();
    renderRewards();
    loadMonthly();
  } catch (err) {
    console.error('Failed to load week data:', err);
  }
}

function renderWeek() {
  const { week, clearedCount, isSunday, questName, childName } = weekData;

  // Quest name & child name
  document.getElementById('questName').textContent = questName;
  const childNameEl = document.getElementById('childName');
  if (childName) {
    childNameEl.textContent = childName + ' のクエストボード';
    childNameEl.classList.remove('hidden');
  } else {
    childNameEl.classList.add('hidden');
  }

  // Sunday check
  if (isSunday) {
    document.getElementById('sundayScreen').classList.remove('hidden');
    document.getElementById('questBoard').classList.add('hidden');
    return;
  }

  // Progress
  document.getElementById('progressText').textContent = `${clearedCount} / 6 日クリア`;
  document.getElementById('progressFill').style.width = `${(clearedCount / 6) * 100}%`;

  // Day cards
  const container = document.getElementById('questDays');
  container.innerHTML = '';

  let todayStatus = null;

  for (const day of week) {
    const card = document.createElement('div');
    card.className = 'quest-day';

    if (day.cleared) {
      card.classList.add('cleared');
    } else if (day.childCompleted && !day.parentConfirmed) {
      card.classList.add('waiting');
    }
    if (day.isToday) {
      card.classList.add('today');
      todayStatus = day;
    }

    let statusIcon;
    if (day.cleared) {
      statusIcon = '&#x2705;';
    } else if (day.childCompleted) {
      statusIcon = '&#x23F3;';
    } else if (day.isPast) {
      statusIcon = '&#x274C;';
    } else if (day.isToday) {
      statusIcon = '&#x1F525;';
    } else {
      statusIcon = '&#x1F512;';
    }

    card.innerHTML = `
      <div class="day-name">${day.dayName}曜日</div>
      <div class="day-number">${day.dayNumber}</div>
      <div class="day-status">${statusIcon}</div>
    `;
    container.appendChild(card);
  }

  // Today's action
  const todayAction = document.getElementById('todayAction');
  const waitingParent = document.getElementById('waitingParent');
  const todayCleared = document.getElementById('todayCleared');

  todayAction.classList.add('hidden');
  waitingParent.classList.add('hidden');
  todayCleared.classList.add('hidden');

  if (todayStatus) {
    if (todayStatus.cleared) {
      todayCleared.classList.remove('hidden');
    } else if (todayStatus.childCompleted) {
      waitingParent.classList.remove('hidden');
    } else {
      todayAction.classList.remove('hidden');
    }
  }
}

function renderRewards() {
  const { rewards, clearedCount } = weekData;
  const track = document.getElementById('rewardTrack');
  track.innerHTML = '';

  for (const reward of rewards) {
    const card = document.createElement('div');
    card.className = 'reward-card';

    const unlocked = clearedCount >= reward.day_number;
    card.classList.add(unlocked ? 'unlocked' : 'locked');

    const isBig = reward.day_number >= 5;
    const isRobux = reward.reward_type === 'robux';
    const unit = isRobux ? 'Robux' : '円';
    const robuxImage = reward.reward_amount >= 2000 ? '/images/robux_2000.jpg' : '/images/robux_800.jpg';
    const rewardImg = isRobux
      ? `<img src="${robuxImage}" alt="Robux" class="reward-image" onerror="this.style.display='none'">`
      : '<div class="reward-cash-icon">&#x1F4B0;</div>';

    card.innerHTML = `
      <div class="reward-day">${reward.day_number}日達成</div>
      <div class="reward-icon">${unlocked ? '&#x1F381;' : '&#x1F512;'}</div>
      ${rewardImg}
      <div class="reward-amount ${isBig ? 'big' : ''}">${reward.reward_amount.toLocaleString()}</div>
      <div class="reward-label">${unit}</div>
    `;
    track.appendChild(card);
  }
}

async function loadMonthly() {
  try {
    const res = await fetch('/api/quest/monthly');
    const data = await res.json();

    // Monthly progress
    const progressCard = document.getElementById('monthlyProgress');
    const pct = Math.min(100, Math.round((data.clearedDays / data.target) * 100));
    progressCard.innerHTML = `
      <div class="monthly-target-info">
        <span>目標: <strong>${data.target}日</strong>達成で欲しいものゲット！</span>
        <span class="monthly-count">${data.clearedDays} / ${data.target} 日</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill monthly-fill ${data.achieved ? 'achieved' : ''}" style="width: ${pct}%"></div>
      </div>
      ${data.achieved ? '<div class="monthly-achieved">&#x1F389; 目標達成！おめでとう！欲しいものをリクエストしよう！</div>' : ''}
    `;

    // Wishlist
    const wishlistEl = document.getElementById('wishlistItems');
    if (data.wishlist.length === 0) {
      wishlistEl.innerHTML = '<div class="wishlist-empty">欲しいものを追加してみよう！</div>';
    } else {
      wishlistEl.innerHTML = data.wishlist.map(item => `
        <div class="wishlist-item">
          <span class="wish-text">${escapeHtml(item.description)}</span>
          <button class="wish-delete" onclick="deleteWish(${item.id})">&#x2716;</button>
        </div>
      `).join('');
    }

    // Granted this month
    const grantedEl = document.getElementById('grantedItems');
    if (data.grantedThisMonth.length > 0) {
      grantedEl.innerHTML = '<div class="granted-title">&#x1F381; 今月もらったもの</div>' +
        data.grantedThisMonth.map(item => `
          <div class="granted-item">
            <span>&#x2728; ${escapeHtml(item.description)}</span>
          </div>
        `).join('');
    } else {
      grantedEl.innerHTML = '';
    }
  } catch (err) {
    console.error('Failed to load monthly:', err);
  }
}

async function addWish() {
  const input = document.getElementById('wishInput');
  const description = input.value.trim();
  if (!description) return;

  try {
    const res = await fetch('/api/quest/wishlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description }),
    });
    const data = await res.json();
    if (data.success) {
      input.value = '';
      loadMonthly();
    } else {
      alert(data.error || 'エラーが発生しました');
    }
  } catch (err) {
    alert('通信エラーが発生しました');
  }
}

async function deleteWish(id) {
  try {
    await fetch(`/api/quest/wishlist/${id}`, { method: 'DELETE' });
    loadMonthly();
  } catch (err) {
    alert('通信エラーが発生しました');
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function completeQuest() {
  const btn = document.getElementById('completeBtn');
  btn.disabled = true;

  try {
    const res = await fetch('/api/quest/complete', { method: 'POST' });
    const data = await res.json();

    if (data.success) {
      // Show clear animation
      showClearAnimation();
      // Reload data after animation
      setTimeout(() => {
        loadWeek();
      }, 2500);
    } else {
      alert(data.error || 'エラーが発生しました');
      btn.disabled = false;
    }
  } catch (err) {
    alert('通信エラーが発生しました');
    btn.disabled = false;
  }
}

function showClearAnimation() {
  const overlay = document.getElementById('clearOverlay');
  overlay.classList.remove('hidden');
  setTimeout(() => {
    overlay.classList.add('hidden');
  }, 2500);
}

// Auto refresh every 30 seconds
setInterval(loadWeek, 30000);

// Initial load
loadWeek();
