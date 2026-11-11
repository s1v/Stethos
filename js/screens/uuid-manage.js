// UUID 管理画面
import { $, el, confirmDialog } from '../ui.js';
import { getSavedUuids, removeUuid, normalizeUuid, shortUuid } from '../storage.js';
import { KNOWN_SERVICES } from '../config/known-uuids.js';

function render() {
  const saved = $('um-saved'); saved.innerHTML = '';
  const list = getSavedUuids();
  if (!list.length) saved.append(el('p', { class: 'muted' }, '保存した UUID はありません。'));
  for (const s of list) {
    saved.append(el('div', { class: 'list-item' },
      el('div', {}, el('div', { class: 'mono' }, shortUuid(s.uuid)), el('div', { class: 'muted small' }, `${s.deviceName} ／ ${new Date(s.savedAt).toLocaleString()}`)),
      el('button', { class: 'btn small danger', onclick: async () => {
        if (await confirmDialog(`この UUID を削除しますか？\n${s.uuid}`, { ok: '削除', danger: true })) { removeUuid(s.uuid); render(); }
      } }, '削除')));
  }
  const known = $('um-known'); known.innerHTML = '';
  for (const k of KNOWN_SERVICES) {
    known.append(el('div', { class: 'list-item' },
      el('div', {}, el('div', { class: 'mono' }, shortUuid(normalizeUuid(k.uuid))), el('div', { class: 'muted small' }, `${k.products} ／ ${k.status}`))));
  }
}

export default {
  id: 'uuid-manage', title: 'UUID 管理', connected: false,
  init(app) { $('um-back').onclick = () => app.show('top'); },
  enter() { render(); },
};
