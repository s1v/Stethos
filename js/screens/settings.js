// 設定画面（接続中にメニューから開く）
import { $, confirmDialog, toast } from '../ui.js';
import { getSettings, setSetting, resetMyPage } from '../storage.js';
import { findItem } from '../config/pids.js';
import { createCard } from './parts/pid-card.js';

/** 文字サイズを画面に反映（起動時にも呼ぶ） */
export function applySettings() {
  document.documentElement.dataset.pidSize = getSettings().pidSize;
}

function renderSize() {
  const cur = getSettings().pidSize;
  for (const b of $('set-size').children) b.setAttribute('aria-checked', String(b.dataset.v === cur));
}

export default {
  id: 'settings', title: '設定', connected: true,
  init(app) {
    for (const b of $('set-size').children) {
      b.onclick = () => { setSetting('pidSize', b.dataset.v); applySettings(); renderSize(); };
    }
    $('set-mp-reset').onclick = async () => {
      if (!(await confirmDialog('配置したすべての項目を外し、枠の数を初期状態に戻します。', { title: 'マイページをリセットしますか？', ok: 'リセット', danger: true }))) return;
      resetMyPage(); toast('マイページをリセットしました');
    };
    // プレビュー（固定の値を表示）
    const box = $('set-preview');
    for (const [key, val] of [['coolant', 88], ['rpm', 2450], ['adapterVolt', 14.1]]) {
      const c = createCard(findItem(key), true, { onClick: () => {} }); c.update(val); box.append(c.node);
    }
  },
  enter() { renderSize(); },
};
