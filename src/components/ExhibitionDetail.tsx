// 展覧会詳細画面（仕様 §5）。
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  /** 右スワイプで戻るジェスチャを有効にするか（シートや画像拡大の表示中は false） */
  swipeBackEnabled: boolean;
}

export function ExhibitionDetail({
  exhibition,
  onBack,
  onEdit,
  onDelete,
  onViewPhoto,
  swipeBackEnabled,
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

  // 右スワイプで一覧へ戻るジェスチャ（カード詳細画面のみ）。
  // 画面左端(40px以内)から始まる横スワイプで、詳細画面全体を指に追従させて右へ動かす。
  // 縦が勝る動きはスクロール扱いで解除し、左方向には反応しない。
  // 離したとき閾値を超えていれば右へ抜けて一覧へ、未満なら元位置へ戻す。
  const EDGE_START_PX = 40; // この距離以内の左端から始めたときだけ対象
  const VERTICAL_CANCEL_PX = 70; // 縦移動がこれを超え、かつ横より縦が大きければスクロール扱い
  const DIRECTION_COMMIT_PX = 12; // 横が縦より勝りこの距離動いたら横スワイプとして確定
  // prefers-reduced-motion が有効なら戻り／復帰アニメーションを無効化（即時）にする
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const EXIT_MS = prefersReduced ? 0 : 200; // 戻る成功：右へ抜ける
  const SNAP_MS = prefersReduced ? 0 : 180; // 戻る失敗：元位置へ戻す
  const DIM_MAX = 0.85; // 背景の最大の暗さ（スワイプ量が小さいときに最も暗い）
  const detailRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null); // 背後の一覧を暗くする暗幕
  const swipeRef = useRef({ tracking: false, dragging: false, startX: 0, startY: 0, dx: 0 });
  const timerRef = useRef<number | null>(null);

  // ジェスチャを有効にできる状態か（シート・画像拡大・削除ダイアログ表示中は無効）
  const swipeActive = swipeBackEnabled && !confirmOpen;

  // 詳細画面の transform と背景の暗幕を更新する。x>0 のときだけ右へずらす。
  // 暗さはスワイプ量が小さいほど濃く、進むほど薄くする（戻し切ると 0 で明るい）。
  // 指に追従中(durationMs=0)は transition なし。
  const applyTransform = (x: number, durationMs: number) => {
    const el = detailRef.current;
    if (el) {
      el.style.transition = durationMs > 0 ? `transform ${durationMs}ms ease` : 'none';
      el.style.transform = `translateX(${Math.max(0, x)}px)`;
      el.style.boxShadow = x > 0 ? '-8px 0 24px rgba(0, 0, 0, 0.15)' : '';
    }
    const scrim = scrimRef.current;
    if (scrim) {
      const w = window.innerWidth || 1;
      const progress = Math.min(1, Math.max(0, x) / w); // 0=未スワイプ, 1=画面幅ぶん
      scrim.style.transition = durationMs > 0 ? `opacity ${durationMs}ms ease` : 'none';
      scrim.style.opacity = String(DIM_MAX * (1 - progress));
    }
  };

  // transform・暗幕を完全に消す（position:fixed の戻るボタンを元の固定挙動に戻すため）
  const clearTransform = () => {
    const el = detailRef.current;
    if (el) {
      el.style.transition = '';
      el.style.transform = '';
      el.style.boxShadow = '';
    }
    const scrim = scrimRef.current;
    if (scrim) {
      scrim.style.transition = '';
      scrim.style.opacity = ''; // CSS 既定（0）へ戻す
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const s = swipeRef.current;
    s.dragging = false;
    if (!swipeActive || e.touches.length !== 1) {
      s.tracking = false;
      return;
    }
    const t = e.touches[0];
    if (t.clientX <= EDGE_START_PX) {
      s.tracking = true;
      s.startX = t.clientX;
      s.startY = t.clientY;
      s.dx = 0;
    } else {
      s.tracking = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const s = swipeRef.current;
    if (!s.tracking) return;
    const t = e.touches[0];
    const dx = t.clientX - s.startX;
    const dy = t.clientY - s.startY;

    if (!s.dragging) {
      // 方向確定前：縦が勝てばスクロール扱いで解除、横が明らかに勝れば横スワイプ確定
      if (Math.abs(dy) > VERTICAL_CANCEL_PX && Math.abs(dy) > Math.abs(dx)) {
        s.tracking = false;
        return;
      }
      if (dx > DIRECTION_COMMIT_PX && Math.abs(dx) > Math.abs(dy)) s.dragging = true;
      else return;
    }

    // 横スワイプ中：左方向は無視（>=0）、指に追従（transition なし）
    const x = Math.max(0, dx);
    s.dx = x;
    applyTransform(x, 0);
  };

  const handleTouchEnd = () => {
    const s = swipeRef.current;
    const wasDragging = s.tracking && s.dragging;
    s.tracking = false;
    s.dragging = false;
    if (!wasDragging) return;

    // 画面幅の50%を超えたら戻る
    const trigger = window.innerWidth * 0.45;
    if (s.dx >= trigger) {
      // 戻る成功：右へ抜けるアニメーション(200ms)のあと一覧へ
      applyTransform(window.innerWidth, EXIT_MS);
      timerRef.current = window.setTimeout(onBack, EXIT_MS);
    } else {
      // 戻る失敗：元の位置へ戻し(180ms)、アニメーション後に transform を消す
      applyTransform(0, SNAP_MS);
      timerRef.current = window.setTimeout(clearTransform, SNAP_MS);
    }
  };

  const handleTouchCancel = () => {
    const s = swipeRef.current;
    if (s.tracking && s.dragging) {
      applyTransform(0, SNAP_MS);
      timerRef.current = window.setTimeout(clearTransform, SNAP_MS);
    }
    s.tracking = false;
    s.dragging = false;
  };

  // アンマウント時に保留中のアニメーション用タイマを後始末する
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  // 横スワイプ確定中はブラウザの縦スクロールを止め、移動を横方向だけに固定する。
  // （確定前＝縦スクロール意図のときは preventDefault しないので通常スクロールは維持）
  // React の onTouchMove は passive のため、非パッシブの native リスナーで止める。
  useEffect(() => {
    const el = detailRef.current;
    if (!el) return;
    const onTouchMove = (ev: TouchEvent) => {
      const s = swipeRef.current;
      if (!s.tracking || ev.touches.length !== 1) return;
      const t = ev.touches[0];
      const dx = t.clientX - s.startX;
      const dy = t.clientY - s.startY;
      // 横優位（戻りジェスチャ）なら dragging 確定を待たずスクロールを止める。
      // これで「確定する最初の移動」や速いスワイプでも背景／詳細が一緒に動かない。
      if (s.dragging || (dx > 0 && Math.abs(dx) > Math.abs(dy))) ev.preventDefault();
    };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
  }, []);

  // 詳細レイヤー表示中は背後の一覧（body）スクロールをロックする。
  // useLayoutEffect で描画前に同期実行し、遷移直後でも一覧の慣性スクロールを即停止する。
  // overflow を変えるだけなので一覧のスクロール位置は保持される。
  useLayoutEffect(() => {
    const { body, documentElement: html } = document;
    const prevBody = body.style.overflow;
    const prevHtml = html.style.overflow;
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
    return () => {
      body.style.overflow = prevBody;
      html.style.overflow = prevHtml;
    };
  }, []);

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
    <>
      {/* スワイプ中に背後の一覧を少しだけ暗くする暗幕（不透明度は applyTransform が制御） */}
      <div className="detail-scrim" ref={scrimRef} aria-hidden="true" />
      <div
      className="detail"
      ref={detailRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
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
        <dt>年月</dt>
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
    </>
  );
}
