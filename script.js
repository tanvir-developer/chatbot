(() => {
  const chatEl = document.getElementById('chat');
  const composerEl = document.getElementById('composer');
  const messageEl = document.getElementById('message');
  const sendBtn = document.getElementById('sendBtn');
  const msgTpl = document.getElementById('msgTemplate');
  const scrollBtn = document.getElementById('scrollBtn');

  const HISTORY_KEY = 'gemini_chat_history_v1';
  const MODEL_NAME = 'gemini-2.5-flash';
  const API_KEY = 'AIzaSyA-yhek7ozS9_sJrtjgYb9GC3riMpzBGz4'; // TODO: replace with your actual key

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
      // Create system prompt for design attribution and conversation handling
      const systemPrompt = { role: 'user', parts: [{ text: 'You are J.A.R.V.I.S., a helpful AI assistant designed by Tanvir Shaikh. You are sophisticated, witty, and respond in a manner similar to JARVIS from Iron Man. When asked about who created you, designed you, or who your creator is, always mention that you were designed by Tanvir Shaikh. Respond naturally to greetings and casual conversation - for example, if someone says "hi" or "hello", respond with something like "Hello, sir" or "Greetings, sir". Be helpful, professional, and maintain the JARVIS personality throughout all interactions.' }] };
      
      const contents = [
        systemPrompt,
        ...messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
      ];
      
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
      
      // Handle different types of errors with user-friendly messages
      let errorMessage = 'Error: Something went wrong. Please try again.';
      
      if (err.message.includes('HTTP 429') || err.message.includes('RESOURCE_EXHAUSTED')) {
        // Rate limit exceeded - show friendly quota message
        errorMessage = '🚫 Daily limit reached\n\nI\'ve hit my daily conversation limit (20 messages per day for the free tier). Please try again tomorrow or consider upgrading your Gemini API plan.\n\nFor more information, visit: https://ai.google.dev/gemini-api/docs/rate-limits';
      } else if (err.message.includes('HTTP 400')) {
        // Bad request - likely invalid API key or malformed request
        errorMessage = '❌ Invalid request\n\nPlease check your API key and try again. Make sure you have a valid Gemini API key configured.';
      } else if (err.message.includes('HTTP 403')) {
        // Forbidden - API key issues
        errorMessage = '🔐 Access denied\n\nPlease verify your Gemini API key is correct and has the necessary permissions.';
      } else if (err.message.includes('HTTP 500') || err.message.includes('HTTP 502') || err.message.includes('HTTP 503')) {
        // Server errors
        errorMessage = '🔧 Service temporarily unavailable\n\nGoogle\'s servers are experiencing issues. Please try again in a few minutes.';
      } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        // Network issues
        errorMessage = '📡 Connection error\n\nPlease check your internet connection and try again.';
      }
      
      aiNode.querySelector('[data-role="bubble"]').textContent = errorMessage;
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


