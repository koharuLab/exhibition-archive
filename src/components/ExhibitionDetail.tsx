// 展覧会詳細画面（仕様 §5）。
import { useState } from 'react';
import type { Exhibition } from '../types';
import { formatForDisplay } from '../lib/date';
import { useTagColors } from '../context/tagColorContext';
import { sortTagsByOrder } from '../lib/tagOrder';
import { usePhotoUrl } from '../hooks/usePhotoUrl';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { TagChip } from './TagChip';

interface ExhibitionDetailProps {
  exhibition: Exhibition;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void | Promise<void>;
  onViewPhoto: () => void;
}

export function ExhibitionDetail({
  exhibition,
  onBack,
  onEdit,
  onDelete,
  onViewPhoto,
}: ExhibitionDetailProps) {
  const { order } = useTagColors();
  // タグ管理で設定した表示順に従う
  const orderedTags = sortTagsByOrder(exhibition.tags, order);
  // カード画像（チケット写真を転用）。一覧より大きく表示する。
  const photoUrl = usePhotoUrl(exhibition.ticketPhotoId);

  // 削除確認ダイアログの表示状態
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEscapeKey(() => setConfirmOpen(false), confirmOpen && !busy);

  const handleConfirmDelete = async () => {
    setBusy(true);
    try {
      await onDelete();
    } finally {
      // 親が一覧へ遷移するため通常ここには戻らないが、念のため後始末する
      setBusy(false);
      setConfirmOpen(false);
    }
  };

  return (
    <div className="detail">
      <header className="detail-header">
        <button type="button" className="back-btn" onClick={onBack}>
          ← 戻る
        </button>
      </header>

      {photoUrl && (
        <button
          type="button"
          className="detail-photo"
          onClick={onViewPhoto}
          aria-label="カード画像を拡大表示"
        >
          <img src={photoUrl} alt="カード画像" />
        </button>
      )}

      <h1 className="detail-name">{exhibition.name}</h1>

      <dl className="detail-fields">
        <dt>訪問年月</dt>
        <dd>{formatForDisplay(exhibition.visitYearMonth)}</dd>

        {exhibition.venue && (
          <>
            <dt>会場名</dt>
            <dd>{exhibition.venue}</dd>
          </>
        )}

        {exhibition.tags.length > 0 && (
          <>
            <dt>タグ</dt>
            <dd className="detail-tags">
              {orderedTags.map((tag) => (
                <TagChip key={tag} tag={tag} />
              ))}
            </dd>
          </>
        )}
      </dl>

      {/* URL 登録時のみ関連サイトを開くボタンを表示（仕様 §5/§11） */}
      {exhibition.url && (
        <a
          className="link-btn"
          href={exhibition.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          🔗 関連サイトを開く
        </a>
      )}

      <div className="detail-actions">
        <button type="button" className="action-btn" onClick={onEdit}>
          編集
        </button>
        <button
          type="button"
          className="action-btn danger"
          onClick={() => setConfirmOpen(true)}
        >
          削除
        </button>
      </div>

      {/* 削除確認ダイアログ（仕様 §16 削除） */}
      {confirmOpen && (
        <div
          className="confirm-overlay"
          onClick={() => {
            if (!busy) setConfirmOpen(false);
          }}
        >
          <div
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-label="展覧会削除の確認"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="confirm-title">展覧会を削除しますか？</h3>
            <p className="confirm-text">
              「{exhibition.name}」を削除します。
            </p>
            <div className="confirm-actions">
              <button
                type="button"
                className="confirm-cancel"
                disabled={busy}
                onClick={() => setConfirmOpen(false)}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="confirm-delete"
                disabled={busy}
                onClick={handleConfirmDelete}
              >
                削除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
