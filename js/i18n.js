// 言語の切り替え（日本語 / English）
// 画面に表示された日本語の文字列を、辞書（./i18n/en.js）を使って英語に置き換える。
// 各画面のコードは日本語のまま書き、DOM の変化を監視して自動で翻訳する方式。
// 辞書にない文字列は日本語のまま表示される（画面が壊れることはない）。
import { EN } from './i18n/en.js';

const KEY = 'stethos.lang';
const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
const exact = new Map();
const patterns = [];
for (const [ja, en] of Object.entries(EN)) {
  if (ja.includes('{}')) {
    const re = new RegExp('^' + ja.split('{}').map((p) => p.replace(/[.*+?^$()|[\]\\]/g, '\\$&')).join('([\\s\\S]+?)') + '$');
    patterns.push({ re, en, len: ja.replace(/\{\}/g, '').length });
  } else exact.set(ja, en);
}
patterns.sort((a, b) => b.len - a.len);

let lang = (() => {
  try { const v = localStorage.getItem(KEY); if (v === 'ja' || v === 'en') return v; } catch { /* noop */ }
  return /^ja/i.test(navigator.language || '') ? 'ja' : 'en';
})();

export const getLang = () => lang;

/** 日本語の文字列を現在の言語にする（JS から直接使う場合用） */
export function t(s) { return lang === 'en' ? tr(s) : s; }

function tr(s, depth = 0) {
  if (!s || depth > 4) return s;
  const hit = exact.get(s);
  if (hit != null) return hit;
  for (const p of patterns) {
    const m = p.re.exec(s);
    if (m) { let i = 1; return p.en.replace(/\{\}/g, () => tr(m[i++], depth + 1)); }
  }
  return s;
}

const JA = /[\u3040-\u30ff\u4e00-\u9fff\uff01-\uff5e]/;
function trText(s) {
  if (!s || !JA.test(s)) return s;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
  const r = tr(m[2]);
  return r === m[2] ? s : m[1] + r + m[3];
}

// 元の日本語を覚えておく（日本語に戻すため）
const origText = new WeakMap(), wrote = new WeakMap();
const origAttr = new WeakMap();

function doText(node) {
  const cur = node.nodeValue;
  if (wrote.get(node) === cur) return; // 自分で書いた値
  origText.set(node, cur);
  const out = lang === 'en' ? trText(cur) : cur;
  if (out !== cur) { wrote.set(node, out); node.nodeValue = out; } else wrote.delete(node);
}
function doAttrs(elm) {
  let o = origAttr.get(elm);
  for (const a of ATTRS) {
    if (!elm.hasAttribute(a)) continue;
    const cur = elm.getAttribute(a);
    if (!o) { o = {}; origAttr.set(elm, o); }
    if (o['w_' + a] === cur) continue;
    o[a] = cur;
    const out = lang === 'en' ? trText(cur) : cur;
    if (out !== cur) { o['w_' + a] = out; elm.setAttribute(a, out); }
  }
}
function walk(root) {
  if (root.nodeType === 3) { doText(root); return; }
  if (root.nodeType !== 1 || root.tagName === 'SCRIPT' || root.tagName === 'STYLE') return;
  doAttrs(root);
  for (let c = root.firstChild; c; c = c.nextSibling) walk(c);
}
// 言語を切り替えたとき：元の日本語から付け直す
function reapply(root) {
  if (root.nodeType === 3) {
    const o = origText.get(root);
    if (o != null) { const out = lang === 'en' ? trText(o) : o; wrote.set(root, out); root.nodeValue = out; }
    else doText(root);
    return;
  }
  if (root.nodeType !== 1 || root.tagName === 'SCRIPT' || root.tagName === 'STYLE') return;
  const o = origAttr.get(root);
  if (o) {
    for (const a of ATTRS) if (a in o) { const out = lang === 'en' ? trText(o[a]) : o[a]; o['w_' + a] = out; root.setAttribute(a, out); }
  } else doAttrs(root);
  for (let c = root.firstChild; c; c = c.nextSibling) reapply(c);
}

const obs = new MutationObserver((recs) => {
  for (const r of recs) {
    if (r.type === 'characterData') doText(r.target);
    else if (r.type === 'attributes') doAttrs(r.target);
    else r.addedNodes.forEach(walk);
  }
});

const listeners = new Set();
export function onLangChange(cb) { listeners.add(cb); }

export function setLang(v) {
  if (v !== 'ja' && v !== 'en') return;
  lang = v;
  try { localStorage.setItem(KEY, v); } catch { /* noop */ }
  document.documentElement.lang = v;
  reapply(document.body);
  updateSwitchers();
  listeners.forEach((cb) => { try { cb(v); } catch { /* noop */ } });
}

function updateSwitchers() {
  document.querySelectorAll('.lang-seg button').forEach((b) => {
    const on = b.dataset.lang === lang;
    b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on));
  });
}

document.documentElement.lang = lang;
walk(document.body);
obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
document.querySelectorAll('.lang-seg button').forEach((b) => { b.onclick = () => setLang(b.dataset.lang); });
updateSwitchers();
