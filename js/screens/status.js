// ステータス画面（リアルタイムの車両データ）
import { $, el, keepAwake, setRate } from '../ui.js';
import { PIDS, DERIVED, PID_GROUPS, isDefSupported, isDerivedSupported } from '../config/pids.js';
import { resolveTargets, startPolling } from '../poller.js';
import { createCard } from './parts/pid-card.js';

let stop = () => {};

export default {
  id: 'status', title: 'ステータス', connected: true,
  enter(app) {
    const { obd } = app.session;
    const sup = (pid) => obd.isSupported(pid);
    const cards = {};
    const root = $('st-groups'); root.innerHTML = '';
    const naBox = el('div', { class: 'pids' });
    let naCount = 0;
    for (const g of PID_GROUPS) {
      const defs = [...PIDS.filter((p) => p.group === g.id).map((d) => [d, isDefSupported(d, sup)]),
        ...DERIVED.filter((d) => d.group === g.id).map((d) => [d, isDerivedSupported(d, sup)])];
      const box = el('div', { class: 'pids' });
      for (const [d, ok] of defs) {
        const c = createCard(d, ok);
        if (ok) { cards[d.key] = c; box.append(c.node); } else { naBox.append(c.node); naCount++; }
      }
      if (box.children.length) root.append(el('div', { class: 'group' }, el('h2', {}, g.label), box));
    }
    // 非対応の項目はまとめて畳んでおく
    if (naCount) root.append(el('details', { class: 'fold' }, el('summary', {}, `この車が対応していない項目（${naCount}）`), el('div', { class: 'fold-body' }, naBox)));

    const targets = resolveTargets(Object.keys(cards), obd);
    $('st-empty').hidden = targets.length > 0;
    keepAwake(true); // 表示中は画面を消さない
    stop = startPolling(app.session, targets, (k, v) => cards[k]?.update(v),
      setRate);
  },
  leave() { stop(); keepAwake(false); },
};
