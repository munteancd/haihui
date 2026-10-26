// Room chat: a floating button that opens a small panel. It lives outside #app, so the
// board's re-renders never wipe it. Messages travel over the room's realtime channel and
// are not stored anywhere: a reload starts with an empty chat.
import { avatar } from './avatar.js';

const MAX_LEN = 300;
const KEEP = 100; // messages kept on screen

// `send(message)` resolves true when delivered. Returns { receive(message) } for incoming ones.
export function mountChat({ me, send }) {
  const el = document.createElement('div');
  el.id = 'chat';
  el.innerHTML = `
    <section class="chat-panel" hidden aria-label="Chat">
      <header class="chat-head"><b>💬 Chat</b><button class="ghost chat-close" aria-label="Închide chatul">✕</button></header>
      <ol class="chat-log"><li class="chat-empty">Niciun mesaj încă. Salută-i pe ceilalți!</li></ol>
      <form class="chat-form">
        <input maxlength="${MAX_LEN}" placeholder="Scrie un mesaj…" autocomplete="off" aria-label="Mesaj" />
        <button>Trimite</button>
      </form>
    </section>
    <div class="chat-peek" hidden></div>
    <button class="chat-toggle" aria-label="Deschide chatul">💬<span class="chat-badge" hidden></span></button>`;
  document.body.appendChild(el);

  const panel = el.querySelector('.chat-panel');
  const log = el.querySelector('.chat-log');
  const input = el.querySelector('.chat-form input');
  const badge = el.querySelector('.chat-badge');
  const peek = el.querySelector('.chat-peek');
  const toggle = el.querySelector('.chat-toggle');
  let unread = 0;
  let peekTimer = null;

  const setOpen = (open) => {
    panel.hidden = !open;
    toggle.hidden = open;
    peek.hidden = true;
    if (open) {
      unread = 0;
      badge.hidden = true;
      log.scrollTop = log.scrollHeight;
      input.focus();
    }
  };
  toggle.onclick = () => setOpen(true);
  el.querySelector('.chat-close').onclick = () => setOpen(false);
  peek.onclick = () => setOpen(true);

  // Player text only ever goes in through textContent.
  function add(msg, { mine = false } = {}) {
    log.querySelector('.chat-empty')?.remove();
    const li = document.createElement('li');
    li.className = mine ? 'mine' : '';
    li.innerHTML = `${avatar(msg.name, msg.from)}<div class="bubble"><span class="who"></span><span class="text"></span></div>`;
    li.querySelector('.who').textContent = mine ? 'Tu' : msg.name;
    li.querySelector('.text').textContent = msg.text;
    log.appendChild(li);
    while (log.children.length > KEEP) log.firstElementChild.remove();
    log.scrollTop = log.scrollHeight;
    return li;
  }

  el.querySelector('.chat-form').onsubmit = async (e) => {
    e.preventDefault();
    const text = input.value.trim().slice(0, MAX_LEN);
    if (!text) return;
    input.value = '';
    const msg = { from: me.id, name: me.name, text, at: Date.now() };
    const li = add(msg, { mine: true });
    if (!(await send(msg).catch(() => false))) {
      li.classList.add('failed');
      li.title = 'Nu s-a trimis';
    }
  };

  return {
    receive(msg) {
      if (!msg || typeof msg.text !== 'string' || msg.from === me.id) return;
      add({ from: String(msg.from), name: String(msg.name || '?').slice(0, 40), text: msg.text.slice(0, MAX_LEN) });
      if (!panel.hidden) return;
      unread += 1;
      badge.textContent = unread > 9 ? '9+' : String(unread);
      badge.hidden = false;
      peek.textContent = `${msg.name}: ${msg.text}`;
      peek.hidden = false;
      clearTimeout(peekTimer);
      peekTimer = setTimeout(() => { peek.hidden = true; }, 5000);
    },
  };
}
