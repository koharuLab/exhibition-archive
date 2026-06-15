// 選択中タグの表示・解除（仕様 §9）。
import { TagChip } from './TagChip';

interface TagFilterBarProps {
  selectedTags: string[];
  onRemove: (tag: string) => void;
  onClearAll: () => void;
}

export function TagFilterBar({ selectedTags, onRemove, onClearAll }: TagFilterBarProps) {
  if (selectedTags.length === 0) return null;

  return (
    <div className="filter-bar">
      <span className="filter-label">絞り込み中:</span>
      {selectedTags.map((tag) => (
        <TagChip
          key={tag}
          tag={tag}
          onRemove={() => onRemove(tag)}
          removeLabel={`タグ ${tag} を解除`}
        />
      ))}
      <button type="button" className="clear-all-btn" onClick={onClearAll}>
        すべて解除
      </button>
    </div>
  );
}
