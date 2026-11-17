// VIN から車両情報（メーカー・年式）を推定する（オフラインのみ。外部への送信はしない）
import { WMI } from './config/wmi.js';

// 10 桁目の年式コード。30 年ごとに同じ文字を使う（A=1980/2010 … Y=2000/2030、1=2001/2031 … 9=2009/2039）
const YEAR_CODES = 'ABCDEFGHJKLMNPRSTVWXY123456789';
// OBD-II の通信ができる車は 1996 年以降（米国 1996 年、欧州 2001 年、日本 2008 年に義務化）
const OBD2_FIRST_YEAR = 1996;

/**
 * 年式を推定する。候補は「1980 + n」と「2010 + n」の 2 つ
 * 1. 北米の VIN（先頭が 1〜5）：北米の規則で、7 桁目が数字なら古いほう、英字なら新しいほう
 * 2. それ以外：来年を超えない、新しいほう
 * 3. 共通：1996 年より前の候補は捨てる
 */
export function estimateYear(vin) {
  const i = YEAR_CODES.indexOf(vin[9]);
  if (i < 0) return null;
  const limit = new Date().getFullYear() + 1;
  const cands = [1980 + i, 2010 + i].filter((y) => y >= OBD2_FIRST_YEAR && y <= limit);
  if (!cands.length) return null;
  if (cands.length === 1) return cands[0];
  if (/^[1-5]/.test(vin)) return /[0-9]/.test(vin[6]) ? cands[0] : cands[1];
  return cands[1];
}

/** オフラインで推定：{ brand, year }（分からない項目は null） */
export function decodeVin(vin) {
  if (!vin || vin.length !== 17) return null;
  const brand = WMI[vin.slice(0, 3)] || WMI[vin.slice(0, 2)] || null;
  return { brand, year: estimateYear(vin) };
}
