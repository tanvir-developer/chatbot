(() => {
  const chatEl = document.getElementById('chat');
  const composerEl = document.getElementById('composer');
  const messageEl = document.getElementById('message');
  const sendBtn = document.getElementById('sendBtn');
  const msgTpl = document.getElementById('msgTemplate');
  const scrollBtn = document.getElementById('scrollBtn');

  const HISTORY_KEY = 'gemini_chat_history_v1';
  const MODEL_NAME = 'gemini-1.5-flash';
  const API_KEY = 'AIzaSyB1zs6zZa3GBXySu0YElLxZdR5WS4Mhz68'; // TODO: replace with your actual key

  let isSending = false;
  let messages = [];
  let activeKey = API_KEY;
  let forceScroll = false; // force scroll to bottom on next message render

  function loadState() {
    const h = localStorage.getItem(HISTORY_KEY);
    if (h) { try { messages = JSON.parse(h) || []; } catch (_) { messages = []; } }
    renderAll();
    refreshUiState();
  }

  function refreshUiState() {
    sendBtn.disabled = !activeKey || isSending;
  }

  function addMessage(role, text, opts = {}) {
    const node = msgTpl.content.firstElementChild.cloneNode(true);
    if (role === 'user') node.classList.add('user');
    if (opts.loading) node.classList.add('loading');
    const name = role === 'user' ? 'Tony' : 'J.A.R.V.I.S.';
    const nameEl = node.querySelector('[data-role="name"]');
    if (nameEl) nameEl.textContent = name;
    node.querySelector('[data-role="bubble"]').textContent = text;
    chatEl.appendChild(node);
    // Auto-scroll if near bottom or when explicitly requested
    if (forceScroll || chatEl.scrollHeight - chatEl.clientHeight - chatEl.scrollTop < 120) {
      chatEl.scrollTop = chatEl.scrollHeight;
      forceScroll = false;
    }
    return node;
  }

  function renderAll() {
    chatEl.innerHTML = '';
    messages.forEach(m => addMessage(m.role, m.content));
  }

  function persistHistory() {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-40)));
  }

  async function sendMessage(text) {
    if (!activeKey) { alert('Provide your API key first.'); return; }

    const userMsg = { role: 'user', content: text };
    messages.push(userMsg);
    addMessage('user', text);
    const aiNode = addMessage('assistant', 'Processing…', { loading: true });
    isSending = true; refreshUiState();

    try {
      const contents = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${encodeURIComponent(activeKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents, generationConfig: { temperature: 0.7 } })
      });
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${t}`);
      }
      const data = await resp.json();
      const textOut = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || 'No response';

      aiNode.classList.remove('loading');
      aiNode.querySelector('[data-role="bubble"]').textContent = textOut;
      messages.push({ role: 'assistant', content: textOut });
      persistHistory();
    } catch (err) {
      aiNode.classList.remove('loading');
      aiNode.querySelector('[data-role="bubble"]').textContent = `Error: ${err.message}`;
    } finally {
      isSending = false; refreshUiState();
    }
  }

  function autoresize() {
    messageEl.style.height = 'auto';
    messageEl.style.height = Math.min(messageEl.scrollHeight, 160) + 'px';
  }

  composerEl.addEventListener('submit', e => {
    e.preventDefault();
    const text = messageEl.value.trim();
    if (!text || isSending) return;
    messageEl.value = '';
    autoresize();
    forceScroll = true;
    sendMessage(text);
  });

  messageEl.addEventListener('input', autoresize);
  messageEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); composerEl.requestSubmit(); }
  });

  // Scroll button visibility and behavior
  function updateScrollBtn() {
    const atBottom = chatEl.scrollHeight - chatEl.clientHeight - chatEl.scrollTop < 4;
    scrollBtn.style.display = atBottom ? 'none' : 'block';
  }
  chatEl.addEventListener('scroll', updateScrollBtn);
  window.addEventListener('resize', updateScrollBtn);
  scrollBtn.addEventListener('click', () => {
    chatEl.scrollTo({ top: chatEl.scrollHeight, behavior: 'smooth' });
  });

  loadState();
})();


