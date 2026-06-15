// タグチップの共通表示。タグ色を反映し、クリック／削除に対応する。
import { useTagColors } from '../context/tagColorContext';
import { getTagColorStyle } from '../lib/tagColors';

interface TagChipProps {
  tag: string;
  /** 色キーを明示指定する（未保存のドラフト色など）。未指定なら保存済みの色を使う。 */
  colorKey?: string;
  /** 指定時はクリック可能なチップになる（カード・絞り込み候補など） */
  onClick?: () => void;
  /** 指定時は ✕ の削除ボタンを表示する */
  onRemove?: () => void;
  /** 削除ボタンの aria-label */
  removeLabel?: string;
}

export function TagChip({ tag, colorKey, onClick, onRemove, removeLabel }: TagChipProps) {
  const { colors } = useTagColors();
  const style = getTagColorStyle(colorKey ?? colors[tag]);
  const clickable = onClick !== undefined;

  return (
    <span
      className={clickable ? 'chip chip-clickable' : 'chip'}
      style={style}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={
        clickable
          ? (e) => {
              // カード本体など親要素のクリックを発火させない（仕様 §4）
              e.stopPropagation();
              onClick!();
            }
          : undefined
      }
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onClick!();
              }
            }
          : undefined
      }
    >
      {tag}
      {onRemove && (
        <button
          type="button"
          className="chip-remove"
          aria-label={removeLabel ?? `タグ ${tag} を外す`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          ✕
        </button>
      )}
    </span>
  );
}
