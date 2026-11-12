// 設定画面（接続中にメニューから開く）
import { $, confirmDialog, toast } from '../ui.js';
import { getSettings, setSetting, resetMyPage } from '../storage.js';
import { findItem } from '../config/pids.js';
import { createCard } from './parts/pid-card.js';
import { renderReportCard } from '../report.js';
import { THEMES } from '../config/themes.js';

/** 文字サイズを画面に反映（起動時にも呼ぶ） */
export function applySettings() {
  const st = getSettings(), root = document.documentElement;
  root.dataset.pidSize = st.pidSize;
  const th = THEMES.find((t) => t.id === st.theme) || THEMES[0];
  root.dataset.theme = th.id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', th.themeColor);
}

function renderTheme() {
  const cur = getSettings().theme;
  for (const b of $('set-theme').children) b.setAttribute('aria-checked', String(b.dataset.v === cur));
}

const MULTI_TEXT = { on: '状態：使用中（まとめて取得しています）', off: '状態：オフ（1 項目ずつ取得しています）', unsupported: '状態：この車またはアダプターでは使えないため、1 項目ずつ取得しています' };
let app_ = null;
function renderMulti() {
  const on = getSettings().multiPid;
  for (const b of $('set-multi').children) b.setAttribute('aria-checked', String((b.dataset.v === 'on') === on));
  const obd = app_?.session?.obd;
  $('set-multi-state').textContent = obd ? MULTI_TEXT[obd.multiState] : '';
}

function renderSize() {
  const cur = getSettings().pidSize;
  for (const b of $('set-size').children) b.setAttribute('aria-checked', String(b.dataset.v === cur));
}

export default {
  id: 'settings', title: '設定', connected: true,
  init(app) {
    app_ = app;
    for (const b of $('set-multi').children) {
      b.onclick = async () => {
        const on = b.dataset.v === 'on';
        setSetting('multiPid', on); renderMulti();
        // 接続中ならその場で切り替える（オンにしたときは使えるか試す）
        const obd = app.session.obd;
        if (obd) { try { await obd.detectMulti(on); } catch { /* noop */ } renderMulti(); }
      };
    }
    const tl = $('set-theme');
    for (const t of THEMES) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'theme-opt'; b.setAttribute('role', 'radio'); b.dataset.v = t.id;
      const sw = document.createElement('span'); sw.className = 'theme-sw t-' + t.id; sw.textContent = t.sample;
      const nm = document.createElement('span'); nm.className = 'theme-name'; nm.textContent = t.label;
      b.append(sw, nm);
      b.onclick = () => { setSetting('theme', t.id); applySettings(); renderTheme(); };
      tl.append(b);
    }
    for (const b of $('set-size').children) {
      b.onclick = () => { setSetting('pidSize', b.dataset.v); applySettings(); renderSize(); };
    }
    $('set-mp-reset').onclick = async () => {
      if (!(await confirmDialog('すべてのプリセットを削除し、空のマイページ 1 つに戻します。', { title: 'マイページをリセットしますか？', ok: 'リセット', danger: true }))) return;
      resetMyPage(); toast('マイページをリセットしました');
    };
    // プレビュー（固定の値を表示）
    const box = $('set-preview');
    for (const [key, val] of [['coolant', 88], ['rpm', 2450], ['adapterVolt', 14.1]]) {
      const c = createCard(findItem(key), true, { onClick: () => {} }); c.update(val); box.append(c.node);
    }
  },
  enter() { renderTheme(); renderSize(); renderMulti(); renderReportCard($('set-report')); },
};
