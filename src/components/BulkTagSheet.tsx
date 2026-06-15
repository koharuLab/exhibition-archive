// 複数選択したカードへタグを一括追加するシート。
// 既存タグの候補選択・新規タグ作成（TagInput を再利用）に対応する。
import { useState } from 'react';
import { useTagColors } from '../context/tagColorContext';
import { BottomSheet } from './BottomSheet';
import { TagInput } from './TagInput';

interface BulkTagSheetProps {
  open: boolean;
  /** 選択中のカード件数 */
  count: number;
  /** 候補表示用の過去使用タグ */
  suggestions: string[];
  onClose: () => void;
  /** 追加するタグを確定する */
  onApply: (tags: string[]) => Promise<void> | void;
}

export function BulkTagSheet({ open, count, suggestions, onClose, onApply }: BulkTagSheetProps) {
  const { setColor } = useTagColors();
  const [tags, setTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  // 新規入力タグの色ドラフト（適用成功時にまとめて永続化する）
  const [tagColorDrafts, setTagColorDrafts] = useState<Record<string, string>>({});

  // 入力内容を破棄して閉じる（キャンセル時に前回入力が残らないようにする）
  const handleClose = () => {
    setTags([]);
    setTagColorDrafts({});
    onClose();
  };

  const handleApply = async () => {
    if (tags.length === 0) return;
    setBusy(true);
    try {
      await onApply(tags);
      // 追加したタグの色だけを確定する
      for (const tag of tags) {
        const color = tagColorDrafts[tag];
        if (color) setColor(tag, color);
      }
      setTags([]);
      setTagColorDrafts({});
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} title="タグを追加" onClose={handleClose}>
      <p className="bulk-tag-desc">選択中の {count} 件にタグを追加します。</p>
      <TagInput
        value={tags}
        suggestions={suggestions}
        onChange={setTags}
        onNewTagColor={(tag, color) =>
          setTagColorDrafts((prev) => ({ ...prev, [tag]: color }))
        }
      />
      <button
        type="button"
        className="primary-btn"
        disabled={busy || tags.length === 0}
        onClick={handleApply}
      >
        {count} 件に追加
      </button>
    </BottomSheet>
  );
}
