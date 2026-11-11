// UUID 入力画面（未登録アダプター用）
import { $ } from '../ui.js';
import { normalizeUuid } from '../storage.js';

let params = {};
export default {
  id: 'uuid-input', title: 'UUID 入力', connected: false,
  init(app) {
    const inp = $('ui-uuid'), msg = $('ui-msg'), btn = $('ui-connect');
    const validate = () => {
      const v = inp.value.trim(), n = normalizeUuid(v);
      msg.textContent = !v ? '' : n ? `OK：${n}` : '形式が正しくありません（例：FFF0 / 0xFFF0 / 128bit）';
      msg.className = 'hint' + (n ? ' ok' : v ? ' ng' : '');
      btn.disabled = !n;
    };
    inp.addEventListener('input', () => { $('ui-error').hidden = true; validate(); });
    btn.onclick = async () => {
      const n = normalizeUuid(inp.value);
      if (!n) return;
      $('ui-error').hidden = true;
      try {
        await app.connect({ ...(params.baseOpts || {}), requireUuid: n });
        // キャンセル時はこの画面に留まる（入力内容は保持）
      } catch (e) {
        $('ui-error').textContent = e.message; $('ui-error').hidden = false;
      }
    };
    $('ui-back').onclick = () => app.show('top');
    this._validate = validate;
  },
  enter(app, p) {
    params = p || {};
    $('ui-device').textContent = params.deviceName || '(名前なし)';
    $('ui-error').hidden = true;
    const hint = $('ui-debug-hint');
    hint.hidden = !params.baseOpts?.debug;
    hint.textContent = 'DEBUG：疑似アダプターのサービス UUID は「ABCD」です。';
    this._validate();
  },
};
