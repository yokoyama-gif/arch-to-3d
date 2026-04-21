// Track open AI tabs: { aiId: tabId }
const aiTabs = {};

const AI_SERVICES = [
  { id: 'chatgpt',    name: 'ChatGPT',    url: 'https://chatgpt.com/',               emoji: '🤖', color: '#10a37f' },
  { id: 'claude',     name: 'Claude',     url: 'https://claude.ai/',                 emoji: '🔮', color: '#cc785c' },
  { id: 'gemini',     name: 'Gemini',     url: 'https://gemini.google.com/',         emoji: '✨', color: '#4285f4' },
  { id: 'perplexity', name: 'Perplexity', url: 'https://www.perplexity.ai/',         emoji: '🔍', color: '#20b2aa' },
  { id: 'grok',       name: 'Grok',       url: 'https://grok.com/',                  emoji: '⚡', color: '#1da1f2' },
  { id: 'copilot',    name: 'Copilot',    url: 'https://copilot.microsoft.com/',     emoji: '🪄', color: '#0078d4' },
];

// Open side panel when extension icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
});

// Remove stale tab references when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  for (const [aiId, tid] of Object.entries(aiTabs)) {
    if (tid === tabId) delete aiTabs[aiId];
  }
});

// Notify side panel when a tracked tab navigates (e.g., user logs in)
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== 'complete') return;
  const aiId = Object.keys(aiTabs).find(k => aiTabs[k] === tabId);
  if (!aiId) return;
  chrome.runtime.sendMessage({ type: 'TAB_READY', aiId }).catch(() => {});
});

function waitForTabLoad(tabId, timeoutMs = 30000) {
  return new Promise((resolve) => {
    const done = () => setTimeout(resolve, 1500); // extra wait for SPA hydration
    const listener = (id, info) => {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        done();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); resolve(); }, timeoutMs);
  });
}

async function ensureTab(aiId) {
  const service = AI_SERVICES.find(s => s.id === aiId);
  if (!service) throw new Error('Unknown AI: ' + aiId);

  if (aiTabs[aiId]) {
    try {
      await chrome.tabs.get(aiTabs[aiId]);
      return aiTabs[aiId];
    } catch {
      delete aiTabs[aiId];
    }
  }

  const tab = await chrome.tabs.create({ url: service.url, active: false });
  aiTabs[aiId] = tab.id;
  await waitForTabLoad(tab.id);
  return tab.id;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {

    case 'GET_AI_SERVICES':
      sendResponse({ services: AI_SERVICES });
      return false;

    case 'GET_TAB_STATUSES': {
      const statuses = {};
      AI_SERVICES.forEach(s => { statuses[s.id] = aiTabs[s.id] ?? null; });
      sendResponse({ statuses });
      return false;
    }

    case 'OPEN_AI_TAB':
      ensureTab(message.aiId)
        .then(tabId => sendResponse({ tabId }))
        .catch(e => sendResponse({ error: e.message }));
      return true;

    case 'FOCUS_AI_TAB': {
      const tabId = aiTabs[message.aiId];
      if (tabId) {
        chrome.tabs.update(tabId, { active: true });
        chrome.tabs.get(tabId).then(t => chrome.windows.update(t.windowId, { focused: true })).catch(() => {});
      }
      return false;
    }

    case 'CLOSE_AI_TAB': {
      const tabId = aiTabs[message.aiId];
      if (tabId) {
        chrome.tabs.remove(tabId).catch(() => {});
        delete aiTabs[message.aiId];
      }
      sendResponse({ ok: true });
      return false;
    }

    case 'SEND_PROMPT': {
      const { prompt, promptId, enabledAIs } = message;

      (async () => {
        const results = await Promise.allSettled(
          enabledAIs.map(async (aiId) => {
            // Notify side panel: injecting
            chrome.runtime.sendMessage({ type: 'AI_STATUS', aiId, status: 'injecting', promptId }).catch(() => {});

            const tabId = await ensureTab(aiId);

            // Small extra wait to let dynamic content settle
            await new Promise(r => setTimeout(r, 500));

            const result = await chrome.tabs.sendMessage(tabId, {
              type: 'INJECT_PROMPT',
              prompt,
              promptId,
            }).catch(e => ({ success: false, error: e.message }));

            const status = result?.success ? 'waiting' : 'error';
            chrome.runtime.sendMessage({ type: 'AI_STATUS', aiId, status, promptId, error: result?.error }).catch(() => {});
            return { aiId, ...result };
          })
        );
        sendResponse({ results: results.map(r => r.value ?? r.reason) });
      })();
      return true;
    }

    // Content scripts forward responses here; we relay to side panel
    case 'RESPONSE_UPDATE':
      chrome.runtime.sendMessage({ ...message }).catch(() => {});
      return false;
  }
});
