// アダプターの動作報告（GitHub の Issue フォームを、分かっている情報を入れた状態で開く）
// 車・端末の情報（VIN、車種、ブラウザなど）は送らない。送るのは利用者が送信ボタンを押したときだけ（GitHub 上で内容を確認・編集してから送信）
import { $, el, confirmDialog, toast } from './ui.js';
import { shortUuid } from './storage.js';
import { APP_VERSION } from './version.js';

const REPO = 'https://github.com/s1v/Stethos';
const KEY = 'stethos.lastConn.v1';

/** 接続に成功したときの情報を保存（切断後も報告できるように） */
export function saveLastConnection(info) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...info, at: new Date().toISOString() })); } catch { /* noop */ }
}
export function getLastConnection() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
}

const MULTI = { on: '使用中', off: 'オフ', unsupported: '非対応（1 項目ずつ）' };

/** 報告用の URL（Issue フォームの各欄に値を入れる） */
export function buildReportUrl(c, appVersion = APP_VERSION) {
  const notes = [
    '（Stethos から自動入力）',
    `- アプリ：Stethos v${appVersion}`,
    `- マルチ PID 通信：${MULTI[c.multiState] || '-'}`,
  ].join('\n');
  const q = new URLSearchParams({
    template: 'adapter-report.yml',
    title: `[アダプター] ${shortUuid(c.serviceUuid || '')}`,
    uuid: shortUuid(c.serviceUuid || ''),
    notes,
  });
  return `${REPO}/issues/new?${q}`;
}

/** 「最後に接続したアダプター」のカードを描く（UUID 管理・設定画面で使う） */
export function renderReportCard(box, appVersion = APP_VERSION) {
  box.innerHTML = '';
  const c = getLastConnection();
  if (!c) { box.append(el('p', { class: 'muted small', style: 'margin:0' }, 'まだ接続したアダプターはありません。接続に成功すると、ここから動作を報告できます。')); return; }
  const rows = [
    ['機器名', c.deviceName || '-'],
    ['サービス UUID', shortUuid(c.serviceUuid || '') || '-'],
    ['接続日時', new Date(c.at).toLocaleString()],
  ];
  box.append(el('dl', { class: 'kv' }, rows.flatMap(([k, v]) => [el('dt', {}, k), el('dd', { class: k === 'サービス UUID' ? 'mono' : '' }, v)])));
  const btn = el('button', { class: 'btn primary', type: 'button' }, 'このアダプターの動作を報告 ›');
  if (c.debug) { btn.disabled = true; box.append(btn, el('p', { class: 'hint' }, 'お試しモードの接続は報告できません。')); return; }
  btn.onclick = async () => {
    const ok = await confirmDialog(
      'GitHub の報告フォームを、上の情報を入力した状態で開きます。\n\n・送信には GitHub のアカウントが必要です\n・「動作結果」を選んでから送信してください（製品名は分かる場合だけ）\n・車や端末の情報（VIN など）は送りません\n・接続中にこのアプリから離れると、切断されることがあります',
      { title: 'アダプターの動作を報告', ok: '報告フォームを開く' });
    if (!ok) return;
    const w = window.open(buildReportUrl(c, appVersion), '_blank', 'noopener');
    if (!w) toast('報告フォームを開けませんでした。ポップアップのブロックを確認してください。', { error: true });
  };
  box.append(btn, el('p', { class: 'hint' }, '報告していただいたアダプターは、確認後にアプリへ登録し、次の人が UUID の入力なしで使えるようにします。'));
}
