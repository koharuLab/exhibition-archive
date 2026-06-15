// 一覧画面ヘッダーのメニュー（三本線ボタンから開くドロップダウン）。
import { useEscapeKey } from '../hooks/useEscapeKey';

interface AppMenuProps {
  open: boolean;
  onClose: () => void;
  /** 「タグ管理」選択時 */
  onSelectTagManager: () => void;
  /** 「表示設定」選択時 */
  onSelectDisplaySettings: () => void;
  /** 「データ管理」選択時 */
  onSelectDataManager: () => void;
}

export function AppMenu({
  open,
  onClose,
  onSelectTagManager,
  onSelectDisplaySettings,
  onSelectDataManager,
}: AppMenuProps) {
  useEscapeKey(onClose, open);

  if (!open) return null;

  return (
    <div className="menu-overlay" onClick={onClose}>
      <nav
        className="menu-panel"
        role="menu"
        aria-label="メニュー"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="menu-item"
          role="menuitem"
          onClick={onSelectDisplaySettings}
        >
          表示設定
        </button>
        <button
          type="button"
          className="menu-item"
          role="menuitem"
          onClick={onSelectTagManager}
        >
          タグ管理
        </button>
        <button
          type="button"
          className="menu-item"
          role="menuitem"
          onClick={onSelectDataManager}
        >
          データ管理
        </button>
      </nav>
    </div>
  );
}
