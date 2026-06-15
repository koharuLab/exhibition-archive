// タグ入力（色選択＋過去使用タグの候補表示。仕様 §8）。
import { useState } from 'react';
import { useTagColors } from '../context/tagColorContext';
import {
  TAG_PALETTE,
  DEFAULT_TAG_COLOR,
  getTagColorStyle,
  getSwatchBackground,
} from '../lib/tagColors';
import { TagChip } from './TagChip';

interface TagInputProps {
  /** 現在選択中のタグ */
  value: string[];
  onChange: (tags: string[]) => void;
  /** 候補として表示する過去使用タグ */
  suggestions: string[];
  /**
   * 新規入力タグに割り当てた色を親へ通知する（色の永続化はフォーム保存時に親が行う）。
   * これにより、保存せずにキャンセルした場合に未使用の色レコードが残らない。
   */
  onNewTagColor?: (tag: string, color: string) => void;
}

export function TagInput({ value, onChange, suggestions, onNewTagColor }: TagInputProps) {
  const { colors } = useTagColors();
  const [draft, setDraft] = useState('');
  const [selectedColor, setSelectedColor] = useState(DEFAULT_TAG_COLOR);
  // 新規入力タグの色ドラフト（保存前の表示用。永続化は親が保存時に行う）
  const [draftColors, setDraftColors] = useState<Record<string, string>>({});

  /** 入力欄からの追加：選択中の色をドラフトとして保持し、親へ通知する。 */
  const addNewTag = (raw: string) => {
    const tag = raw.trim();
    if (tag === '') {
      setDraft('');
      return;
    }
    setDraftColors((prev) => ({ ...prev, [tag]: selectedColor }));
    onNewTagColor?.(tag, selectedColor);
    if (!value.includes(tag)) {
      onChange([...value, tag]);
    }
    setDraft('');
  };

  /** 候補からの追加：既存の色を維持する。 */
  const addExistingTag = (tag: string) => {
    if (!value.includes(tag)) onChange([...value, tag]);
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  // まだ選択していない候補のみ表示
  const available = suggestions.filter((s) => !value.includes(s));

  return (
    <div className="tag-input">
      <div className="tag-chips">
        {value.map((tag) => (
          <TagChip
            key={tag}
            tag={tag}
            colorKey={draftColors[tag] ?? colors[tag]}
            onRemove={() => removeTag(tag)}
          />
        ))}
      </div>

      <div className="tag-add-row">
        <input
          type="text"
          value={draft}
          placeholder="タグを入力"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addNewTag(draft);
            }
          }}
        />
        <button type="button" onClick={() => addNewTag(draft)}>
          追加
        </button>
      </div>

      {/* 追加するタグの色を選択 */}
      <div className="color-picker" role="radiogroup" aria-label="タグの色">
        {TAG_PALETTE.map((color) => (
          <button
            key={color.key}
            type="button"
            className={
              color.key === selectedColor ? 'swatch swatch-selected' : 'swatch'
            }
            style={{ background: getSwatchBackground(color) }}
            role="radio"
            aria-checked={color.key === selectedColor}
            aria-label={color.label}
            title={color.label}
            onClick={() => setSelectedColor(color.key)}
          />
        ))}
      </div>

      {available.length > 0 && (
        <div className="tag-suggestions">
          <span className="tag-suggestions-label">候補:</span>
          {available.map((tag) => (
            <button
              key={tag}
              type="button"
              className="chip chip-clickable"
              style={getTagColorStyle(colors[tag])}
              onClick={() => addExistingTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
