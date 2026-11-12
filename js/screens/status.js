// ステータス画面（2 段構成）
// 1 段目：カテゴリの一覧（取得はしない）
// 2 段目：選んだカテゴリの項目だけを取得・表示（ECU への問い合わせを必要な分に絞るため）
import { $, el, keepAwake, setRate } from '../ui.js';
import { ALL_ITEMS, PID_GROUPS, isItemSupported } from '../config/pids.js';
import { resolveTargets, startPolling } from '../poller.js';
import { createCard } from './parts/pid-card.js';
import { icon } from './parts/icons.js';

let stop = () => {};

function renderCategories(app, sup) {
  const root = $('st-groups'); root.innerHTML = '';
  const grid = el('div', { class: 'cats' });
  let any = false;
  for (const g of PID_GROUPS) {
    const items = ALL_ITEMS.filter((d) => d.group === g.id);
    if (!items.length) continue;
    const n = items.filter((d) => isItemSupported(d, sup)).length;
    if (n) any = true;
    grid.append(el('button', { class: 'cat' + (n ? '' : ' na'), type: 'button', onclick: () => app.show('status', { cat: g.id }) },
      icon(g.icon), el('span', { class: 'cat-l' }, g.label), el('span', { class: 'cat-n' }, n ? `${n} / ${items.length} 項目` : '非対応')));
  }
  root.append(grid);
  $('st-empty').hidden = any;
}

function renderCategory(app, g, sup) {
  const root = $('st-groups'); root.innerHTML = '';
  const cards = {};
  const box = el('div', { class: 'pids' }), naBox = el('div', { class: 'pids' });
  let naCount = 0;
  for (const d of ALL_ITEMS.filter((x) => x.group === g.id)) {
    const ok = isItemSupported(d, sup);
    const c = createCard(d, ok);
    if (ok) { cards[d.key] = c; box.append(c.node); } else { naBox.append(c.node); naCount++; }
  }
  if (box.children.length) root.append(box);
  // 非対応の項目はまとめて畳んでおく
  if (naCount) root.append(el('details', { class: 'fold' }, el('summary', {}, `この車が対応していない項目（${naCount}）`), el('div', { class: 'fold-body' }, naBox)));
  const targets = resolveTargets(Object.keys(cards), app.session.obd);
  $('st-empty').hidden = targets.length > 0;
  keepAwake(true); // 表示中は画面を消さない
  stop = startPolling(app.session, targets, (k, v) => cards[k]?.update(v), setRate);
}

export default {
  id: 'status', title: 'ステータス', connected: true,
  historyParams: true, // カテゴリの出入りもブラウザの戻る・進むで移動できるようにする
  enter(app, params = {}) {
    const sup = (pid) => app.session.obd.isSupported(pid);
    const g = PID_GROUPS.find((x) => x.id === params.cat);
    $('hdr-title').textContent = g ? g.label : 'ステータス';
    $('st-back').hidden = !g;
    $('st-back').onclick = () => history.back();
    if (g) renderCategory(app, g, sup); else renderCategories(app, sup);
  },
  leave() { stop(); stop = () => {}; keepAwake(false); },
};
