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
  const { week, clearedCount, isSunday, questName } = weekData;

  // Quest name
  document.getElementById('questName').textContent = questName;

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
    const robuxImg = '<img src="/images/robux.png" alt="Robux" class="reward-image" onerror="this.style.display=\'none\'">';

    card.innerHTML = `
      <div class="reward-day">${reward.day_number}日目</div>
      <div class="reward-icon">${unlocked ? '&#x1F381;' : '&#x1F512;'}</div>
      ${robuxImg}
      <div class="reward-amount ${isBig ? 'big' : ''}">${reward.reward_amount.toLocaleString()}</div>
      <div class="reward-label">Robux</div>
    `;
    track.appendChild(card);
  }
}

async function loadMonthly() {
  try {
    const res = await fetch('/api/quest/monthly');
    const data = await res.json();
    const card = document.getElementById('monthlyCard');

    if (!data.reward_description && !data.reward_amount) {
      document.getElementById('monthlySection').classList.add('hidden');
      return;
    }

    document.getElementById('monthlySection').classList.remove('hidden');
    card.innerHTML = `
      <div class="monthly-progress">今月のクリア日数: <strong>${data.clearedDays}日</strong></div>
      ${data.reward_amount ? `<div class="monthly-amount">${data.reward_amount.toLocaleString()} Robux</div>` : ''}
      ${data.reward_description ? `<div class="monthly-reward-text">${data.reward_description}</div>` : ''}
      ${data.achieved ? '<div style="margin-top:12px;font-size:24px;">&#x1F389; 達成済み！</div>' : ''}
    `;
  } catch (err) {
    console.error('Failed to load monthly:', err);
  }
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
