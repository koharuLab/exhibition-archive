// 追加・編集の共通フォームシート（仕様 §6/§7：同一フォーム構造を共有）。
import { useState } from 'react';
import type { Exhibition, ExhibitionFormInput, PhotoIntent } from '../types';
import { validateForm } from '../lib/validation';
import { formatForDisplay } from '../lib/date';
import { useTagColors } from '../context/tagColorContext';
import { BottomSheet } from './BottomSheet';
import { TagInput } from './TagInput';
import { PhotoField } from './PhotoField';

/** 検証・正規化済みのフォーム値（ticketPhotoId は親が写真意図から解決する）。 */
export type ValidatedExhibition = NonNullable<ReturnType<typeof validateForm>['value']>;

interface ExhibitionSubmit {
  value: ValidatedExhibition;
  photoIntent: PhotoIntent;
}

interface ExhibitionSheetProps {
  open: boolean;
  /** 編集対象。未指定なら新規追加。 */
  initial?: Exhibition;
  /** 候補表示用の過去使用タグ */
  suggestions: string[];
  onClose: () => void;
  onSubmit: (submit: ExhibitionSubmit) => Promise<void> | void;
}

function toFormInput(initial?: Exhibition): ExhibitionFormInput {
  return {
    name: initial?.name ?? '',
    visitYearMonth: initial ? formatForDisplay(initial.visitYearMonth) : '',
    venue: initial?.venue ?? '',
    url: initial?.url ?? '',
    tags: initial?.tags ?? [],
  };
}

export function ExhibitionFormSheet({
  open,
  initial,
  suggestions,
  onClose,
  onSubmit,
}: ExhibitionSheetProps) {
  const { setColor } = useTagColors();
  const [form, setForm] = useState<ExhibitionFormInput>(() => toFormInput(initial));
  const [errors, setErrors] = useState<ReturnType<typeof validateForm>['errors']>({});
  const [photoIntent, setPhotoIntent] = useState<PhotoIntent>({ kind: 'keep' });
  const [busy, setBusy] = useState(false);
  // 新規入力タグの色ドラフト（保存成功時にまとめて永続化する）
  const [tagColorDrafts, setTagColorDrafts] = useState<Record<string, string>>({});

  const isEdit = initial !== undefined;
  const title = isEdit ? '展覧会を編集' : '展覧会を追加';

  const handleSubmit = async () => {
    const result = validateForm(form);
    if (!result.value) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await onSubmit({ value: result.value, photoIntent });
      // 保存対象に残ったタグの色だけを確定する（途中で外したタグの色は永続化しない）
      for (const tag of result.value.tags) {
        const color = tagColorDrafts[tag];
        if (color) setColor(tag, color);
      }
      onClose();
    } catch {
      // 失敗時はシートを閉じず入力を残す（エラーメッセージは一覧側で表示済み）
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} title={title} onClose={onClose}>
      <form
        className="exhibition-form"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <label className="field">
          <span className="field-label">
            展覧会名<span className="required">*</span>
          </span>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </label>

        <label className="field">
          <span className="field-label">
            訪問年月<span className="required">*</span>
          </span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="YYYY/MM"
            value={form.visitYearMonth}
            onChange={(e) => setForm({ ...form, visitYearMonth: e.target.value })}
          />
          {errors.visitYearMonth && (
            <span className="field-error">{errors.visitYearMonth}</span>
          )}
        </label>

        <label className="field">
          <span className="field-label">会場名</span>
          <input
            type="text"
            value={form.venue}
            onChange={(e) => setForm({ ...form, venue: e.target.value })}
          />
        </label>

        <label className="field">
          <span className="field-label">関連サイト URL</span>
          <input
            type="url"
            placeholder="https://..."
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
          />
          {errors.url && <span className="field-error">{errors.url}</span>}
        </label>

        <div className="field">
          <span className="field-label">タグ</span>
          <TagInput
            value={form.tags}
            suggestions={suggestions}
            onChange={(tags) => setForm({ ...form, tags })}
            onNewTagColor={(tag, color) =>
              setTagColorDrafts((prev) => ({ ...prev, [tag]: color }))
            }
          />
        </div>

        <div className="field">
          <span className="field-label">カード画像</span>
          <PhotoField
            existingPhotoId={initial?.ticketPhotoId}
            onIntentChange={setPhotoIntent}
          />
        </div>

        <button type="submit" className="primary-btn" disabled={busy}>
          保存
        </button>
      </form>
    </BottomSheet>
  );
}
