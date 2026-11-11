// VIN から車両情報（メーカー・年式）を推定する
import { WMI } from './config/wmi.js';

const YEAR_CODES = 'ABCDEFGHJKLMNPRSTVWXY123456789'; // 1980〜2009（30 年周期で繰り返し）

/** オフラインで推定：{ brand, year }（分からない項目は null） */
export function decodeVin(vin) {
  if (!vin || vin.length !== 17) return null;
  const brand = WMI[vin.slice(0, 3)] || WMI[vin.slice(0, 2)] || null;
  let year = null;
  const i = YEAR_CODES.indexOf(vin[9]);
  if (i >= 0) {
    const limit = new Date().getFullYear() + 1;
    year = 1980 + i;
    while (year + 30 <= limit) year += 30;
  }
  return { brand, year };
}

/**
 * オンラインで車種を調べる（米国運輸省 NHTSA の無料 API。利用者がボタンを押したときだけ VIN を送信）
 * 北米向け以外の車は車種名が返らないことがある
 */
export async function lookupVinOnline(vin) {
  const r = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const x = (await r.json()).Results?.[0] || {};
  const clean = (v) => (v && v !== '0' && !/not applicable/i.test(v) ? v : null);
  return { make: clean(x.Make), model: clean(x.Model), year: clean(x.ModelYear), trim: clean(x.Trim) };
}
