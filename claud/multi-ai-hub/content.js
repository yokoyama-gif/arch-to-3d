/**
 * Content script — injected into each AI service page.
 * Receives INJECT_PROMPT messages, fills the input, submits,
 * and watches for the response via MutationObserver.
 */

const hostname = window.location.hostname;

// Per-service DOM strategies
const CONFIGS = {
  'chat.openai.com': chatgptConfig(),
  'chatgpt.com':     chatgptConfig(),
  'claude.ai':       claudeConfig(),
  'gemini.google.com': geminiConfig(),
  'perplexity.ai':     perplexityConfig(),
  'www.perplexity.ai': perplexityConfig(),
  'grok.com':          grokConfig(),
  'copilot.microsoft.com': copilotConfig(),
};

const cfg = CONFIGS[hostname];
if (!cfg) {
  // Not one of our target pages — do nothing
} else {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'PING') {
      sendResponse({ alive: true });
      return false;
    }
    if (msg.type === 'INJECT_PROMPT') {
      handleInject(msg.prompt, msg.promptId).then(sendResponse);
      return true; // async
    }
  });
}

// ─── Config factories ─────────────────────────────────────────────────────────

function chatgptConfig() {
  return {
    name: 'ChatGPT',
    getInput:    () => document.querySelector('#prompt-textarea'),
    getSubmit:   () => document.querySelector('button[data-testid="send-button"]'),
    getResponse: () => {
      const els = document.querySelectorAll('[data-message-author-role="assistant"]');
      return els.length ? els[els.length - 1].innerText.trim() : null;
    },
    isStreaming: () => !!document.querySelector('.result-streaming, [data-testid="stop-button"]'),
    inputType: 'textarea',
  };
}

function claudeConfig() {
  return {
    name: 'Claude',
    getInput: () =>
      document.querySelector('div[contenteditable="true"].ProseMirror') ||
      document.querySelector('[data-testid="chat-input"] [contenteditable="true"]') ||
      document.querySelector('div[contenteditable="true"]'),
    getSubmit: () =>
      document.querySelector('button[aria-label="Send Message"]') ||
      document.querySelector('button[data-testid="send-button"]') ||
      [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label')?.toLowerCase().includes('send')),
    getResponse: () => {
      const els = document.querySelectorAll('.font-claude-message, [data-testid="assistant-message"]');
      return els.length ? els[els.length - 1].innerText.trim() : null;
    },
    isStreaming: () => !!document.querySelector('[data-testid="stop-button"], .streaming'),
    inputType: 'contenteditable',
  };
}

function geminiConfig() {
  return {
    name: 'Gemini',
    getInput: () =>
      document.querySelector('.ql-editor[contenteditable="true"]') ||
      document.querySelector('rich-textarea [contenteditable="true"]') ||
      document.querySelector('[contenteditable="true"]'),
    getSubmit: () =>
      document.querySelector('button.send-button') ||
      document.querySelector('button[aria-label="Send message"]') ||
      document.querySelector('button[mattooltip="Send message"]'),
    getResponse: () => {
      const els = document.querySelectorAll('model-response .response-content, .model-response-text');
      return els.length ? els[els.length - 1].innerText.trim() : null;
    },
    isStreaming: () => !!document.querySelector('.loading-indicator, .pending'),
    inputType: 'contenteditable',
  };
}

function perplexityConfig() {
  return {
    name: 'Perplexity',
    getInput: () => document.querySelector('textarea[placeholder]') || document.querySelector('textarea'),
    getSubmit: () =>
      document.querySelector('button[aria-label="Submit"]') ||
      document.querySelector('button[type="submit"]'),
    getResponse: () => {
      const els = document.querySelectorAll('.prose, [data-testid="answer-content"]');
      return els.length ? els[els.length - 1].innerText.trim() : null;
    },
    isStreaming: () => !!document.querySelector('[class*="loading"], [class*="skeleton"]'),
    inputType: 'textarea',
  };
}

function grokConfig() {
  return {
    name: 'Grok',
    getInput: () => document.querySelector('textarea'),
    getSubmit: () =>
      document.querySelector('button[type="submit"]') ||
      [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label')?.toLowerCase().includes('send')),
    getResponse: () => {
      const els = document.querySelectorAll('[class*="message-content"]:not([class*="user"])');
      return els.length ? els[els.length - 1].innerText.trim() : null;
    },
    isStreaming: () => !!document.querySelector('[class*="loading"], [class*="generating"]'),
    inputType: 'textarea',
  };
}

function copilotConfig() {
  return {
    name: 'Copilot',
    getInput: () =>
      document.querySelector('textarea#userInput') ||
      document.querySelector('textarea[name="q"]') ||
      document.querySelector('textarea'),
    getSubmit: () =>
      document.querySelector('button#search-button') ||
      document.querySelector('button[aria-label="Submit"]') ||
      document.querySelector('button[type="submit"]'),
    getResponse: () => {
      const els = document.querySelectorAll('[class*="assistant"] [class*="message"], cib-message-group[source="bot"]');
      return els.length ? els[els.length - 1].innerText.trim() : null;
    },
    isStreaming: () => !!document.querySelector('[class*="loading"], cib-typing-indicator'),
    inputType: 'textarea',
  };
}

// ─── Injection helpers ────────────────────────────────────────────────────────

function fillTextarea(el, text) {
  el.focus();
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  if (setter) {
    setter.call(el, text);
  } else {
    el.value = text;
  }
  el.dispatchEvent(new Event('input',  { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function fillContentEditable(el, text) {
  el.focus();
  // Select all and replace to work with controlled editors (ProseMirror, Quill, etc.)
  document.execCommand('selectAll', false, null);
  document.execCommand('delete', false, null);
  document.execCommand('insertText', false, text);
  el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitFor(getFn, retries = 20, intervalMs = 500) {
  for (let i = 0; i < retries; i++) {
    const el = getFn();
    if (el) return el;
    await delay(intervalMs);
  }
  return null;
}

async function handleInject(prompt, promptId) {
  const input = await waitFor(cfg.getInput.bind(cfg));
  if (!input) return { success: false, error: 'Input field not found' };

  if (cfg.inputType === 'contenteditable') {
    fillContentEditable(input, prompt);
  } else {
    fillTextarea(input, prompt);
  }

  await delay(400);

  const submitBtn = cfg.getSubmit();
  if (submitBtn && !submitBtn.disabled) {
    submitBtn.click();
  } else {
    // Fallback: Enter key
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
    input.dispatchEvent(new KeyboardEvent('keyup',   { key: 'Enter', code: 'Enter', bubbles: true }));
  }

  watchResponse(promptId);
  return { success: true };
}

// ─── Response watcher ─────────────────────────────────────────────────────────

let activeObserver = null;

function watchResponse(promptId) {
  if (activeObserver) activeObserver.disconnect();

  let lastText = '';
  let stableTimer = null;

  function emit(text, done) {
    chrome.runtime.sendMessage({
      type: 'RESPONSE_UPDATE',
      promptId,
      ai: cfg.name,
      text,
      done,
    }).catch(() => {});
  }

  activeObserver = new MutationObserver(() => {
    const text = cfg.getResponse();
    if (!text || text === lastText) return;
    lastText = text;

    clearTimeout(stableTimer);
    if (!cfg.isStreaming()) {
      emit(text, true);
      activeObserver.disconnect();
      return;
    }
    emit(text, false);
    // If streaming stops for 3 s, mark done
    stableTimer = setTimeout(() => {
      const final = cfg.getResponse();
      emit(final || lastText, true);
      activeObserver.disconnect();
    }, 3000);
  });

  activeObserver.observe(document.body, { childList: true, subtree: true, characterData: true });

  // Hard stop after 3 minutes
  setTimeout(() => {
    activeObserver.disconnect();
    const final = cfg.getResponse();
    if (final) emit(final, true);
  }, 180_000);
}
