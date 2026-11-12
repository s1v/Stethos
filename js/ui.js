// 共通 UI 部品（通知・確認ダイアログ・処理中表示・Wake Lock）
export const $ = (id) => document.getElementById(id);

let toastTimer;
export function toast(msg, { error = false, ms = 4000 } = {}) {
  const t = $('toast'); t.textContent = msg; t.className = 'toast' + (error ? ' error' : ''); t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

let closeDialog = null;
export function confirmDialog(msg, { ok = 'OK', danger = false, cancel = 'キャンセル', alertOnly = false, title = '', extra = null } = {}) {
  return new Promise((resolve) => {
    const d = $('dialog'), okb = $('dlg-ok'), cb = $('dlg-cancel');
    $('dlg-title').textContent = title; $('dlg-title').hidden = !title; $('dlg-msg').textContent = msg; okb.textContent = ok; cb.textContent = cancel; cb.hidden = alertOnly;
    okb.className = 'btn ' + (danger ? 'danger' : 'primary');
    $('dlg-extra').replaceChildren(...(extra ? [extra] : []));
    d.hidden = false;
    const done = (v) => { d.hidden = true; okb.onclick = cb.onclick = d.onclick = null; closeDialog = null; resolve(v); };
    okb.onclick = () => done(true); cb.onclick = () => done(false);
    // 枠の外（背景）をタップしたら閉じる（確認ダイアログではキャンセル扱い）
    d.onclick = (e) => { if (e.target === d) done(alertOnly); };
    closeDialog = () => done(alertOnly ? true : false);
  });
}

/** 下から出るシート。build(body, done) で中身を作り、done(値) で閉じる。背景・× で閉じると null */
let closeSheet = null;
export function sheet(title, build) {
  return new Promise((resolve) => {
    const s = $('sheet'), body = $('sheet-body');
    $('sheet-title').textContent = title; body.innerHTML = ''; s.hidden = false; body.scrollTop = 0;
    const done = (v) => { s.hidden = true; s.onclick = $('sheet-close').onclick = null; closeSheet = null; resolve(v); };
    s.onclick = (e) => { if (e.target === s) done(null); };
    $('sheet-close').onclick = () => done(null);
    closeSheet = () => done(null);
    build(body, done);
  });
}

/** ダイアログ・シートが開いていれば閉じて true（ブラウザの「戻る」用） */
export function closeOverlay() {
  if (closeDialog) { closeDialog(); return true; }
  if (closeSheet) { closeSheet(); return true; }
  return false;
}

export const alertDialog = (msg, title = '') => confirmDialog(msg, { alertOnly: true, title });

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

/** ヘッダーに更新速度を表示（null で消す） */
export function setRate(r) {
  const e = document.getElementById('hdr-rate');
  if (e) e.textContent = r == null ? '' : `更新 ${r.toFixed(1)} 項目/秒`;
}

/** 文字を入力するダイアログ。キャンセルなら null */
export async function promptDialog(title, value = '', { ok = 'OK', placeholder = '' } = {}) {
  const inp = el('input', { class: 'inp', value, placeholder, maxlength: '30' });
  setTimeout(() => { inp.focus(); inp.select(); }, 50);
  const r = await confirmDialog('', { title, ok, extra: inp });
  return r ? inp.value.trim() : null;
}
