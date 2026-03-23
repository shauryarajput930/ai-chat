const API_KEY = 'AIzaSyA32dbBqGCGVQaSEL1yR3foQHVawtkjgxA';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;

const SYSTEM_PROMPT = 'You are NeuralChat, a helpful, friendly, and knowledgeable AI assistant. Respond clearly, concisely, and helpfully.';

/**
 * Call AI API with a message array.
 * Falls back to local responses when offline.
 * @param {Array<{role:string, content:string}>} messages
 * @param {string} [sys] - optional system instruction override
 * @returns {Promise<string>}
 */
async function gemini(messages, sys = SYSTEM_PROMPT) {
  if (!navigator.onLine) return getLocalFallback();
  try {
    const contents = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));
    const body = { contents };
    if (sys) body.systemInstruction = { parts: [{ text: sys }] };

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text
      || 'Unable to get a response. Please try again.';
  } catch (err) {
    console.error('[NeuralChat] Gemini API error:', err);
    return getLocalFallback();
  }
}

const LOCAL_FALLBACKS = [
  "That's a fascinating question! Let me think through it — there are several angles worth considering here.",
  "Great point. The key insight is that most complex phenomena have surprisingly simple underlying principles once you find the right framing.",
  "Interesting — this touches on something deeper. The conventional wisdom here is partially right, but misses an important nuance.",
  "Here's how I'd approach it: start with the simplest possible model, verify it works, then layer in complexity. Occam's razor is underrated.",
  "The honest answer is that experts disagree here — which itself is informative. It means we're at the frontier of current understanding.",
  "Absolutely! To break it down simply: think of it as a system with inputs, processes, and outputs. Changing any element ripples through the whole.",
];
function getLocalFallback() {
  return LOCAL_FALLBACKS[Math.floor(Math.random() * LOCAL_FALLBACKS.length)];
}


/* ── 02. APP STATE ── */
const STORAGE_KEY  = 'nc_v4';
const BM_KEY       = 'nc_bm';
const STAR_KEY     = 'nc_star';
const THEME_KEY    = 'nc_theme';

let sessions      = [];       // Array of session objects
let activeId      = null;     // ID of current session
let isTyping      = false;    // Is AI responding?
let replyToId     = null;     // ID of message being replied to
let pendingFiles  = [];       // Files queued for attachment
let currentFolder = 'all';    // Sidebar folder filter
let searchQ       = '';       // Active search query
let recognition   = null;     // Web Speech API instance
let isRecording   = false;    // Is voice input active?

let bookmarks = JSON.parse(localStorage.getItem(BM_KEY)   || '[]');
let starred   = JSON.parse(localStorage.getItem(STAR_KEY) || '[]');


/* ── 03. STORAGE HELPERS ── */
const save     = ()  => localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
const load     = ()  => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } };
const saveBm   = ()  => localStorage.setItem(BM_KEY,   JSON.stringify(bookmarks));
const saveStar = ()  => localStorage.setItem(STAR_KEY, JSON.stringify(starred));
const active   = ()  => sessions.find(s => s.id === activeId) || null;
const uid      = ()  => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);


/* ── 04. THEME ── */
let theme = localStorage.getItem(THEME_KEY) || 'dark';

function setTheme(t) {
  theme = t;
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem(THEME_KEY, t);
}

// Init theme immediately
setTheme(theme);

document.getElementById('theme-btn').addEventListener('click', () => {
  setTheme(theme === 'dark' ? 'light' : 'dark');
});


/* ── 05. UTILITY FUNCTIONS ── */

/**
 * Format timestamp to HH:MM
 */
function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Format timestamp to "Jan 1, 2:30 PM"
 */
function fmtFull(ts) {
  return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Escape HTML special characters and convert newlines to <br>
 */
function esc(str) {
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/\n/g, '<br>');
}

/**
 * Escape HTML then wrap matched query text in <mark> tags
 */
function hlText(text, query) {
  const escaped = esc(text);
  if (!query) return escaped;
  const safeQ = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escaped.replace(new RegExp(`(${safeQ})`, 'gi'), '<mark>$1</mark>');
}

/**
 * Show a toast notification
 */
function toast(msg, duration = 2400) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), duration);
}


/* ── 06. MESSAGE ROW BUILDER ── */

/**
 * Build a complete message DOM row
 * @param {object} msg - message object
 * @param {string} [query] - optional search query for highlighting
 * @returns {HTMLElement}
 */
function mkRow(msg, query = '') {
  const row = document.createElement('div');
  const isS = starred.includes(msg.id);
  const isB = bookmarks.includes(msg.id);

  row.className = `msg-row ${msg.role}${msg.replyTo ? ' thread-reply' : ''}`;
  row.dataset.id = msg.id;

  const name   = msg.role === 'user' ? 'You' : 'NeuralChat';
  const body   = query ? hlText(msg.content, query) : esc(msg.content);

  // Avatar — use Gemini logo for AI, initials for user
  const avatarHtml = msg.role === 'ai'
    ? `<div class="avatar ai">
         <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
           <path d="M12 2C12 2 14 8.5 20 10C14 11.5 12 18 12 18C12 18 10 11.5 4 10C10 8.5 12 2 12 2Z" fill="white"/>
         </svg>
       </div>`
    : `<div class="avatar user">U</div>`;

  // Reply preview block
  let replyHtml = '';
  if (msg.replyTo) {
    const sess = active();
    const orig = sess?.messages.find(m => m.id === msg.replyTo);
    if (orig) {
      replyHtml = `
        <div class="reply-prev" data-jump="${orig.id}">
          <div class="rp-author">${orig.role === 'user' ? 'You' : 'NeuralChat'}</div>
          <div class="rp-text">${esc(orig.content.slice(0, 80))}${orig.content.length > 80 ? '…' : ''}</div>
        </div>`;
    }
  }

  // File attachments
  let fileHtml = '';
  if (msg.files?.length) {
    fileHtml = `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px">
      ${msg.files.map(f => `<div class="fchip">📎 ${esc(f)}</div>`).join('')}
    </div>`;
  }

  // Status indicators (star / bookmark)
  const starBadge = isS ? '<span style="font-size:10px;color:var(--star)">⭐</span>' : '';
  const bmBadge   = isB ? '<span style="font-size:10px;color:var(--accent)">🔖</span>' : '';

  // Speak button only for AI messages
  const speakBtn = msg.role === 'ai'
    ? `<button class="mab" data-a="speak" data-id="${msg.id}">🔊 Speak</button>`
    : '';

  row.innerHTML = `
    ${avatarHtml}
    <div class="msg-body">
      <div class="msg-meta">
        <span class="msg-name">${name}</span>
        <span class="msg-time">
          ${fmtTime(msg.ts)}
          <span class="time-full">${fmtFull(msg.ts)}</span>
        </span>
        ${starBadge}${bmBadge}
      </div>
      ${replyHtml}
      <div class="bubble ${msg.role}">${body}${fileHtml}</div>
      <div class="msg-actions">
        <button class="mab ${isS ? 'starred' : ''}"    data-a="star"     data-id="${msg.id}">${isS ? '⭐' : '☆'} ${isS ? 'Starred' : 'Star'}</button>
        <button class="mab ${isB ? 'bookmarked' : ''}" data-a="bm"       data-id="${msg.id}">🔖 ${isB ? 'Bookmarked' : 'Bookmark'}</button>
        <button class="mab"                            data-a="reply"    data-id="${msg.id}">↩ Reply</button>
        <button class="mab"                            data-a="copy"     data-id="${msg.id}">📋 Copy</button>
        ${speakBtn}
      </div>
    </div>`;

  // Reply-preview jump handler
  row.querySelectorAll('[data-jump]').forEach(el => {
    el.addEventListener('click', () => {
      const target = CA.querySelector(`[data-id="${el.dataset.jump}"]`);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  // Message action handlers
  row.querySelectorAll('[data-a]').forEach(btn => {
    btn.addEventListener('click', () => doMsgAction(btn.dataset.a, btn.dataset.id));
  });

  return row;
}

/**
 * Build the typing indicator row
 */
function mkTyping() {
  const row = document.createElement('div');
  row.className = 'msg-row ai';
  row.id = 'typing';
  row.innerHTML = `
    <div class="avatar ai">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M12 2C12 2 14 8.5 20 10C14 11.5 12 18 12 18C12 18 10 11.5 4 10C10 8.5 12 2 12 2Z" fill="white"/>
      </svg>
    </div>
    <div class="msg-body">
      <div class="msg-meta"><span class="msg-name">NeuralChat</span></div>
      <div class="bubble ai">
        <div class="typing-ind">
          <div class="td"></div><div class="td"></div><div class="td"></div>
        </div>
      </div>
    </div>`;
  return row;
}

/**
 * Scroll chat to the bottom
 */
function scrollEnd(smooth = true) {
  CA.scrollTo({ top: CA.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
}

/**
 * Refresh a single row in-place (after star/bookmark change)
 */
function refreshRow(msgId) {
  const sess = active();
  const msg  = sess?.messages.find(m => m.id === msgId);
  if (!msg) return;
  const existing = CA.querySelector(`[data-id="${msgId}"]`);
  if (existing) existing.replaceWith(mkRow(msg, searchQ));
}


/* ── 07. MESSAGE ACTIONS ── */

/**
 * Handle per-message action button clicks
 */
function doMsgAction(action, msgId) {
  const sess = active();
  const msg  = sess?.messages.find(m => m.id === msgId);
  if (!msg) return;

  switch (action) {
    case 'star': {
      const idx = starred.indexOf(msgId);
      if (idx >= 0) { starred.splice(idx, 1); toast('Unstarred'); }
      else           { starred.push(msgId);    toast('⭐ Starred'); }
      saveStar();
      refreshRow(msgId);
      break;
    }
    case 'bm': {
      const idx = bookmarks.indexOf(msgId);
      if (idx >= 0) { bookmarks.splice(idx, 1); toast('Bookmark removed'); }
      else           { bookmarks.push(msgId);    toast('🔖 Bookmarked'); }
      saveBm();
      renderBmBar();
      refreshRow(msgId);
      break;
    }
    case 'reply': {
      replyToId = msgId;
      const name = msg.role === 'user' ? 'You' : 'NeuralChat';
      document.getElementById('reply-bar-text').textContent =
        `${name}: ${msg.content.slice(0, 60)}${msg.content.length > 60 ? '…' : ''}`;
      document.getElementById('reply-bar').classList.add('show');
      MI.focus();
      break;
    }
    case 'copy':
      navigator.clipboard.writeText(msg.content).then(() => toast('📋 Copied!'));
      break;
    case 'speak':
      speakText(msg.content);
      break;
  }
}


/* ── 08. RENDER FUNCTIONS ── */

/**
 * Render the full chat for the active session
 */
function renderChat(sess) {
  CA.querySelectorAll('.msg-row').forEach(r => r.remove());

  if (!sess || !sess.messages.length) {
    WEL.style.display = '';
  } else {
    WEL.style.display = 'none';
    sess.messages.forEach(m => CA.appendChild(mkRow(m, searchQ)));
    scrollEnd(false);
  }
  renderBmBar();
}

/**
 * Render the sidebar conversation history
 */
function renderHistory() {
  const HL    = document.getElementById('history-list');
  const query = document.getElementById('sb-search').value.trim().toLowerCase();

  HL.innerHTML = '';

  // Filter by folder
  let list = [...sessions].reverse();
  if      (currentFolder === 'starred')  list = list.filter(s => s.starred);
  else if (currentFolder === 'archived') list = list.filter(s => s.archived);
  else if (currentFolder === 'all')      list = list.filter(s => !s.archived);
  else                                   list = list.filter(s => s.tags?.includes(currentFolder));

  // Filter by search query
  if (query) {
    list = list.filter(s =>
      s.title.toLowerCase().includes(query) ||
      s.messages.some(m => m.content.toLowerCase().includes(query))
    );
  }

  // Section label
  document.getElementById('sb-label').textContent =
    list.length
      ? (currentFolder === 'archived' ? 'Archived' : 'Recent')
      : 'No conversations';

  // Build items
  list.forEach(s => {
    const el = document.createElement('div');
    el.className = `history-item${s.id === activeId ? ' active' : ''}${s.starred ? ' starred' : ''}${s.archived ? ' archived' : ''}`;
    el.dataset.id = s.id;

    const tagsHtml = (s.tags || [])
      .map(t => `<span class="tag-chip ${t}">${t}</span>`)
      .join('');

    el.innerHTML = `
      <div class="hi-dot"></div>
      <span class="hi-text">${esc(s.title)}${tagsHtml}</span>
      <span class="hi-star">⭐</span>
      <div class="hi-actions">
        <button class="hi-act" data-a="star"  data-id="${s.id}" title="${s.starred  ? 'Unstar'    : 'Star'}">${s.starred  ? '⭐' : '☆'}</button>
        <button class="hi-act" data-a="arch"  data-id="${s.id}" title="${s.archived ? 'Unarchive' : 'Archive'}">${s.archived ? '↩' : '📦'}</button>
        <button class="hi-act" data-a="del"   data-id="${s.id}" title="Delete">🗑</button>
      </div>`;

    el.addEventListener('click', e => {
      if (e.target.closest('.hi-actions')) return;
      switchSess(s.id);
    });
    el.querySelectorAll('[data-a]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        doSessAction(btn.dataset.a, btn.dataset.id);
      });
    });

    HL.appendChild(el);
  });
}

/**
 * Handle sidebar session action (star / archive / delete)
 */
function doSessAction(action, id) {
  const s = sessions.find(x => x.id === id);
  if (!s) return;

  if (action === 'star') {
    s.starred = !s.starred;
    toast(s.starred ? '⭐ Chat starred' : 'Unstarred');
  }
  if (action === 'arch') {
    s.archived = !s.archived;
    toast(s.archived ? '📦 Archived' : 'Unarchived');
    if (s.id === activeId && s.archived) newSess();
  }
  if (action === 'del') {
    if (!confirm('Delete this conversation?')) return;
    sessions = sessions.filter(x => x.id !== id);
    if (id === activeId) {
      sessions.length ? switchSess(sessions[sessions.length - 1].id) : newSess();
    }
  }

  save();
  renderHistory();
}

/**
 * Render bookmark pips on the right edge of the chat
 */
function renderBmBar() {
  const bar  = document.getElementById('bm-bar');
  bar.innerHTML = '';
  const sess = active();
  if (!sess) return;

  const bms = sess.messages.filter(m => bookmarks.includes(m.id));
  if (bms.length) {
    bar.classList.add('show');
    bms.forEach(m => {
      const pip = document.createElement('button');
      pip.className = 'bm-pip';
      pip.title = m.content.slice(0, 40);
      pip.addEventListener('click', () => {
        const el = CA.querySelector(`[data-id="${m.id}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      bar.appendChild(pip);
    });
  } else {
    bar.classList.remove('show');
  }
}


/* ── 09. SESSION MANAGEMENT ── */

/**
 * Create a fresh session and make it active
 */
function newSess() {
  const s = {
    id: uid(),
    title: 'New Conversation',
    messages: [],
    tags: [],
    starred: false,
    archived: false
  };
  sessions.push(s);
  activeId = s.id;
  save();
  renderHistory();
  renderChat(s);
  document.getElementById('topbar-title').textContent = s.title;
  MI.focus();
}

/**
 * Switch to an existing session by ID
 */
function switchSess(id) {
  activeId = id;
  searchQ  = '';
  document.getElementById('search-input').value = '';
  document.getElementById('search-bar').classList.remove('show');
  document.getElementById('search-count').textContent = '';

  const sess = active();
  renderHistory();
  renderChat(sess);
  document.getElementById('topbar-title').textContent = sess?.title || 'Conversation';
  closeSB();
}


/* ── 10. SEND MESSAGE ── */

/**
 * Send a user message and get AI response
 */
async function send(text) {
  if (!text.trim() || isTyping) return;

  let sess = active();
  if (!sess) { newSess(); sess = active(); }

  WEL.style.display = 'none';

  // Build user message
  const fileNames = pendingFiles.map(f => f.name);
  const uMsg = {
    id:      uid(),
    role:    'user',
    content: text.trim(),
    ts:      Date.now(),
    replyTo: replyToId || null,
    files:   fileNames.length ? fileNames : null
  };
  sess.messages.push(uMsg);

  // Auto-title from first message
  if (sess.messages.filter(m => m.role === 'user').length === 1) {
    sess.title = text.trim().slice(0, 36) + (text.length > 36 ? '…' : '');
    document.getElementById('topbar-title').textContent = sess.title;
  }

  // Reset reply / files state
  replyToId = null;
  document.getElementById('reply-bar').classList.remove('show');
  pendingFiles = [];
  document.getElementById('file-strip').innerHTML = '';
  document.getElementById('file-strip').classList.remove('show');

  save();
  renderHistory();
  CA.appendChild(mkRow(uMsg));
  scrollEnd();

  // Reset input
  MI.value = '';
  MI.style.height = 'auto';
  SB.disabled = true;

  // Show typing indicator
  isTyping = true;
  const typingRow = mkTyping();
  CA.appendChild(typingRow);
  scrollEnd();

  // Get AI response (pass last 12 messages as context)
  const context = sess.messages.slice(-12).map(m => ({ role: m.role, content: m.content }));
  const reply   = await gemini(context);

  // Replace typing indicator with response
  typingRow.remove();
  isTyping = false;

  const aMsg = { id: uid(), role: 'ai', content: reply, ts: Date.now() };
  sess.messages.push(aMsg);
  save();

  CA.appendChild(mkRow(aMsg, searchQ));
  scrollEnd();
}


/* ── 11. SEARCH ── */

/**
 * Highlight matching messages, dim non-matching
 */
function doSearch(query) {
  searchQ = query.trim().toLowerCase();
  const sess = active();
  if (!sess) return;

  const rows = CA.querySelectorAll('.msg-row');
  let count  = 0;

  if (!searchQ) {
    // Clear search state
    rows.forEach(r => {
      r.classList.remove('sh', 'sd');
      const msg = sess.messages.find(m => m.id === r.dataset.id);
      if (msg) {
        const bubble = r.querySelector('.bubble');
        if (bubble) {
          bubble.innerHTML = esc(msg.content) +
            (msg.files?.length
              ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px">
                   ${msg.files.map(f => `<div class="fchip">📎 ${esc(f)}</div>`).join('')}
                 </div>`
              : '');
        }
      }
    });
    document.getElementById('search-count').textContent = '';
    return;
  }

  rows.forEach(r => {
    const msg = sess.messages.find(m => m.id === r.dataset.id);
    if (!msg) return;

    if (msg.content.toLowerCase().includes(searchQ)) {
      r.classList.add('sh');
      r.classList.remove('sd');
      count++;
      const bubble = r.querySelector('.bubble');
      if (bubble) bubble.innerHTML = hlText(msg.content, searchQ);
    } else {
      r.classList.remove('sh');
      r.classList.add('sd');
    }
  });

  document.getElementById('search-count').textContent = count ? `${count} found` : 'None';
  const first = CA.querySelector('.sh');
  if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Search bar toggle and input
document.getElementById('search-input').addEventListener('input', e => doSearch(e.target.value));
document.getElementById('btn-search').addEventListener('click', () => {
  const sb = document.getElementById('search-bar');
  sb.classList.toggle('show');
  if (sb.classList.contains('show')) {
    document.getElementById('search-input').focus();
  } else {
    searchQ = '';
    renderChat(active());
    document.getElementById('search-count').textContent = '';
  }
});

// Sidebar search filter
document.getElementById('sb-search').addEventListener('input', renderHistory);


/* ── 12. VOICE INPUT / OUTPUT ── */

/**
 * Toggle voice recording. Uses Web Speech API.
 */
function startVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('Speech recognition not supported in this browser'); return; }

  if (isRecording) {
    recognition?.stop();
    return;
  }

  recognition            = new SR();
  recognition.lang       = 'en-US';
  recognition.interimResults = true;
  isRecording            = true;

  document.getElementById('btn-voice').classList.add('rec');
  document.getElementById('voice-wave').classList.add('show');

  recognition.onresult = e => {
    let transcript = '';
    for (const r of e.results) transcript += r[0].transcript;
    MI.value    = transcript;
    SB.disabled = !transcript.trim();
  };

  recognition.onend = () => {
    isRecording = false;
    document.getElementById('btn-voice').classList.remove('rec');
    document.getElementById('voice-wave').classList.remove('show');
    if (MI.value.trim()) send(MI.value);
  };

  recognition.onerror = () => {
    isRecording = false;
    document.getElementById('btn-voice').classList.remove('rec');
    document.getElementById('voice-wave').classList.remove('show');
    toast('Voice input error. Please try again.');
  };

  recognition.start();
}

/**
 * Speak text using Web Speech API TTS
 */
function speakText(text) {
  if (!window.speechSynthesis) { toast('Text-to-speech not supported'); return; }
  speechSynthesis.cancel();
  const utt   = new SpeechSynthesisUtterance(text);
  utt.rate    = 1;
  utt.pitch   = 1;
  speechSynthesis.speak(utt);
  toast('🔊 Speaking…', 1500);
}

document.getElementById('btn-voice').addEventListener('click', startVoice);


/* ── 13. FILE ATTACHMENTS ── */

document.getElementById('btn-attach').addEventListener('click', () => {
  document.getElementById('file-input').click();
});

document.getElementById('file-input').addEventListener('change', () => {
  pendingFiles.push(...Array.from(document.getElementById('file-input').files));
  renderFileStrip();
  document.getElementById('file-input').value = '';
});

function renderFileStrip() {
  const strip = document.getElementById('file-strip');
  strip.innerHTML = '';

  if (!pendingFiles.length) {
    strip.classList.remove('show');
    return;
  }
  strip.classList.add('show');

  pendingFiles.forEach((file, i) => {
    const chip = document.createElement('div');
    chip.className = 'fchip';
    chip.innerHTML = `📎 ${esc(file.name)} <button class="fchip-x" data-i="${i}" aria-label="Remove ${file.name}">✕</button>`;
    chip.querySelector('button').addEventListener('click', () => {
      pendingFiles.splice(i, 1);
      renderFileStrip();
    });
    strip.appendChild(chip);
  });
}


/* ── 14. EXPORT ── */

document.getElementById('btn-export').addEventListener('click', () => openM('m-export'));

document.querySelectorAll('.exp-opt').forEach(opt => {
  opt.addEventListener('click', () => {
    const sess = active();
    if (!sess?.messages.length) { toast('No messages to export'); return; }
    exportChat(sess, opt.dataset.fmt);
    closeM('m-export');
  });
});

/**
 * Export the session in the chosen format
 */
function exportChat(sess, fmt) {
  let content = '', mime = 'text/plain', ext = fmt;

  if (fmt === 'txt') {
    content  = `NeuralChat Export — ${sess.title}\n${'─'.repeat(50)}\n\n`;
    content += sess.messages
      .map(m => `[${fmtFull(m.ts)}] ${m.role === 'user' ? 'You' : 'NeuralChat'}:\n${m.content}`)
      .join('\n\n');

  } else if (fmt === 'json') {
    content = JSON.stringify({
      title: sess.title,
      exported: new Date().toISOString(),
      messages: sess.messages
    }, null, 2);
    mime = 'application/json';

  } else if (fmt === 'md') {
    content  = `# ${sess.title}\n*Exported ${new Date().toLocaleString()}*\n\n---\n\n`;
    content += sess.messages
      .map(m => `**${m.role === 'user' ? 'You' : 'NeuralChat'}** *(${fmtFull(m.ts)})*\n\n${m.content}`)
      .join('\n\n---\n\n');
    mime = 'text/markdown';

  } else if (fmt === 'pdf') {
    exportPDF(sess);
    return;
  }

  const blob = new Blob([content], { type: mime });
  const link = document.createElement('a');
  link.href     = URL.createObjectURL(blob);
  link.download = `neuralchat-${sess.title.replace(/\s+/g, '-').toLowerCase()}.${ext}`;
  link.click();
  toast(`📥 Exported as ${fmt.toUpperCase()}`);
}

/**
 * Open a print-ready PDF window
 */
function exportPDF(sess) {
  const win = window.open('', '_blank');
  if (!win) { toast('Popup blocked — try another format'); return; }

  const rows = sess.messages.map(m => `
    <div class="msg ${m.role === 'user' ? 'u' : 'a'}">
      <div class="meta">${m.role === 'user' ? 'You' : 'NeuralChat'} · ${fmtFull(m.ts)}</div>
      <div>${esc(m.content)}</div>
    </div>`).join('');

  win.document.write(`<!DOCTYPE html>
<html><head>
  <meta charset="UTF-8">
  <title>${esc(sess.title)}</title>
  <style>
    body  { font-family: Georgia, serif; max-width: 700px; margin: 40px auto; padding: 0 20px; color: #1a1a2e; line-height: 1.7; }
    h1    { font-size: 22px; border-bottom: 2px solid #6d6aff; padding-bottom: 8px; margin-bottom: 4px; }
    .date { color: #888; font-size: 12px; margin-bottom: 24px; }
    .msg  { margin: 14px 0; padding: 10px 14px; border-radius: 8px; }
    .u    { background: #f0efff; border-left: 3px solid #6d6aff; }
    .a    { background: #f8f8f8; border-left: 3px solid #a78bfa; }
    .meta { font-size: 11px; color: #888; font-family: monospace; margin-bottom: 4px; }
  </style>
</head><body>
  <h1>${esc(sess.title)}</h1>
  <div class="date">Exported ${new Date().toLocaleString()}</div>
  ${rows}
</body></html>`);

  win.document.close();
  win.print();
  toast('📕 PDF print dialog opened');
}


/* ── 15. TAGS ── */

document.getElementById('btn-tag').addEventListener('click', () => {
  if (!active()) { toast('No active conversation'); return; }
  renderCurTags();
  openM('m-tag');
});

function renderCurTags() {
  const container = document.getElementById('cur-tags');
  container.innerHTML = '';

  (active()?.tags || []).forEach(t => {
    const span = document.createElement('span');
    span.className = 'rem-tag';
    span.innerHTML = `${esc(t)}<button data-t="${t}" aria-label="Remove tag ${t}">✕</button>`;
    span.querySelector('button').addEventListener('click', () => {
      const sess = active();
      if (sess) {
        sess.tags = sess.tags.filter(x => x !== t);
        save();
        renderCurTags();
        renderHistory();
      }
    });
    container.appendChild(span);
  });
}

document.getElementById('tag-add').addEventListener('click', () => {
  const input = document.getElementById('tag-input');
  const val   = input.value.trim().toLowerCase().replace(/\s+/g, '-');
  if (!val) return;

  const sess = active();
  if (!sess) return;
  if (!sess.tags) sess.tags = [];

  if (!sess.tags.includes(val)) {
    sess.tags.push(val);
    save();
    renderCurTags();
    renderHistory();
  }
  input.value = '';
});

document.getElementById('tag-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('tag-add').click(); }
});


/* ── 16. SUMMARIZE ── */

document.getElementById('btn-summarize').addEventListener('click', async () => {
  const sess = active();
  if (!sess || sess.messages.length < 2) { toast('Not enough messages to summarize'); return; }

  openM('m-summarize');
  const sumBox = document.getElementById('sum-box');
  sumBox.innerHTML = '<i style="color:var(--text-muted)">Generating summary with Gemini…</i>';

  const transcript = sess.messages
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');

  const summary = await gemini(
    [{ role: 'user', content: `Please summarize this conversation in 3–5 clear bullet points:\n\n${transcript}` }],
    'You are a concise summarizer. Use bullet points. Be brief and clear.'
  );

  sumBox.innerHTML = esc(summary);
  document.getElementById('sum-speak').onclick = () => speakText(summary);
});


/* ── 17. SIDE PANEL ── */

/**
 * Open the Starred or Bookmarks side panel
 */
function openPanel(type) {
  const body = document.getElementById('sp-body');
  body.innerHTML = '';
  document.getElementById('sp-title').textContent = type === 'starred' ? '⭐ Starred' : '🔖 Bookmarks';

  if (type === 'starred') {
    // Gather starred messages across all sessions
    const all = sessions.flatMap(s =>
      s.messages
        .filter(m => starred.includes(m.id))
        .map(m => ({ ...m, sessionTitle: s.title, sessionId: s.id }))
    );

    if (!all.length) {
      body.innerHTML = '<p style="color:var(--text-muted);font-size:12.5px;padding:8px">No starred messages yet.</p>';
    } else {
      all.forEach(m => {
        const el = document.createElement('div');
        el.className = 'panel-item';
        el.innerHTML = `
          <div class="pi-title">${esc(m.content.slice(0, 80))}${m.content.length > 80 ? '…' : ''}</div>
          <div class="pi-sub">${m.sessionTitle} · ${fmtFull(m.ts)}</div>`;
        el.addEventListener('click', () => {
          if (m.sessionId !== activeId) switchSess(m.sessionId);
          setTimeout(() => {
            const target = CA.querySelector(`[data-id="${m.id}"]`);
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 200);
          document.getElementById('side-panel').classList.remove('show');
        });
        body.appendChild(el);
      });
    }

  } else {
    // Bookmarks for current session only
    const sess = active();
    if (!sess) {
      body.innerHTML = '<p style="color:var(--text-muted);font-size:12.5px;padding:8px">No active session.</p>';
    } else {
      const bms = sess.messages.filter(m => bookmarks.includes(m.id));
      if (!bms.length) {
        body.innerHTML = '<p style="color:var(--text-muted);font-size:12.5px;padding:8px">No bookmarks in this conversation.</p>';
      } else {
        bms.forEach(m => {
          const el = document.createElement('div');
          el.className = 'panel-item';
          el.innerHTML = `
            <div class="pi-title">${esc(m.content.slice(0, 80))}${m.content.length > 80 ? '…' : ''}</div>
            <div class="pi-sub">${fmtFull(m.ts)}</div>`;
          el.addEventListener('click', () => {
            const target = CA.querySelector(`[data-id="${m.id}"]`);
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            document.getElementById('side-panel').classList.remove('show');
          });
          body.appendChild(el);
        });
      }
    }
  }

  document.getElementById('side-panel').classList.add('show');
}

document.getElementById('btn-starred').addEventListener('click',   () => openPanel('starred'));
document.getElementById('btn-bookmarks').addEventListener('click', () => openPanel('bookmarks'));
document.getElementById('sp-close').addEventListener('click', () => {
  document.getElementById('side-panel').classList.remove('show');
});


/* ── 18. FOLDER TABS ── */

document.querySelectorAll('.folder-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.folder-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentFolder = tab.dataset.folder;
    renderHistory();
  });
});


/* ── 19. OFFLINE DETECTION ── */

function updateOnlineStatus() {
  document.getElementById('offline-banner').classList.toggle('show', !navigator.onLine);
}
window.addEventListener('online',  updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();


/* ── 20. MODAL HELPERS ── */

function openM(id)  { document.getElementById(id).classList.add('show'); }
function closeM(id) { document.getElementById(id).classList.remove('show'); }

// Close button handlers ([data-close] attribute)
document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => closeM(btn.dataset.close));
});

// Click outside modal to close
document.querySelectorAll('.mbd').forEach(backdrop => {
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) backdrop.classList.remove('show');
  });
});


/* ── 21. KEYBOARD SHORTCUTS ── */

document.getElementById('btn-help').addEventListener('click', () => openM('m-shortcuts'));

document.addEventListener('keydown', e => {
  const ctrl = e.ctrlKey || e.metaKey;

  // Ctrl+N — New conversation
  if (ctrl && e.key === 'n') {
    e.preventDefault();
    newSess();
    closeSB();
  }

  // Ctrl+F — Toggle search bar
  if (ctrl && e.key === 'f') {
    e.preventDefault();
    const sb = document.getElementById('search-bar');
    sb.classList.toggle('show');
    if (sb.classList.contains('show')) document.getElementById('search-input').focus();
  }

  // Ctrl+E — Export
  if (ctrl && e.key === 'e') {
    e.preventDefault();
    openM('m-export');
  }

  // Ctrl+/ — Show shortcuts
  if (ctrl && e.key === '/') {
    e.preventDefault();
    openM('m-shortcuts');
  }

  // Ctrl+Shift+T — Toggle theme
  if (ctrl && e.shiftKey && e.key === 'T') {
    e.preventDefault();
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }

  // Ctrl+Shift+V — Voice input
  if (ctrl && e.shiftKey && (e.key === 'V' || e.key === 'v')) {
    e.preventDefault();
    startVoice();
  }

  // Escape — focus input and close overlays
  if (e.key === 'Escape') {
    MI.focus();
    document.querySelectorAll('.mbd.show').forEach(m => m.classList.remove('show'));
    const sb = document.getElementById('search-bar');
    sb.classList.remove('show');
    searchQ = '';
    renderChat(active());
    document.getElementById('side-panel').classList.remove('show');
  }
});


/* ── 22. INPUT HANDLERS ── */

// DOM references (declared before use in event handlers)
const MI  = document.getElementById('msg-input');
const SB  = document.getElementById('send-btn');
const CA  = document.getElementById('chat-area');
const WEL = document.getElementById('welcome');

// Auto-grow textarea
MI.addEventListener('input', () => {
  MI.style.height = 'auto';
  MI.style.height = Math.min(MI.scrollHeight, 150) + 'px';
  SB.disabled = !MI.value.trim();
});

// Enter to send, Shift+Enter for new line
MI.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!SB.disabled) send(MI.value);
  }
});

// Send button click
SB.addEventListener('click', () => send(MI.value));

// Cancel reply
document.getElementById('reply-bar-x').addEventListener('click', () => {
  replyToId = null;
  document.getElementById('reply-bar').classList.remove('show');
});

// Suggestion chips
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    MI.value    = chip.dataset.msg;
    SB.disabled = false;
    send(chip.dataset.msg);
  });
});

// New chat button
document.getElementById('new-chat-btn').addEventListener('click', () => {
  newSess();
  closeSB();
});

// Clear conversation
document.getElementById('btn-clear').addEventListener('click', () => {
  const sess = active();
  if (!sess?.messages.length) return;
  if (!confirm('Clear this conversation?')) return;
  sess.messages = [];
  sess.title    = 'New Conversation';
  document.getElementById('topbar-title').textContent = sess.title;
  save();
  renderHistory();
  renderChat(sess);
});


/* ── 23. SIDEBAR (MOBILE) ── */

function closeSB() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sb-overlay').classList.remove('show');
}

document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sb-overlay').classList.toggle('show');
});

document.getElementById('sb-overlay').addEventListener('click', closeSB);


/* ── 24. INITIALIZATION ── */

// Load persisted sessions
sessions = load();

if (sessions.length) {
  activeId = sessions[sessions.length - 1].id;
  renderHistory();
  renderChat(active());
  document.getElementById('topbar-title').textContent = active()?.title || 'Conversation';
} else {
  newSess();
}

// Focus input
MI.focus();

console.info('[NeuralChat] Initialized · AI Assistant · Theme:', theme);
