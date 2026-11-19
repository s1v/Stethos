// UDS 探索画面（設定画面から開く・上級者向け）
// 「調査を開始」を押すだけで、必要な調査を自動で行い、読み取り専用の結果をログに残す
import { $, confirmDialog, toast } from '../ui.js';
import { APP_VERSION } from '../version.js';
import { Uds, TARGETS, STD_DIDS, DEFAULT_DIDS, rxOf, nrcText, hexRef, responderId, monitorCan } from '../uds.js';

let app_ = null, running = false, uds = null, lines = [];
const hhmmss = () => new Date().toTimeString().slice(0, 8);

function log(s) {
  lines.push(`${hhmmss()} ${s}`);
  const pre = $('uds-log');
  pre.textContent = lines.slice(-500).join('\n');
  pre.scrollTop = pre.scrollHeight;
}
const progress = (s) => { $('uds-progress').textContent = s || ''; };
const setBusy = (b) => { $('uds-auto').disabled = b; $('uds-stop').hidden = !b; };
const dids = () => DEFAULT_DIDS.split(/\r?\n/).map((l) => /^([0-9A-F]{4})\s/.exec(l.trim())?.[1]).filter(Boolean);

/** 1 回の要求と記録。raw=true のときは生の応答も残す（どの ID から返ったかを見るため） */
async function ask(label, cmd, { raw = false } = {}) {
  const r = await uds.req(cmd);
  const did = cmd.startsWith('22') ? cmd.slice(2) : '';
  const id = responderId(r.lines), from = id ? ` 〔応答元 ${id}〕` : '';
  if (r.kind === 'pos') {
    if (did === 'F190') log(`${label} ${cmd} → 応答あり${from}（VIN は伏せています）`);
    else log(`${label} ${cmd} → 応答あり${from} ${r.data.slice(0, 160)}  [${hexRef(r.data)}]`);
  } else if (r.kind === 'neg') log(`${label} ${cmd} → 否定応答${from} 7F ${r.nrc}（${nrcText(r.nrc)}）`);
  else if (r.kind === 'nodata') log(`${label} ${cmd} → NO DATA`);
  else if (r.kind === 'timeout') log(`${label} ${cmd} → 時間切れ`);
  else log(`${label} ${cmd} → ${r.kind} ${r.raw.slice(0, 120)}`);
  if (raw && r.kind !== 'pos' && r.kind !== 'nodata' && r.kind !== 'timeout' && r.raw) log(`   生の応答: ${r.raw.slice(0, 160)}`);
  return { ...r, id };
}

const alive = (r) => r.kind === 'pos' || r.kind === 'neg';

async function scanRange(hdr, fromH, toH) {
  const from = parseInt(fromH, 16), to = parseInt(toH, 16), count = to - from + 1;
  let hit = 0, silent = 0, n = 0;
  log(`-- 範囲 ${fromH}〜${toH}（${count} 件）--`);
  for (let d = from; d <= to; d++) {
    if (uds.stopped) break;
    const did = d.toString(16).toUpperCase().padStart(4, '0');
    if (++n % 8 === 0) progress(`${hdr} データ番号の探索 ${did}（${n}/${count}） 見つかった ${hit} 件`);
    const r = await uds.req('22' + did);
    if (r.kind === 'pos') { hit++; silent = 0; log(`${hdr} 22${did} → 応答あり 62${did} ${r.data.slice(0, 160)}  [${hexRef(r.data)}]`); }
    else if (r.kind === 'neg') { silent = 0; if (r.nrc !== '31') log(`${hdr} 22${did} → 否定応答 7F ${r.nrc}（${nrcText(r.nrc)}）`); }
    else if (r.kind === 'timeout' || r.kind === 'nodata' || r.kind === 'none') { if (++silent >= 10) { log('応答が 10 回続けてないため、この範囲を中断します'); break; } }
    else { silent = 0; log(`${hdr} 22${did} → ${r.kind} ${r.raw.slice(0, 80)}`); }
  }
  log(`範囲 ${fromH}〜${toH}: 応答あり ${hit} 件`);
}

/** アダプターの設定を、調査の前の状態に戻す */
async function restore() {
  if (!uds || !app_.session.elm) return;
  try {
    await uds.raw('ATH0'); await uds.raw('ATS0'); await uds.raw('ATCRA');
    if (uds.customProto) { await uds.raw('ATSP0'); try { await app_.session.elm.query('0100', 12000); } catch { /* noop */ } }
    else await uds.raw('ATSH7DF');
  } catch { /* 切断時など */ }
}

/** 調査の本体 */
async function investigate() {
  const found = []; // { hdr, rx }

  // ── A. 通信の確認（どこから応答が来るか）──
  log('【A】通信の確認：どの ID から応答が来るかを調べます');
  await uds.raw('ATH1'); await uds.raw('ATS1'); await uds.raw('ATCRA');
  progress('A 通信の確認（標準の問い合わせ）');
  log('-- A1 標準の問い合わせ（全 ECU 宛て 7DF）--');
  await uds.raw('ATSH7DF'); await ask('7DF', '0100', { raw: true });
  log('-- A2 標準の問い合わせを、エンジン ECU（7E0）だけに送る --');
  await uds.raw('ATSH7E0'); await ask('7E0', '0100', { raw: true });
  log('-- A3 受信フィルターなしで、各 ECU に UDS を送る --');
  let n = 0;
  for (const t of TARGETS) {
    if (uds.stopped) break;
    progress(`A 各 ECU への問い合わせ ${t.hdr}（${++n}/${TARGETS.length}）`);
    await uds.raw('ATSH' + t.hdr);
    for (const c of ['22F190', '1902FF']) {
      const r = await ask(t.hdr, c, { raw: true });
      if (alive(r) && !found.some((f) => f.hdr === t.hdr)) found.push({ hdr: t.hdr, rx: r.id && r.id.length === 3 ? r.id : rxOf(t.hdr) });
    }
  }
  if (!uds.stopped) { log('-- A4 全 ECU 宛て（7DF）に UDS を送る --'); await uds.raw('ATSH7DF'); await ask('7DF', '22F190', { raw: true }); }
  if (!uds.stopped) {
    log('-- A5 流れている CAN の通信を、3 秒間聞くだけ（送信なし）--');
    progress('A 通信を聞いています');
    const m = await monitorCan(uds, 3000);
    log(m.frames ? `通信 ${m.frames} 件。ID 別: ${m.ids.slice(0, 20).map(([i, c]) => `${i}×${c}`).join(' ')}${m.full ? '（バッファが一杯になりました）' : ''}` : '通信を受信できませんでした（ゲートウェイが通信を制限している可能性）');
    await uds.raw('ATH1'); await uds.raw('ATS1'); await uds.raw('ATCRA');
  }
  if (!uds.stopped) {
    log('-- A6 29bit 方式（SPA の独自方式の疑い）で試す --');
    uds.customProto = true;
    await uds.raw('ATSP7'); await uds.raw('ATH1'); await uds.raw('ATS1');
    progress('A 29bit 方式');
    await uds.raw('ATSHDB33F1'); await ask('29bit 全ECU宛て DB33F1', '0100', { raw: true });
    for (const [h, nm] of [['DA10F1', 'エンジン 0x10'], ['DA18F1', '変速機 0x18'], ['DA11F1', '0x11']]) {
      if (uds.stopped) break;
      await uds.raw('ATSH' + h);
      const r = await ask(`29bit ${nm} ${h}`, '22F190', { raw: true });
      if (alive(r)) log(`   → 29bit で応答あり（${h}）。結果を共有してください`);
    }
    await uds.raw('ATSP0'); await uds.raw('ATH1'); await uds.raw('ATS1');
    try { await app_.session.elm.query('0100', 12000); } catch { /* noop */ }
    uds.customProto = false;
  }
  await uds.raw('ATH0'); await uds.raw('ATS0'); await uds.raw('ATCRA');
  log(`応答のあった ECU（11bit）: ${found.length ? found.map((f) => `${f.hdr}→${f.rx}`).join(', ') : 'なし'}`);
  if (!found.length || uds.stopped) {
    if (!found.length) log('11bit の UDS 要求には、どの ECU からも応答がありませんでした。上の【A】の結果（特に A1・A2・A5・A6）をそのまま共有してください。');
    return;
  }

  // ── B. 候補データの読み取り ──
  log('【B】応答した ECU で、候補のデータ番号（DID）を読みます');
  const list = dids(), retry = new Map();
  n = 0;
  for (const f of found) {
    if (uds.stopped) break;
    log(`== ${f.hdr}（受信 ${f.rx}）==`);
    await uds.setTarget(f.hdr, f.rx);
    for (const d of list) {
      if (uds.stopped) break;
      progress(`B 候補 DID ${f.hdr} ${d}（${++n}/${found.length * list.length}）`);
      const r = await ask(f.hdr, '22' + d);
      if (r.kind === 'neg' && (r.nrc === '7E' || r.nrc === '7F')) { if (!retry.has(f.hdr)) retry.set(f.hdr, []); retry.get(f.hdr).push(d); }
    }
  }
  if (retry.size && !uds.stopped) {
    log('標準のセッションでは読めないデータがあったため、拡張セッションで再度試します');
    uds.ext = true;
    for (const f of found.filter((x) => retry.has(x.hdr))) {
      await uds.setTarget(f.hdr, f.rx); await uds.startSession();
      for (const d of retry.get(f.hdr)) { if (uds.stopped) break; progress(`B 再試行 ${f.hdr} ${d}`); await ask(f.hdr, '22' + d); }
      await uds.endSession();
    }
    uds.ext = false;
  }

  // ── C. データ番号の周辺の探索（最初に応答した ECU だけ）──
  if (uds.stopped) return;
  log('【C】データ番号の周辺を順に探します');
  const f = found[0];
  await uds.setTarget(f.hdr, f.rx);
  for (const [a, b] of [['4000', '40FF'], ['DA00', 'DBFF']]) { if (uds.stopped) break; await scanRange(f.hdr, a, b); }
}

async function start() {
  if (running || !app_.session.elm) return;
  if (!(await confirmDialog('車の ECU に、読み取り専用の問い合わせを自動で送ります。\n\n・停車して、エンジンをかけた状態（READY）で行ってください\n・他の OBD アプリは閉じてください\n・所要時間は 5〜10 分ほどです。画面を閉じたり、スリープさせたりしないでください\n・途中で「停止」できます\n・終わると、結果が自動でコピーされます', { title: '調査を開始します', ok: '開始' }))) return;
  running = true; setBusy(true);
  uds = new Uds(app_.session.elm); uds.interval = 100;
  let ok = true;
  try { await investigate(); } catch (e) { ok = false; log(`エラー: ${e.message || e}`); }
  await restore();
  log(ok ? (uds.stopped ? '--- 停止しました（設定を元に戻しました）---' : '--- 調査が終わりました（設定を元に戻しました）---') : '--- エラーで終了（設定を元に戻しました）---');
  progress(''); running = false; setBusy(false);
  try { await navigator.clipboard.writeText(fullText()); toast('調査が終わりました。結果をコピーしました'); }
  catch { toast('調査が終わりました。「ログをコピー」を押してください', { ms: 8000 }); }
  $('uds-log').scrollIntoView({ block: 'center' });
}

function fullText() {
  const e = app_.session.elm, s = app_.session;
  return [`Stethos UDS 探索ログ  v${APP_VERSION}${s.debug ? '（お試しモード）' : ''}`, `日時: ${new Date().toISOString()}`,
    `アダプター: ${e?.version || '-'} ／ 通信方式(ATDPN): ${e?.protocol || '-'}`,
    '※ 値の意味・計算式は未確認。「参考」は読み方の目安にすぎません。', '----------------------------------------', ...lines].join('\n');
}

async function copyLog() {
  try { await navigator.clipboard.writeText(fullText()); toast('ログをコピーしました'); return; } catch { /* フォールバック */ }
  const ta = document.createElement('textarea'); ta.style.cssText = 'position:fixed;left:-999px;top:0'; ta.value = fullText(); document.body.append(ta); ta.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch { /* noop */ }
  ta.remove(); toast(ok ? 'ログをコピーしました' : 'コピーできませんでした', { error: !ok });
}

export default {
  id: 'uds', title: 'UDS 探索', connected: true,
  init(app) {
    app_ = app;
    $('uds-auto').onclick = start;
    $('uds-stop').onclick = () => { if (uds) uds.stopped = true; };
    $('uds-copy').onclick = copyLog;
    $('uds-clear').onclick = () => { lines = []; $('uds-log').textContent = ''; };
  },
  leave() { if (uds) uds.stopped = true; },
};
