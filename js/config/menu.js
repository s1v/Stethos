// 接続後メニューの定義（カスタム画面を増やすときはここに追加する）
// type: 'screen' → 画面遷移 / 'action' → app 側のアクションを実行
export const MENU_ITEMS = [
  { type: 'screen', screen: 'home', label: 'ホーム' },
  { type: 'screen', screen: 'status', label: 'ステータス' },
  { type: 'action', action: 'presets', screen: 'mypage', label: 'マイページ' }, // 一覧の一番上のプリセットを開く（切り替えはマイページのヘッダーから）
  { type: 'screen', screen: 'dtc', label: '診断情報' },
  { type: 'screen', screen: 'settings', label: '設定' },
  { type: 'action', action: 'disconnect', label: '切断', danger: true },
];
