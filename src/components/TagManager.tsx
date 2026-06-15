// タグ管理モーダル（一覧画面に重ねて表示・スマホではほぼ全画面）。
// 使用中タグと件数の表示、タグ削除、タグ編集（名前＋色／統合）。
import { useEffect, useMemo, useRef, useState } from 'react';
import type { TagCount } from '../db/exhibitions';
import { useTagColors } from '../context/tagColorContext';
import { TAG_PALETTE, DEFAULT_TAG_COLOR, getSwatchBackground } from '../lib/tagColors';
import { sortByTagOrder } from '../lib/tagOrder';
import { TagChip } from './TagChip';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface TagManagerProps {
  tagCounts: TagCount[];
  /** 全カードから該当タグを削除する */
  onDeleteTag: (tag: string) => Promise<void>;
  /** タグの名前・色を変更する（統合含む） */
  onEditTag: (oldName: string, newName: string, color: string) => Promise<void>;
  onClose: () => void;
}

export function TagManager({
  tagCounts,
  onDeleteTag,
  onEditTag,
  onClose,
}: TagManagerProps) {
  const { colors, order, setOrder } = useTagColors();

  // 表示順に並べたタグ一覧（保存済み順序に従い、未登録タグは件数順のまま末尾）
  const orderedTags = useMemo(
    () => sortByTagOrder(tagCounts, (t) => t.tag, order),
    [tagCounts, order],
  );

  // ドラッグ並び替えの状態
  const listRef = useRef<HTMLUListElement>(null);
  const rectsRef = useRef<DOMRect[]>([]);
  const startYRef = useRef(0);
  const draggingRef = useRef(false); // ドラッグ実行中か（touchmove のスクロール抑止に使用）
  const longPressRef = useRef<number | null>(null); // タッチ長押し判定タイマ
  const pendingRef = useRef<
    { index: number; x: number; y: number; pointerId: number; el: HTMLElement } | null
  >(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dragY, setDragY] = useState(0); // ドラッグ中の行の移動量(px)
  const [dragHeight, setDragHeight] = useState(0); // ドラッグ中の行の高さ(px)
  const [dropIndex, setDropIndex] = useState<number | null>(null); // 挿入位置(0..n)

  // タッチ長押し設定（押下後この時間ほぼ静止でドラッグ開始）
  const LONG_PRESS_MS = 350;
  const MOVE_CANCEL_PX = 10; // 待機中にこれ以上動いたらスクロール扱いで解除

  // 長押し待機をキャンセルする
  const clearLongPress = () => {
    if (longPressRef.current !== null) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
    pendingRef.current = null;
  };

  // 実際にドラッグを開始する（行位置を記録しポインタを捕捉）
  const beginDrag = (index: number, clientY: number, pointerId: number, el: HTMLElement) => {
    const rows = listRef.current?.querySelectorAll('.tag-manage-row') ?? [];
    rectsRef.current = Array.from(rows, (r) => r.getBoundingClientRect());
    startYRef.current = clientY;
    draggingRef.current = true;
    setDragKey(orderedTags[index].tag);
    setDropIndex(index);
    setDragY(0);
    setDragHeight(rectsRef.current[index]?.height ?? 0);
    try {
      el.setPointerCapture(pointerId);
    } catch {
      // 一部環境で失敗しうるが無視してよい
    }
    navigator.vibrate?.(10); // 開始の触覚フィードバック（対応端末のみ）
  };

  // ポインタ押下：タッチは長押しで開始（その間スクロール可）、マウス/ペンは即開始
  const handlePointerDown = (e: React.PointerEvent, index: number) => {
    if (busy) return;
    // 編集・削除ボタン上ではドラッグを開始しない（ボタン操作を優先）
    if ((e.target as HTMLElement).closest('.tag-row-actions')) return;

    if (e.pointerType === 'touch') {
      pendingRef.current = {
        index,
        x: e.clientX,
        y: e.clientY,
        pointerId: e.pointerId,
        el: e.currentTarget as HTMLElement,
      };
      longPressRef.current = window.setTimeout(() => {
        const p = pendingRef.current;
        longPressRef.current = null;
        if (p) beginDrag(p.index, p.y, p.pointerId, p.el);
      }, LONG_PRESS_MS);
    } else {
      e.preventDefault();
      beginDrag(index, e.clientY, e.pointerId, e.currentTarget as HTMLElement);
    }
  };

  // ポインタ移動：待機中は移動でキャンセル、ドラッグ中は挿入位置を更新する。
  // 判定はポインタ位置ではなく「ドラッグ中タグ内部の判定線」を使い、
  // タグがある程度食い込んでから挿入位置が切り替わるようにする。
  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragKey === null) {
      const p = pendingRef.current;
      if (
        p &&
        (Math.abs(e.clientY - p.y) > MOVE_CANCEL_PX ||
          Math.abs(e.clientX - p.x) > MOVE_CANCEL_PX)
      ) {
        clearLongPress(); // スクロール/タップとみなして長押しを取り消す
      }
      return;
    }

    const rects = rectsRef.current;
    const from = orderedTags.findIndex((t) => t.tag === dragKey);
    if (from < 0 || rects.length === 0) return;

    // 行の範囲内に収め、モーダル外へ飛び出さないようにする
    const minDy = rects[0].top - rects[from].top;
    const maxDy = rects[rects.length - 1].bottom - rects[from].bottom;
    const dy = Math.max(minDy, Math.min(maxDy, e.clientY - startYRef.current));
    setDragY(dy);

    const h = rects[from].height;
    const draggedTop = rects[from].top + dy;
    // 隣の行と SWAP_RATIO 以上重なったら入れ替える。
    // 上下で探索方向を分け、必要な食い込み量を対称（|dy| = SWAP_RATIO * h）にする。
    const SWAP_RATIO = 0.5;

    let idx = from;
    if (dy > 0) {
      // 下移動：判定線が下の行の上端を越えた数だけ挿入位置を下げる
      const probe = draggedTop + (1 - SWAP_RATIO) * h;
      let k = from + 1;
      while (k < rects.length && probe > rects[k].top) k++;
      idx = k;
    } else if (dy < 0) {
      // 上移動：判定線が上の行の下端を上回った数だけ挿入位置を上げる
      const probe = draggedTop + SWAP_RATIO * h;
      let k = from - 1;
      while (k >= 0 && probe < rects[k].bottom) k--;
      idx = k + 1;
    }
    setDropIndex(idx);
  };

  // ポインタ解放/キャンセル：長押し待機を解除し、ドラッグ中なら順序を確定して永続化する
  const handlePointerEnd = () => {
    clearLongPress();
    if (dragKey === null) return;
    draggingRef.current = false;
    const names = orderedTags.map((t) => t.tag);
    const from = names.indexOf(dragKey);
    const target = dropIndex ?? from;
    if (from !== -1 && target !== from && target !== from + 1) {
      const [moved] = names.splice(from, 1);
      names.splice(target > from ? target - 1 : target, 0, moved);
      setOrder(names);
    }
    setDragKey(null);
    setDropIndex(null);
    setDragY(0);
  };

  // ドラッグ実行中のみタッチスクロールを抑止する（待機中・非ドラッグ時はスクロール可）。
  // touch-action だけでは制御しきれないため非パッシブの touchmove で preventDefault する。
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onTouchMove = (ev: TouchEvent) => {
      if (draggingRef.current) ev.preventDefault();
    };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
  }, []);

  // アンマウント時に長押しタイマを後始末する
  useEffect(() => () => clearLongPress(), []);

  // 削除確認の対象
  const [pendingDelete, setPendingDelete] = useState<TagCount | null>(null);
  // 編集の対象・入力値・エラー
  const [editTarget, setEditTarget] = useState<TagCount | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftColor, setDraftColor] = useState(DEFAULT_TAG_COLOR);
  const [editError, setEditError] = useState('');
  // 統合確認（新名が既存タグの場合）
  const [mergeConfirm, setMergeConfirm] = useState<{
    oldName: string;
    newName: string;
    color: string;
    count: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const closeAllDialogs = () => {
    setPendingDelete(null);
    setEditTarget(null);
    setMergeConfirm(null);
    setEditError('');
  };

  useEscapeKey(() => {
    if (busy) return;
    // 開いているダイアログがあればそれを閉じ、無ければモーダルを閉じる
    if (mergeConfirm) setMergeConfirm(null);
    else if (editTarget) setEditTarget(null);
    else if (pendingDelete) setPendingDelete(null);
    else onClose();
  });

  const existingNames = new Set(tagCounts.map((t) => t.tag));

  const openEdit = (item: TagCount) => {
    setEditTarget(item);
    setDraftName(item.tag);
    setDraftColor(colors[item.tag] ?? DEFAULT_TAG_COLOR);
    setEditError('');
  };

  // 削除実行
  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await onDeleteTag(pendingDelete.tag);
      setPendingDelete(null);
    } finally {
      setBusy(false);
    }
  };

  // 編集ダイアログの「保存」押下
  const handleEditSubmit = () => {
    if (!editTarget) return;
    const trimmed = draftName.trim();
    if (trimmed === '') {
      setEditError('タグ名を入力してください');
      return;
    }

    const initialColor = colors[editTarget.tag] ?? DEFAULT_TAG_COLOR;
    const nameChanged = trimmed !== editTarget.tag;
    const colorChanged = draftColor !== initialColor;

    // 変更なしなら何もしない
    if (!nameChanged && !colorChanged) {
      setEditTarget(null);
      return;
    }

    // 名前が既存タグと重複 → 統合の確認
    if (nameChanged && existingNames.has(trimmed)) {
      setMergeConfirm({
        oldName: editTarget.tag,
        newName: trimmed,
        color: draftColor,
        count: editTarget.count,
      });
      setEditTarget(null);
      return;
    }

    void runEdit(editTarget.tag, trimmed, draftColor);
  };

  const runEdit = async (oldName: string, newName: string, color: string) => {
    setBusy(true);
    try {
      await onEditTag(oldName, newName, color);
      closeAllDialogs();
    } finally {
      setBusy(false);
    }
  };

  const dragFromIndex =
    dragKey === null ? -1 : orderedTags.findIndex((t) => t.tag === dragKey);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="タグ管理"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2>タグ管理</h2>
          <button type="button" className="icon-btn" aria-label="閉じる" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="modal-body">
          {tagCounts.length === 0 ? (
            <p className="empty-state">使用中のタグはありません。</p>
          ) : (
            <>
              <p className="tag-manage-hint">
                タグはドラッグで並び替えできます。
              </p>
              <ul className="tag-manage-list" ref={listRef}>
                {orderedTags.map((item, index) => {
                  const dragging = dragKey === item.tag;
                  // ドラッグ中の行と挿入位置の間にある行を 1 行分スライドさせ、
                  // 元の場所を埋めつつ挿入先に隙間を作る（一般的な並び替えの動き）。
                  let transform: string | undefined;
                  if (dragging) {
                    transform = `translateY(${dragY}px)`;
                  } else if (dragKey !== null && dropIndex !== null) {
                    // 掴んだタグの周りを上下対称に開ける。
                    // ・並べ替え分: from と挿入位置の間の行を 1 行ぶん(dragHeight)スライドさせる。
                    // ・隙間分(HALF_GAP): 挿入位置より上の行は上へ、下の行は下へ均等に逃がす。
                    //   これでリスト全体が中心を保ったまま上下へ広がり、上だけ詰まらない。
                    //   端の押し出しは .tag-manage-list の上下 padding で吸収する（値を一致させる）。
                    const HALF_GAP = 8;
                    const from = dragFromIndex;
                    const target = dropIndex;

                    let shift = 0; // 並べ替えによるスライド量
                    if (target > from && index > from && index < target) {
                      shift = -dragHeight; // 下移動：間の行を上へ詰める
                    } else if (target < from && index >= target && index < from) {
                      shift = dragHeight; // 上移動：間の行を下へ送る
                    }

                    // 挿入位置より下は下へ、上は上へ（掴んだ行はこの分岐に来ない）
                    const gap = index >= target ? HALF_GAP : -HALF_GAP;
                    transform = `translateY(${shift + gap}px)`;
                  }
                  return (
                    <li
                      key={item.tag}
                      className={dragging ? 'tag-manage-row dragging' : 'tag-manage-row'}
                      style={transform ? { transform } : undefined}
                      onPointerDown={(e) => handlePointerDown(e, index)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerEnd}
                      onPointerCancel={handlePointerEnd}
                      onContextMenu={(e) => e.preventDefault()}
                    >
                      <TagChip tag={item.tag} />
                      <span className="tag-count">{item.count} 件</span>
                      <div className="tag-row-actions">
                        <button
                          type="button"
                          className="tag-edit-btn"
                          onClick={() => openEdit(item)}
                        >
                          編集
                        </button>
                        <button
                          type="button"
                          className="tag-delete-btn"
                          onClick={() => setPendingDelete(item)}
                        >
                          削除
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* 削除確認ダイアログ */}
      {pendingDelete && (
        <div
          className="confirm-overlay"
          onClick={(e) => {
            e.stopPropagation();
            if (!busy) setPendingDelete(null);
          }}
        >
          <div
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-label="タグ削除の確認"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="confirm-title">タグを削除しますか？</h3>
            <p className="confirm-tag">
              <TagChip tag={pendingDelete.tag} />
            </p>
            <p className="confirm-text">
              このタグは {pendingDelete.count} 件のカードで使われています。
              <br />
              カード自体は削除されません。
            </p>
            <div className="confirm-actions">
              <button
                type="button"
                className="confirm-cancel"
                disabled={busy}
                onClick={() => setPendingDelete(null)}
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

      {/* 編集ダイアログ（名前＋色） */}
      {editTarget && (
        <div
          className="confirm-overlay"
          onClick={(e) => {
            e.stopPropagation();
            if (!busy) setEditTarget(null);
          }}
        >
          <div
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="タグの編集"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="confirm-title">タグを編集</h3>

            <label className="edit-field-label">タグ名</label>
            <input
              type="text"
              className="rename-input"
              value={draftName}
              autoFocus
              onChange={(e) => {
                setDraftName(e.target.value);
                if (editError) setEditError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleEditSubmit();
                }
              }}
            />
            {editError && <span className="field-error">{editError}</span>}

            <label className="edit-field-label">色</label>
            <div className="color-picker" role="radiogroup" aria-label="タグの色">
              {TAG_PALETTE.map((color) => (
                <button
                  key={color.key}
                  type="button"
                  className={
                    color.key === draftColor ? 'swatch swatch-selected' : 'swatch'
                  }
                  style={{ background: getSwatchBackground(color) }}
                  role="radio"
                  aria-checked={color.key === draftColor}
                  aria-label={color.label}
                  title={color.label}
                  onClick={() => setDraftColor(color.key)}
                />
              ))}
            </div>

            <div className="confirm-actions">
              <button
                type="button"
                className="confirm-cancel"
                disabled={busy}
                onClick={() => setEditTarget(null)}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="confirm-primary"
                disabled={busy}
                onClick={handleEditSubmit}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 統合確認ダイアログ（新名が既存タグの場合） */}
      {mergeConfirm && (
        <div
          className="confirm-overlay"
          onClick={(e) => {
            e.stopPropagation();
            if (!busy) setMergeConfirm(null);
          }}
        >
          <div
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-label="タグ統合の確認"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="confirm-title">タグを統合しますか？</h3>
            <p className="confirm-text">
              「{mergeConfirm.oldName}」は既存のタグ「{mergeConfirm.newName}」に統合されます。
              <br />
              対象カード: {mergeConfirm.count} 件
              <br />
              同じカード内で重複したタグは 1 つにまとめられます。
            </p>
            <div className="confirm-actions">
              <button
                type="button"
                className="confirm-cancel"
                disabled={busy}
                onClick={() => setMergeConfirm(null)}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="confirm-primary"
                disabled={busy}
                onClick={() =>
                  runEdit(mergeConfirm.oldName, mergeConfirm.newName, mergeConfirm.color)
                }
              >
                統合する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
