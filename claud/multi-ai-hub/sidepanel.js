/** Side panel — orchestrates the UI and communicates with background.js */

let services = [];
let enabledAIs = new Set();
let responses = {};   // { aiId: { text, done, status } }
let promptId = 0;
let isSending = false;

const $ = id => document.getElementById(id);

// ─── Init ──────────────────────────────────────────────────────────────────

async function init() {
  const { services: svc } = await bg('GET_AI_SERVICES');
  services = svc;

  const saved = await loadEnabled();
  enabledAIs = new Set(saved.length ? saved : services.map(s => s.id));

  renderServiceChips();
  renderEmptyState();

  $('prompt-input').addEventListener('input', onPromptInput);
  $('prompt-input').addEventListener('keydown', onPromptKeydown);
  $('btn-send').addEventListener('click', sendPrompt);
  $('btn-clear-prompt').addEventListener('click', () => {
    $('prompt-input').value = '';
    $('char-count').textContent = '0';
  });
}

// ─── Service chips ─────────────────────────────────────────────────────────

function renderServiceChips() {
  const grid = $('services-grid');
  grid.innerHTML = '';
  services.forEach(s => {
    const chip = document.createElement('div');
    chip.className = 'service-chip' + (enabledAIs.has(s.id) ? ' enabled' : '');
    chip.style.setProperty('--chip-color', s.color);
    chip.dataset.aiId = s.id;
    chip.innerHTML = `
      <span class="chip-dot"></span>
      <span>${s.emoji} ${s.name}</span>
      <span class="chip-status"></span>
    `;
    chip.addEventListener('click', () => toggleService(s.id));
    grid.appendChild(chip);
  });
}

function toggleService(aiId) {
  if (enabledAIs.has(aiId)) {
    enabledAIs.delete(aiId);
  } else {
    enabledAIs.add(aiId);
  }
  saveEnabled([...enabledAIs]);
  renderServiceChips();
  applyChipStatuses();
}

function applyChipStatuses() {
  services.forEach(s => {
    const chip = document.querySelector(`.service-chip[data-ai-id="${s.id}"]`);
    if (!chip) return;
    const r = responses[s.id];
    const statusEl = chip.querySelector('.chip-status');

    chip.className = 'service-chip' + (enabledAIs.has(s.id) ? ' enabled' : '');
    chip.style.setProperty('--chip-color', s.color);

    if (r) {
      chip.classList.add('status-' + r.status);
      const labels = { injecting: '送信中…', waiting: '生成中…', done: '完了✓', error: 'エラー' };
      statusEl.textContent = labels[r.status] ?? '';
    } else {
      statusEl.textContent = '';
    }
  });
}

// ─── Response cards ────────────────────────────────────────────────────────

function renderEmptyState() {
  const section = $('responses-section');
  section.innerHTML = `
    <div id="empty-state">
      <div class="empty-icon">💬</div>
      <p>上のAIを選んでプロンプトを入力してください</p>
    </div>
  `;
}

function renderResponseCards() {
  const section = $('responses-section');
  const activeServices = services.filter(s => enabledAIs.has(s.id));

  if (!activeServices.length) {
    renderEmptyState();
    return;
  }

  // Keep existing cards; only update / add
  activeServices.forEach(s => {
    let card = document.querySelector(`.response-card[data-ai-id="${s.id}"]`);
    if (!card) {
      card = createCard(s);
      section.appendChild(card);
    }
    updateCard(card, s);
  });

  // Remove cards for deactivated services
  document.querySelectorAll('.response-card').forEach(card => {
    if (!activeServices.find(s => s.id === card.dataset.aiId)) card.remove();
  });

  // Remove empty state if cards exist
  const empty = $('empty-state');
  if (empty) empty.remove();
}

function createCard(service) {
  const card = document.createElement('div');
  card.className = 'response-card';
  card.dataset.aiId = service.id;
  card.style.setProperty('--card-color', service.color);
  card.innerHTML = `
    <div class="card-header">
      <div class="card-title">
        <span>${service.emoji}</span>
        <span>${service.name}</span>
        <span class="card-status-text" style="font-weight:400;color:var(--text-dim);font-size:11px;"></span>
      </div>
      <div class="card-actions">
        <button class="card-btn btn-open-tab">開く 🔗</button>
        <button class="card-btn btn-copy" style="display:none;">コピー</button>
      </div>
    </div>
    <div class="card-body placeholder">送信待ち…</div>
  `;

  card.querySelector('.btn-open-tab').addEventListener('click', () => {
    bg('OPEN_AI_TAB', { aiId: service.id }).then(() => {
      bg('FOCUS_AI_TAB', { aiId: service.id });
    });
  });

  card.querySelector('.btn-copy').addEventListener('click', () => {
    const text = responses[service.id]?.text ?? '';
    navigator.clipboard.writeText(text).catch(() => {});
  });

  return card;
}

function updateCard(card, service) {
  const r = responses[service.id];
  const body = card.querySelector('.card-body');
  const statusText = card.querySelector('.card-status-text');
  const copyBtn = card.querySelector('.btn-copy');

  card.classList.toggle('active', !!r);

  if (!r) {
    body.className = 'card-body placeholder';
    body.textContent = '送信待ち…';
    statusText.textContent = '';
    copyBtn.style.display = 'none';
    return;
  }

  const statusLabels = { injecting: '送信中…', waiting: '生成中…', done: '', error: 'エラー' };
  statusText.textContent = statusLabels[r.status] ?? '';

  if (r.status === 'error') {
    body.className = 'card-body';
    body.textContent = r.error ?? 'プロンプトの送信に失敗しました';
    return;
  }

  if (r.text) {
    body.className = 'card-body' + (r.done ? '' : ' streaming');
    body.textContent = r.text;
    copyBtn.style.display = r.done ? '' : 'none';
    // Auto-scroll to bottom
    body.scrollTop = body.scrollHeight;
  } else {
    body.className = 'card-body placeholder streaming';
    body.textContent = '生成中';
  }
}

// ─── Send prompt ───────────────────────────────────────────────────────────

async function sendPrompt() {
  const prompt = $('prompt-input').value.trim();
  if (!prompt || isSending) return;
  const enabled = [...enabledAIs];
  if (!enabled.length) {
    alert('送信するAIを1つ以上選択してください');
    return;
  }

  isSending = true;
  promptId++;
  const currentPromptId = promptId;

  // Reset response state
  responses = {};
  enabled.forEach(aiId => {
    responses[aiId] = { status: 'injecting', text: '', done: false };
  });

  $('btn-send').disabled = true;
  $('btn-send-label').textContent = '送信中…';

  // Ensure cards are shown
  renderResponseCards();
  applyChipStatuses();

  await bg('SEND_PROMPT', { prompt, promptId: currentPromptId, enabledAIs: enabled });

  $('btn-send').disabled = false;
  $('btn-send-label').textContent = '送信';
  isSending = false;
}

// ─── Prompt input handlers ─────────────────────────────────────────────────

function onPromptInput(e) {
  $('char-count').textContent = e.target.value.length;
}

function onPromptKeydown(e) {
  if (e.key === 'Enter' && e.ctrlKey) {
    e.preventDefault();
    sendPrompt();
  }
}

// ─── Message listener (responses from background) ─────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'AI_STATUS') {
    const { aiId, status, error } = msg;
    if (!responses[aiId]) responses[aiId] = { text: '', done: false };
    responses[aiId].status = status;
    if (error) responses[aiId].error = error;
    const card = document.querySelector(`.response-card[data-ai-id="${aiId}"]`);
    const service = services.find(s => s.id === aiId);
    if (card && service) updateCard(card, service);
    applyChipStatuses();
  }

  if (msg.type === 'RESPONSE_UPDATE') {
    const service = services.find(s => s.name === msg.ai);
    if (!service) return;
    const aiId = service.id;
    responses[aiId] = { status: msg.done ? 'done' : 'waiting', text: msg.text, done: msg.done };
    const card = document.querySelector(`.response-card[data-ai-id="${aiId}"]`);
    if (card) updateCard(card, service);
    applyChipStatuses();
  }
});

// ─── Persistence ───────────────────────────────────────────────────────────

function loadEnabled() {
  return new Promise(resolve => {
    chrome.storage.local.get(['enabledAIs'], r => resolve(r.enabledAIs ?? []));
  });
}

function saveEnabled(ids) {
  chrome.storage.local.set({ enabledAIs: ids });
}

// ─── Helper: send message to background ───────────────────────────────────

function bg(type, data = {}) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type, ...data }, r => resolve(r ?? {}));
  });
}

// ─── Start ─────────────────────────────────────────────────────────────────

init();
