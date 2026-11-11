// マイページ（利用者が選んだ項目を好きな位置に並べるカスタム画面）
import { $, el, keepAwake, sheet, confirmDialog } from '../ui.js';
import { PID_GROUPS, ALL_ITEMS, findItem, isItemSupported } from '../config/pids.js';
import { getMyPage, setMyPage, MYPAGE_DEFAULT_SLOTS } from '../storage.js';
import { resolveTargets, startPolling } from '../poller.js';
import { createCard, showHelp } from './parts/pid-card.js';

let stop = () => {};
let app_ = null;
let slots = [];

/** 項目を選ぶシート（車が対応していない項目は選べない） */
function pickItem(title) {
  const sup = (pid) => app_.session.obd.isSupported(pid);
  const used = new Set(slots.filter(Boolean));
  return sheet(title, (body, done) => {
    for (const g of PID_GROUPS) {
      const items = ALL_ITEMS.filter((d) => d.group === g.id);
      if (!items.length) continue;
      body.append(el('div', { class: 'pick-group' }, g.label));
      for (const d of items) {
        const ok = isItemSupported(d, sup);
        body.append(el('button', { class: 'pick-item' + (ok ? '' : ' na'), type: 'button', disabled: ok ? null : '', onclick: () => done(d.key) },
          el('span', {}, d.name), el('span', { class: 'pick-note' }, !ok ? '非対応' : used.has(d.key) ? '配置済み' : d.unit && d.format !== 'enum' && d.format !== 'duration' ? d.unit : '')));
      }
    }
  });
}

/** 配置済みの枠をタップしたときの操作 */
function slotMenu(d) {
  return sheet(d.name, (body, done) => {
    for (const [id, label, cls] of [['help', '説明を見る', ''], ['change', '別の項目に変更', ''], ['remove', 'この枠から外す', ' danger']]) {
      body.append(el('button', { class: 'pick-item' + cls, type: 'button', onclick: () => done(id) }, label));
    }
  });
}

function save() { setMyPage(slots); }

function render() {
  stop();
  const { obd } = app_.session;
  const sup = (pid) => obd.isSupported(pid);
  const grid = $('mp-grid'); grid.innerHTML = '';
  const cards = {};
  slots.forEach((key, i) => {
    const d = key && findItem(key);
    if (!d) {
      grid.append(el('button', { class: 'pid slot-empty', type: 'button', 'aria-label': '項目を追加', onclick: async () => {
        const k = await pickItem('配置する項目を選ぶ'); if (!k) return;
        slots[i] = k; save(); render();
      } }, el('span', { class: 'plus' }, '+'), el('span', { class: 'small muted' }, '項目を追加')));
      return;
    }
    const ok = isItemSupported(d, sup);
    const c = createCard(d, ok, { onClick: async () => {
      const act = await slotMenu(d);
      if (act === 'help') showHelp(d, ok);
      else if (act === 'change') { const k = await pickItem('別の項目を選ぶ'); if (k) { slots[i] = k; save(); render(); } }
      else if (act === 'remove') { slots[i] = null; save(); render(); }
    } });
    (cards[d.key] ||= []).push(c);
    grid.append(c.node);
  });
  const targets = resolveTargets(Object.keys(cards), obd);
  $('mp-rate').textContent = '';
  stop = startPolling(app_.session, targets, (k, v) => cards[k]?.forEach((c) => c.update(v)),
    (r) => { $('mp-rate').textContent = `（更新 ${r.toFixed(1)} 項目/秒）`; });
}

export default {
  id: 'mypage', title: 'マイページ', connected: true,
  init(app) {
    app_ = app;
    $('mp-add').onclick = () => { slots.push(null, null, null); save(); render(); };
    $('mp-clear').onclick = async () => {
      if (!slots.some(Boolean)) return;
      if (!(await confirmDialog('配置したすべての項目を外しますか？（枠の数は初期状態に戻ります）', { ok: 'すべて外す', danger: true }))) return;
      slots = new Array(MYPAGE_DEFAULT_SLOTS).fill(null);
      save(); render();
    };
  },
  enter() {
    slots = getMyPage();
    render();
    keepAwake(true);
  },
  leave() { stop(); keepAwake(false); },
};
