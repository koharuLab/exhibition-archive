// 表示設定モーダル（一覧画面に重ねて表示）。表示形式とテーマを切り替える。
import type { ViewMode } from '../hooks/useViewMode';
import type { Theme } from '../hooks/useTheme';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface DisplaySettingsProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onClose: () => void;
}

const VIEW_OPTIONS: { key: ViewMode; label: string; desc: string }[] = [
  { key: 'grid', label: 'グリッド表示', desc: 'カードを複数列で並べる' },
  { key: 'list', label: 'リスト表示', desc: 'カードを1列で大きく並べる' },
];

const THEME_OPTIONS: { key: Theme; label: string; desc: string }[] = [
  { key: 'light', label: 'ライト', desc: '明るい配色' },
  { key: 'dark', label: 'ダーク', desc: '暗い配色' },
];

export function DisplaySettings({
  viewMode,
  onViewModeChange,
  theme,
  onThemeChange,
  onClose,
}: DisplaySettingsProps) {
  useEscapeKey(onClose);

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label="表示設定"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2>表示設定</h2>
          <button type="button" className="icon-btn" aria-label="閉じる" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="settings-body">
          <section className="settings-section">
            <h3 className="settings-section-title">表示形式</h3>
            <div className="settings-options" role="radiogroup" aria-label="表示形式">
              {VIEW_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  role="radio"
                  aria-checked={viewMode === opt.key}
                  className={
                    viewMode === opt.key
                      ? 'settings-option settings-option-selected'
                      : 'settings-option'
                  }
                  onClick={() => onViewModeChange(opt.key)}
                >
                  <span className="settings-option-text">
                    <span className="settings-option-label">{opt.label}</span>
                    <span className="settings-option-desc">{opt.desc}</span>
                  </span>
                  {viewMode === opt.key && <span className="settings-check">✓</span>}
                </button>
              ))}
            </div>
          </section>

          <section className="settings-section">
            <h3 className="settings-section-title">テーマ</h3>
            <div className="settings-options" role="radiogroup" aria-label="テーマ">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  role="radio"
                  aria-checked={theme === opt.key}
                  className={
                    theme === opt.key
                      ? 'settings-option settings-option-selected'
                      : 'settings-option'
                  }
                  onClick={() => onThemeChange(opt.key)}
                >
                  <span className="settings-option-text">
                    <span className="settings-option-label">{opt.label}</span>
                    <span className="settings-option-desc">{opt.desc}</span>
                  </span>
                  {theme === opt.key && <span className="settings-check">✓</span>}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
