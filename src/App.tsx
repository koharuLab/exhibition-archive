// アプリ全体管理：画面遷移・タグ絞り込み・シート表示を統括する。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TicketPhoto } from './types';
import './App.css';
import { useExhibitions, filterByTags } from './hooks/useExhibitions';
import { collectUsedTags, collectTagCounts } from './db/exhibitions';
import { resolvePhotoIntent, getPhoto } from './db/photos';
import { ExhibitionGrid } from './components/ExhibitionGrid';
import { TagFilterBar } from './components/TagFilterBar';
import { ExhibitionDetail } from './components/ExhibitionDetail';
import { ExhibitionFormSheet } from './components/ExhibitionFormSheet';
import { PhotoViewer } from './components/PhotoViewer';
import { AppMenu } from './components/AppMenu';
import { TagManager } from './components/TagManager';
import { DisplaySettings } from './components/DisplaySettings';
import { DataManager } from './components/DataManager';
import { BulkTagSheet } from './components/BulkTagSheet';
import { UndoToast } from './components/UndoToast';
import { useViewMode } from './hooks/useViewMode';
import { useTheme } from './hooks/useTheme';
import { useTagOperations } from './hooks/useTagOperations';

/** 元に戻す通知の表示時間（ミリ秒）。経過後は削除を確定する。 */
const UNDO_MS = 5000;

type View = { kind: 'list' } | { kind: 'detail'; id: string };
type Sheet = null | { mode: 'add' } | { mode: 'edit'; id: string };
/** ヘッダーメニューから開く各モーダル（排他表示） */
type Modal = null | 'menu' | 'tag' | 'display' | 'data';

export default function App() {
  const {
    exhibitions,
    loading,
    error,
    clearError,
    add,
    update,
    remove,
    removeMany,
    removeTag: removeTagEverywhere,
    renameTag: renameTagEverywhere,
    addTags,
    restoreExhibitions,
  } = useExhibitions();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [view, setView] = useState<View>({ kind: 'list' });
  const [sheet, setSheet] = useState<Sheet>(null);
  const [viewerPhotoId, setViewerPhotoId] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<Modal>(null);
  // 複数選択モード
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkTagOpen, setBulkTagOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  // 選択モードヘッダーのドロップダウン（選択操作 / 一括操作）
  const [selectionMenu, setSelectionMenu] = useState<null | 'select' | 'action'>(null);
  const [viewMode, setViewMode] = useViewMode();
  const [theme, setTheme] = useTheme();

  // 「元に戻す」通知：5秒以内に押せば run() で復元、経過すれば削除確定（破棄）
  // id は通知ごとに更新し、トーストの key としてゲージアニメーションを毎回やり直させる
  const [undoState, setUndoState] = useState<
    { id: number; message: string; run: () => void | Promise<void> } | null
  >(null);
  const undoTimerRef = useRef<number | null>(null);
  const undoIdRef = useRef(0);

  const clearUndoTimer = () => {
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  };

  const showUndo = useCallback((message: string, run: () => void | Promise<void>) => {
    clearUndoTimer();
    undoIdRef.current += 1;
    setUndoState({ id: undoIdRef.current, message, run });
    undoTimerRef.current = window.setTimeout(() => {
      setUndoState(null);
      undoTimerRef.current = null;
    }, UNDO_MS);
  }, []);

  const handleUndo = async () => {
    clearUndoTimer();
    const current = undoState;
    setUndoState(null);
    if (current) await current.run();
  };

  // アンマウント時にタイマを後始末
  useEffect(() => () => clearUndoTimer(), []);

  const suggestions = useMemo(() => collectUsedTags(exhibitions), [exhibitions]);
  const tagCounts = useMemo(() => collectTagCounts(exhibitions), [exhibitions]);
  const filtered = useMemo(
    () => filterByTags(exhibitions, selectedTags),
    [exhibitions, selectedTags],
  );

  // 一覧カードから詳細を開く
  const openDetail = useCallback((id: string) => setView({ kind: 'detail', id }), []);

  // タグ絞り込み（AND 検索・仕様 §9）
  const addTag = useCallback(
    (tag: string) => setSelectedTags((prev) => (prev.includes(tag) ? prev : [...prev, tag])),
    [],
  );
  const removeTag = useCallback(
    (tag: string) => setSelectedTags((prev) => prev.filter((t) => t !== tag)),
    [],
  );
  const clearTags = useCallback(() => setSelectedTags([]), []);

  // 複数選択：長押しで開始、タップで選択/解除、キャンセルで通常表示へ
  const enterSelection = useCallback((id: string) => {
    setSelectionMode(true);
    setSelectedIds([id]);
  }, []);
  const toggleSelect = useCallback(
    (id: string) =>
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
      ),
    [],
  );
  const cancelSelection = () => {
    setSelectionMode(false);
    setSelectedIds([]);
    setBulkTagOpen(false);
    setBulkDeleteOpen(false);
    setSelectionMenu(null);
  };
  // 選択モード中、ヘッダー・カード・各種オーバーレイ以外の余白をタップしたら選択を解除する
  const handleScreenClick = (e: React.MouseEvent) => {
    if (!selectionMode) return;
    const target = e.target as HTMLElement;
    if (
      target.closest(
        '.list-header, .card, .sheet-overlay, .modal-overlay, .menu-overlay, .settings-overlay, .confirm-overlay',
      )
    ) {
      return;
    }
    cancelSelection();
  };
  // すべて選択／すべて解除（表示中のカードが対象）
  const selectAll = () => {
    setSelectedIds(filtered.map((e) => e.id));
    setSelectionMenu(null);
  };
  const deselectAll = () => {
    setSelectedIds([]);
    setSelectionMenu(null);
  };

  // 一括タグ追加：選択カードへタグを追加し、取り消し用にスナップショットを残す
  const handleBulkAddTags = async (tagsToAdd: string[]) => {
    const ids = selectedIds;
    const snapshot = exhibitions
      .filter((e) => ids.includes(e.id))
      .map((e) => ({ ...e, tags: [...e.tags] }));
    try {
      await addTags(ids, tagsToAdd);
    } catch {
      return; // エラーは useExhibitions が表示済み
    }
    cancelSelection();
    showUndo('タグを追加しました', () => restoreExhibitions(snapshot));
  };

  // 一括削除：選択カード（と写真）を削除し、取り消し用にスナップショットを残す
  const handleBulkDelete = async () => {
    const ids = selectedIds;
    const targets = exhibitions
      .filter((e) => ids.includes(e.id))
      .map((e) => ({ ...e, tags: [...e.tags] }));
    const photos: TicketPhoto[] = [];
    for (const e of targets) {
      if (e.ticketPhotoId) {
        const photo = await getPhoto(e.ticketPhotoId);
        if (photo) photos.push(photo);
      }
    }
    try {
      await removeMany(ids);
    } catch {
      return; // エラーは useExhibitions が表示済み
    }
    cancelSelection();
    showUndo('削除しました', () => restoreExhibitions(targets, photos));
  };

  // タグ削除／編集の操作（色・表示順・絞り込み選択の後始末を含む）
  const { handleDeleteTag, handleEditTag } = useTagOperations({
    exhibitions,
    removeTag: removeTagEverywhere,
    renameTag: renameTagEverywhere,
    restoreExhibitions,
    selectedTags,
    setSelectedTags,
    showUndo,
  });

  const detailExhibition =
    view.kind === 'detail' ? exhibitions.find((e) => e.id === view.id) : undefined;

  const editTarget =
    sheet?.mode === 'edit' ? exhibitions.find((e) => e.id === sheet.id) : undefined;

  // 操作失敗時のエラー通知（一覧・詳細どちらの画面でも表示する）
  const errorBanner = error ? (
    <div className="error-toast" role="alert">
      <span className="error-toast-msg">{error}</span>
      <button
        type="button"
        className="error-toast-btn"
        aria-label="エラーを閉じる"
        onClick={clearError}
      >
        ✕
      </button>
    </div>
  ) : null;

  if (view.kind === 'detail' && detailExhibition) {
    return (
      <>
        <ExhibitionDetail
          exhibition={detailExhibition}
          onBack={() => setView({ kind: 'list' })}
          onEdit={() => setSheet({ mode: 'edit', id: detailExhibition.id })}
          onViewPhoto={() => {
            if (detailExhibition.ticketPhotoId) {
              setViewerPhotoId(detailExhibition.ticketPhotoId);
            }
          }}
          onDelete={async () => {
            // 取り消し用に展覧会レコードと写真をスナップショット（削除前に取得）
            const snapshot = { ...detailExhibition, tags: [...detailExhibition.tags] };
            const photo = snapshot.ticketPhotoId
              ? await getPhoto(snapshot.ticketPhotoId)
              : undefined;
            try {
              await remove(snapshot.id);
            } catch {
              return; // エラーは useExhibitions が表示済み（詳細画面のまま残す）
            }
            setView({ kind: 'list' });
            showUndo('削除しました', () =>
              restoreExhibitions([snapshot], photo ? [photo] : []),
            );
          }}
        />

        {/* 編集シート：開いている間だけマウントしフォーム状態を初期化する */}
        {sheet?.mode === 'edit' && editTarget && (
          <ExhibitionFormSheet
            key={editTarget.id}
            open
            initial={editTarget}
            suggestions={suggestions}
            onClose={() => setSheet(null)}
            onSubmit={async ({ value, photoIntent }) => {
              const ticketPhotoId = await resolvePhotoIntent(
                editTarget.ticketPhotoId,
                photoIntent,
              );
              await update(editTarget.id, { ...value, ticketPhotoId });
            }}
          />
        )}

        {viewerPhotoId && (
          <PhotoViewer photoId={viewerPhotoId} onClose={() => setViewerPhotoId(null)} />
        )}

        {errorBanner}
      </>
    );
  }

  return (
    <div className="list-screen" onClick={handleScreenClick}>
      {selectionMode ? (
        <header className="list-header">
          <button type="button" className="menu-btn" aria-label="選択をやめる" onClick={cancelSelection}>
            ✕
          </button>
          <span className="selection-count">{selectedIds.length} 件選択中</span>

          {/* 選択操作：すべて選択／すべて解除 */}
          <div className="header-menu-wrap">
            <button
              type="button"
              className="menu-btn"
              aria-label="選択操作"
              aria-haspopup="true"
              aria-expanded={selectionMenu === 'select'}
              onClick={() => setSelectionMenu(selectionMenu === 'select' ? null : 'select')}
            >
              ☑
            </button>
            {selectionMenu === 'select' && (
              <>
                <div className="dropdown-overlay" onClick={() => setSelectionMenu(null)} />
                <nav className="header-dropdown" role="menu" aria-label="選択操作">
                  <button type="button" className="menu-item" role="menuitem" onClick={selectAll}>
                    すべて選択
                  </button>
                  <button type="button" className="menu-item" role="menuitem" onClick={deselectAll}>
                    すべて解除
                  </button>
                </nav>
              </>
            )}
          </div>

          {/* 一括操作：タグ追加／削除 */}
          <div className="header-menu-wrap">
            <button
              type="button"
              className="menu-btn"
              aria-label="一括操作メニュー"
              aria-haspopup="true"
              aria-expanded={selectionMenu === 'action'}
              onClick={() => setSelectionMenu(selectionMenu === 'action' ? null : 'action')}
            >
              ☰
            </button>
            {selectionMenu === 'action' && (
              <>
                <div className="dropdown-overlay" onClick={() => setSelectionMenu(null)} />
                <nav className="header-dropdown" role="menu" aria-label="一括操作">
                  <button
                    type="button"
                    className="menu-item"
                    role="menuitem"
                    disabled={selectedIds.length === 0}
                    onClick={() => {
                      setSelectionMenu(null);
                      setBulkTagOpen(true);
                    }}
                  >
                    タグ追加
                  </button>
                  <button
                    type="button"
                    className="menu-item danger"
                    role="menuitem"
                    disabled={selectedIds.length === 0}
                    onClick={() => {
                      setSelectionMenu(null);
                      setBulkDeleteOpen(true);
                    }}
                  >
                    削除
                  </button>
                </nav>
              </>
            )}
          </div>
        </header>
      ) : (
        <header className="list-header">
          <h1>展覧会一覧</h1>
          <button
            type="button"
            className="menu-btn"
            aria-label="メニュー"
            aria-haspopup="true"
            aria-expanded={activeModal === 'menu'}
            onClick={() => setActiveModal('menu')}
          >
            ☰
          </button>
        </header>
      )}

      <AppMenu
        open={activeModal === 'menu'}
        onClose={() => setActiveModal(null)}
        onSelectTagManager={() => setActiveModal('tag')}
        onSelectDisplaySettings={() => setActiveModal('display')}
        onSelectDataManager={() => setActiveModal('data')}
      />

      {activeModal === 'display' && (
        <DisplaySettings
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          theme={theme}
          onThemeChange={setTheme}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'tag' && (
        <TagManager
          tagCounts={tagCounts}
          onDeleteTag={handleDeleteTag}
          onEditTag={handleEditTag}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'data' && <DataManager onClose={() => setActiveModal(null)} />}

      <TagFilterBar
        selectedTags={selectedTags}
        onRemove={removeTag}
        onClearAll={clearTags}
      />

      {loading ? (
        <p className="empty-state">読み込み中...</p>
      ) : exhibitions.length === 0 ? (
        <div className="empty-state">
          <p className="empty-title">まだ展覧会が追加されていません</p>
          <p className="empty-text">
            訪れた展覧会や、気になる展覧会を
            <br />
            右下の＋ボタンから追加できます
          </p>
        </div>
      ) : (
        <ExhibitionGrid
          exhibitions={filtered}
          viewMode={viewMode}
          onOpen={openDetail}
          onSelectTag={addTag}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onLongPress={enterSelection}
        />
      )}

      {/* 追加ボタンは選択モード中は隠す */}
      {!selectionMode && (
        <button
          type="button"
          className="fab"
          aria-label="展覧会を追加"
          onClick={() => setSheet({ mode: 'add' })}
        >
          ＋
        </button>
      )}

      {/* 一括タグ追加シート */}
      <BulkTagSheet
        open={bulkTagOpen}
        count={selectedIds.length}
        suggestions={suggestions}
        onClose={() => setBulkTagOpen(false)}
        onApply={handleBulkAddTags}
      />

      {/* 一括削除の確認 */}
      {bulkDeleteOpen && (
        <div className="confirm-overlay" onClick={() => setBulkDeleteOpen(false)}>
          <div
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-label="一括削除の確認"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="confirm-title">選択した展覧会を削除しますか？</h3>
            <p className="confirm-text">
              選択中の {selectedIds.length} 件を削除します。
              <br />
              （削除後に「元に戻す」で取り消せます）
            </p>
            <div className="confirm-actions">
              <button
                type="button"
                className="confirm-cancel"
                onClick={() => setBulkDeleteOpen(false)}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="confirm-delete"
                onClick={() => {
                  setBulkDeleteOpen(false);
                  void handleBulkDelete();
                }}
              >
                削除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 追加シート：開いている間だけマウントしフォーム状態を初期化する */}
      {sheet?.mode === 'add' && (
        <ExhibitionFormSheet
          open
          suggestions={suggestions}
          onClose={() => setSheet(null)}
          onSubmit={async ({ value, photoIntent }) => {
            const ticketPhotoId = await resolvePhotoIntent(undefined, photoIntent);
            await add({ ...value, ticketPhotoId });
          }}
        />
      )}

      {undoState && (
        <UndoToast
          key={undoState.id}
          message={undoState.message}
          durationMs={UNDO_MS}
          onUndo={handleUndo}
        />
      )}

      {errorBanner}
    </div>
  );
}
