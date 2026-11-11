// トップ画面
import { $ } from '../ui.js';
import { isBluetoothSupported } from '../ble.js';
import { normalizeUuid } from '../storage.js';

export default {
  id: 'top', title: 'トップ', connected: false,
  init(app) {
    const supported = isBluetoothSupported();
    $('unsupported').hidden = supported;
    const inp = $('adv-uuid'), msg = $('adv-uuid-msg'), btn = $('btn-connect');
    const validate = () => {
      const v = inp.value.trim(), n = normalizeUuid(v);
      msg.textContent = !v ? '空欄なら既知・保存済みの UUID だけを使います。' : n ? `OK：${n}` : '形式が正しくありません（例：FFF0 / 0xFFF0 / 128bit）';
      msg.className = 'hint' + (!v ? '' : n ? ' ok' : ' ng');
      btn.disabled = !supported || (!!v && !n);
    };
    inp.addEventListener('input', validate); validate();
    btn.onclick = () => {
      const n = normalizeUuid(inp.value);
      app.connect({ extraUuids: n ? [n] : [] });
    };
    $('btn-manage').onclick = () => app.show('uuid-manage');
  },
};
