// 展覧会カード（仕様 §4）。
// 通常: タップで詳細、長押しで複数選択モードへ。選択モード: タップで選択/解除。
import { memo, useEffect, useMemo, useRef } from 'react';
import type { Exhibition } from '../types';
import { formatForDisplay } from '../lib/date';
import { useTagColors } from '../context/tagColorContext';
import { sortTagsByOrder } from '../lib/tagOrder';
import { usePhotoUrl } from '../hooks/usePhotoUrl';
import { TagChip } from './TagChip';

interface ExhibitionCardProps {
  exhibition: Exhibition;
  /** カード本体押下で詳細を開く */
  onOpen: (id: string) => void;
  /** カード内タグ押下で絞り込み条件に追加 */
  onSelectTag: (tag: string) => void;
  /** 複数選択モード中か */
  selectionMode: boolean;
  /** このカードが選択中か */
  selected: boolean;
  /** 選択モード中のタップで選択/解除 */
  onToggleSelect: (id: string) => void;
  /** 長押しで複数選択モードへ入る（このカードを選択） */
  onLongPress: (id: string) => void;
}

const LONG_PRESS_MS = 400;
const MOVE_CANCEL_PX = 10;

export const ExhibitionCard = memo(function ExhibitionCard({
  exhibition,
  onOpen,
  onSelectTag,
  selectionMode,
  selected,
  onToggleSelect,
  onLongPress,
}: ExhibitionCardProps) {
  const { order } = useTagColors();
  // タグ管理で設定した表示順をカード上のタグにも反映する
  const orderedTags = useMemo(
    () => sortTagsByOrder(exhibition.tags, order),
    [exhibition.tags, order],
  );
  // カード画像（チケット写真を転用）のサムネイル
  const thumbUrl = usePhotoUrl(exhibition.ticketPhotoId);

  const timerRef = useRef<number | null>(null);
  const firedRef = useRef(false); // 長押しが発火したか（直後の click を無効化する）
  const startRef = useRef({ x: 0, y: 0 });

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };
  useEffect(() => clearTimer, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return; // 左クリック/タッチのみ
    firedRef.current = false;
    startRef.current = { x: e.clientX, y: e.clientY };
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      firedRef.current = true;
      navigator.vibrate?.(10);
      onLongPress(exhibition.id);
    }, LONG_PRESS_MS);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (timerRef.current === null) return;
    if (
      Math.abs(e.clientX - startRef.current.x) > MOVE_CANCEL_PX ||
      Math.abs(e.clientY - startRef.current.y) > MOVE_CANCEL_PX
    ) {
      clearTimer(); // スクロールとみなして長押しを取り消す
    }
  };

  const handleClick = () => {
    if (firedRef.current) {
      firedRef.current = false; // 長押しで処理済み → クリックは無視
      return;
    }
    if (selectionMode) onToggleSelect(exhibition.id);
    else onOpen(exhibition.id);
  };

  return (
    <button
      type="button"
      className={selected ? 'card card-selected' : 'card'}
      aria-pressed={selectionMode ? selected : undefined}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={clearTimer}
      onPointerCancel={clearTimer}
      onContextMenu={(e) => e.preventDefault()}
    >
      {selectionMode && (
        <span className={selected ? 'card-check checked' : 'card-check'} aria-hidden="true">
          {selected ? '✓' : ''}
        </span>
      )}

      {thumbUrl && (
        <div className="card-thumb">
          <img src={thumbUrl} alt="" loading="lazy" />
        </div>
      )}
      <div className="card-yearmonth-row">
        <span className="card-yearmonth">{formatForDisplay(exhibition.visitYearMonth)}</span>
        {/* リンクアイコンは日付の右に配置（仕様 §11） */}
        {exhibition.url && (
          <span title="展覧会サイト登録あり" aria-label="URL あり">
            🔗
          </span>
        )}
      </div>
      <div className="card-name">{exhibition.name}</div>

      {exhibition.tags.length > 0 && (
        <div className="card-tags">
          {/* 選択モード中はタグ押下で絞り込まず、カードの選択トグルを優先する */}
          {orderedTags.map((tag) => (
            <TagChip
              key={tag}
              tag={tag}
              onClick={selectionMode ? undefined : () => onSelectTag(tag)}
            />
          ))}
        </div>
      )}
    </button>
  );
});
