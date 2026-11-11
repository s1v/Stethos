// 共通 UI 部品（通知・確認ダイアログ・処理中表示・Wake Lock）
export const $ = (id) => document.getElementById(id);

let toastTimer;
export function toast(msg, { error = false, ms = 4000 } = {}) {
  const t = $('toast'); t.textContent = msg; t.className = 'toast' + (error ? ' error' : ''); t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

export function confirmDialog(msg, { ok = 'OK', danger = false, cancel = 'キャンセル', alertOnly = false } = {}) {
  return new Promise((resolve) => {
    const d = $('dialog'), okb = $('dlg-ok'), cb = $('dlg-cancel');
    $('dlg-msg').textContent = msg; okb.textContent = ok; cb.textContent = cancel; cb.hidden = alertOnly;
    okb.className = 'btn ' + (danger ? 'danger' : 'primary');
    d.hidden = false;
    const done = (v) => { d.hidden = true; okb.onclick = cb.onclick = null; resolve(v); };
    okb.onclick = () => done(true); cb.onclick = () => done(false);
  });
}

export const alertDialog = (msg) => confirmDialog(msg, { alertOnly: true });

export function busy(msg) { $('busy-msg').textContent = msg || ''; $('busy').hidden = !msg; }

export function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v != null) e.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null) e.append(c.nodeType ? c : String(c));
  return e;
}

// Wake Lock（画面を点けたままにする）
let lock = null, wanted = false;
export async function keepAwake(on) {
  wanted = on;
  if (!on) { try { await lock?.release(); } catch { /* noop */ } lock = null; return false; }
  if (!('wakeLock' in navigator)) return false;
  try { lock = await navigator.wakeLock.request('screen'); return true; } catch { return false; }
}
document.addEventListener('visibilitychange', () => { if (wanted && document.visibilityState === 'visible') keepAwake(true); });
