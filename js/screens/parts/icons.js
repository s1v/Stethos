// カテゴリのアイコン（24x24 の線画 SVG）
const P = {
  speed: '<path d="M4 16a8 8 0 1 1 16 0"/><path d="M12 16l4-5"/><circle cx="12" cy="16" r="1.2"/>',
  pedal: '<rect x="7" y="3" width="10" height="15" rx="2"/><path d="M9 7h6M9 10h6M9 13h6"/><path d="M12 18v3"/>',
  engine: '<path d="M4 10h3l2-2h6v3h2l2-2v8l-2-2h-2v3H9l-2-2H4z"/><path d="M10 5h4M12 5v3"/>',
  battery: '<rect x="3" y="7" width="18" height="12" rx="2"/><path d="M7 7V5h2v2M15 7V5h2v2"/><path d="M6.5 13h3M8 11.5v3M14.5 13h3"/>',
  temp: '<path d="M10 14V5a2 2 0 1 1 4 0v9a4 4 0 1 1-4 0z"/><path d="M12 9v7"/>',
  air: '<path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 12h15a3 3 0 1 1-3 3"/><path d="M3 16h7"/>',
  fuel: '<path d="M5 20V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15z"/><path d="M5 10h10"/><path d="M15 8l3 2v7a1.5 1.5 0 0 0 3 0V9l-3-3"/>',
  trim: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  gauge: '<circle cx="12" cy="13" r="8"/><path d="M12 13l4-4"/><path d="M9 3h6"/>',
  evap: '<path d="M8 20c-2-2-2-4 0-6s2-4 0-6"/><path d="M13 20c-2-2-2-4 0-6s2-4 0-6"/><path d="M18 20c-2-2-2-4 0-6s2-4 0-6"/>',
  o2: '<circle cx="9" cy="12" r="5"/><circle cx="17" cy="15" r="2.5"/><path d="M17 5v4"/>',
  exhaust: '<path d="M3 14h10l3-3h5v6h-5l-3-3"/><path d="M6 10c0-2 2-2 2-4M10 10c0-2 2-2 2-4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  diag: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.5" r=".8"/>',
};
export function icon(name) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', 'ico');
  s.innerHTML = P[name] || P.info;
  return s;
}
