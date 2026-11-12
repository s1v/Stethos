// 単位の切り替え（ヒント画面で項目ごとに選べる）
// 値の取得・計算は常に基本単位（pids.js の unit）で行い、表示するときだけ変換する。
// インジケーター（バー）は基本単位の min / max で計算するので、単位を変えても位置は同じ。
// f: 基本単位の値 → 表示単位の値 / decimals: 小数桁（省略時は項目の decimals）
export const UNIT_OPTIONS = {
  '°C': [{ unit: '°C', f: (x) => x }, { unit: '°F', f: (x) => x * 9 / 5 + 32 }],
  'kPa': [{ unit: 'kPa', f: (x) => x }, { unit: 'bar', f: (x) => x / 100, decimals: 2 }, { unit: 'psi', f: (x) => x * 0.1450377, decimals: 1 }, { unit: 'kgf/cm²', f: (x) => x * 0.0101972, decimals: 2 }],
  'Pa': [{ unit: 'Pa', f: (x) => x }, { unit: 'kPa', f: (x) => x / 1000, decimals: 2 }, { unit: 'inH2O', f: (x) => x / 249.089, decimals: 2 }],
  'km/h': [{ unit: 'km/h', f: (x) => x }, { unit: 'mph', f: (x) => x / 1.609344 }],
  'km': [{ unit: 'km', f: (x) => x }, { unit: 'mi', f: (x) => x / 1.609344 }],
  'Nm': [{ unit: 'Nm', f: (x) => x }, { unit: 'kgf·m', f: (x) => x * 0.1019716, decimals: 1 }, { unit: 'lb·ft', f: (x) => x * 0.7375621 }],
  'L/h': [{ unit: 'L/h', f: (x) => x }, { unit: 'gal/h', f: (x) => x * 0.2641720, decimals: 2 }],
  'g/s': [{ unit: 'g/s', f: (x) => x }, { unit: 'kg/h', f: (x) => x * 3.6, decimals: 1 }, { unit: 'lb/min', f: (x) => x * 0.1322774, decimals: 2 }],
};
