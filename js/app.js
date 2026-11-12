// 起動・画面の切り替え
import { $, toast, confirmDialog, alertDialog, busy, el, closeOverlay, setRate } from './ui.js';
import { session, connect, disconnect } from './connection.js';
import { MENU_ITEMS } from './config/menu.js';
import top from './screens/top.js';
import uuidInput from './screens/uuid-input.js';
import uuidManage from './screens/uuid-manage.js';
import home from './screens/home.js';
import status from './screens/status.js';
import dtc from './screens/dtc.js';
import mypage from './screens/mypage.js';
import settings, { applySettings } from './screens/settings.js';
import { openPresetList, openFirstPreset, renamePreset } from './screens/parts/presets.js';
import { getPreset } from './storage.js';

const SCREENS = Object.fromEntries([top, uuidInput, uuidManage, home, status, mypage, dtc, settings].map((s) => [s.id, s]));
let current = null;
const lastParams = {};
// 接続中として扱う画面か（neutral の画面＝設定は、接続中ならヘッダー付きで表示）
const isConnScreen = (s) => !!s && (s.connected || (s.neutral && !!session.obd)); // 画面ごとの直近のパラメーター（戻る・進むで再利用）

// ブラウザの履歴（戻る・進む）。URL は変えず state に画面 ID を持たせる
function record(id, mode, params) {
  if (mode === 'none') return;
  // historyParams の画面（ステータスのカテゴリなど）はパラメーターも履歴に持たせる
  const state = SCREENS[id]?.historyParams ? { screen: id, params } : { screen: id };
  try { history[mode === 'replace' ? 'replaceState' : 'pushState'](state, ''); } catch { /* noop */ }
}
const sameParams = (id, p) => !SCREENS[id]?.historyParams || JSON.stringify(lastParams[id] || {}) === JSON.stringify(p || {});

export const app = {
  session,
  /** @param {{history?: 'push'|'replace'|'none'}} [o] */
  show(id, params = {}, { history: mode = 'push' } = {}) {
    if (SCREENS[id].connected && !session.obd) id = 'top'; // 未接続で接続後の画面には行かない
    const same = current?.id === id && sameParams(id, params);
    lastParams[id] = params;
    record(id, same ? 'replace' : mode, params);
    current?.leave?.();
    setRate(null); // 更新速度は取得中の画面でだけ表示
    // 全画面を必ず隠してから表示する（切断後に前の画面が残るバグの対策）
    document.querySelectorAll('.screen').forEach((el) => { el.hidden = true; });
    current = SCREENS[id];
    $('screen-' + id).hidden = false;
    const hdr = $('app-header');
    const withHeader = isConnScreen(current);
    hdr.hidden = !withHeader;
    // 画面に説明があればヘッダーに「?」を出す
    $('hdr-help').hidden = !current.help;
    $('hdr-preset').hidden = id !== 'mypage'; // マイページだけプリセットの切り替えボタンを出す
    $('hdr-title').classList.toggle('tap', id === 'mypage');
    if (withHeader) {
      $('hdr-title').textContent = current.title;
      $('hdr-debug').hidden = !session.debug;
      [...$('menu').children].forEach((b) => b.classList.toggle('active', b.dataset.screen === id));
    }
    $('menu').hidden = true;
    window.scrollTo(0, 0);
    current.enter?.(app, params);
  },

  /** 接続処理（トップ・UUID 入力画面から呼ぶ） */
  async connect(opts = {}) {
    busy('機器を選んでください…');
    try {
      const r = await connect({ ...opts, progress: busy });
      busy(null);
      if (r.status === 'cancelled') return r;
      if (r.status === 'need-uuid') { app.show('uuid-input', { deviceName: r.deviceName, baseOpts: { transportFactory: opts.transportFactory, debug: opts.debug } }); return r; }
      session.transport.onDisconnect(onUnexpectedDisconnect);
      app.show('home');
      if (r.warning) toast(r.warning, { error: true, ms: 6000 });
      return r;
    } catch (e) {
      busy(null);
      if (e.code === 'uuid-not-found') throw e; // UUID 入力画面で表示
      await alertDialog(errorMessage(e));
      return { status: 'error' };
    }
  },

  async disconnectWithConfirm() {
    if (!(await confirmDialog('アダプターとの接続を切断しますか？', { ok: '切断', danger: true }))) return;
    current?.leave?.(); current = null;
    disconnect();
    app.show('top');
  },
};

function errorMessage(e) {
  switch (e.code) {
    case 'connect-failed': return '機器が見つからないか、接続できませんでした。\n\n・イグニッションが ON になっているか\n・他の OBD アプリを閉じたか\n・アダプターが奥まで挿さっているか\nを確認して、もう一度お試しください。';
    default: return e.message || String(e);
  }
}

function onUnexpectedDisconnect() {
  if (session.userClosing) return;
  current?.leave?.(); current = null;
  disconnect();
  toast('アダプターとの接続が切れました。', { error: true, ms: 6000 });
  app.show('top');
}

// メニュー（データから生成）
function buildMenu() {
  const m = $('menu');
  for (const item of MENU_ITEMS) {
    const b = el('button', { class: item.danger ? 'danger' : '' }, item.label);
    if (item.type === 'screen') { b.dataset.screen = item.screen; b.onclick = () => app.show(item.screen); }
    else if (item.action === 'disconnect') b.onclick = () => { m.hidden = true; app.disconnectWithConfirm(); };
    else if (item.action === 'presets') { b.dataset.screen = item.screen; b.onclick = () => { m.hidden = true; openFirstPreset(app); }; }
    m.append(b);
  }
  $('hdr-preset').onclick = () => openPresetList(app);
  // マイページではヘッダーのプリセット名をタップすると名前を変更できる
  $('hdr-title').onclick = () => { if (current?.id === 'mypage') renamePreset(getPreset(lastParams.mypage?.presetId)); };
  $('hdr-help').onclick = () => { if (current?.help) alertDialog(current.help.text, current.help.title); };
  $('menu-btn').onclick = (e) => { e.stopPropagation(); m.hidden = !m.hidden; };
  document.addEventListener('click', (e) => { if (!m.contains(e.target)) m.hidden = true; });
}

// PWA：Service Worker と更新通知
function setupSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const notify = (w) => { $('update-banner').hidden = false; $('update-btn').onclick = () => w.postMessage('SKIP_WAITING'); };
    if (reg.waiting && navigator.serviceWorker.controller) notify(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw?.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) notify(nw); });
    });
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
  }).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
}

// 戻る・進む
window.addEventListener('popstate', async (e) => {
  const target = SCREENS[e.state?.screen] ? e.state.screen : 'top';
  $('menu').hidden = true;
  // ダイアログ・シートが開いていれば、それを閉じるだけ（画面は移動しない）
  if (closeOverlay()) { record(current?.id || 'top', 'push', lastParams[current?.id]); return; }
  // 処理中表示が出ているときは移動しない
  if (!$('busy').hidden) { record(current?.id || 'top', 'push', lastParams[current?.id]); return; }
  const tgt = SCREENS[target];
  if (isConnScreen(current) && !tgt.connected && !tgt.neutral) {
    // 接続中にトップ側へ戻る → 切断の確認（キャンセルなら今の画面に留まる）
    record(current.id, 'push');
    await app.disconnectWithConfirm();
    return;
  }
  if (tgt.connected && !session.obd) { record(current?.id || 'top', 'replace'); return; } // 切断済みのセッションには戻らない
  if (target === 'uuid-input' && !lastParams['uuid-input']?.deviceName) { app.show('top', {}, { history: 'replace' }); return; }
  app.show(target, (SCREENS[target].historyParams ? e.state?.params : null) || lastParams[target] || {}, { history: 'none' });
});

applySettings();
buildMenu();
setupSW();
Object.values(SCREENS).forEach((s) => s.init?.(app));
app.show('top', {}, { history: 'replace' });

// DEBUG-START（デバッグモードを削除するときはこのブロックごと削除）
import('./debug/mock-adapter.js').then((m) => m.installDebug(app)).catch(() => {});
// DEBUG-END
