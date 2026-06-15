// タグ管理（削除・名前変更／統合）の操作をまとめる hook。
// 展覧会データ・タグ色・表示順・絞り込み選択にまたがる後始末を一箇所に集約する。
import { useCallback } from 'react';
import type { Exhibition, TicketPhoto } from '../types';
import { useTagColors } from '../context/tagColorContext';

interface UseTagOperationsParams {
  exhibitions: Exhibition[];
  /** 全カードから指定タグを削除する（失敗時は throw） */
  removeTag: (tag: string) => Promise<void>;
  /** 全カードのタグ名を一括変更する（失敗時は throw） */
  renameTag: (oldName: string, newName: string) => Promise<void>;
  /** 削除の取り消し用：展覧会レコードを復元する */
  restoreExhibitions: (records: Exhibition[], photos?: TicketPhoto[]) => Promise<void>;
  /** 現在の絞り込み選択タグ */
  selectedTags: string[];
  setSelectedTags: React.Dispatch<React.SetStateAction<string[]>>;
  /** 取り消し通知を表示する */
  showUndo: (message: string, run: () => void | Promise<void>) => void;
}

export interface UseTagOperations {
  /** タグを全カードから削除し、色・表示順・絞り込みも後始末する（取り消し可能） */
  handleDeleteTag: (tag: string) => Promise<void>;
  /** タグの名前変更／統合と色変更を反映する */
  handleEditTag: (oldName: string, newName: string, color: string) => Promise<void>;
}

export function useTagOperations({
  exhibitions,
  removeTag,
  renameTag,
  restoreExhibitions,
  selectedTags,
  setSelectedTags,
  showUndo,
}: UseTagOperationsParams): UseTagOperations {
  const { colors, setColor, removeColor, order, setOrder } = useTagColors();

  // タグ削除：全カードから除去し、色・表示順・絞り込み選択も後始末する。
  // 取り消し用に削除前の状態をスナップショットしておく。
  const handleDeleteTag = useCallback(
    async (tag: string) => {
      const affected = exhibitions
        .filter((e) => e.tags.includes(tag))
        .map((e) => ({ ...e, tags: [...e.tags] }));
      const prevColor = colors[tag];
      const prevOrder = order;
      const prevSelected = selectedTags;

      try {
        await removeTag(tag);
      } catch {
        return; // エラーは useExhibitions が表示済み。後始末・通知は行わない。
      }
      removeColor(tag);
      setOrder(order.filter((t) => t !== tag));
      setSelectedTags((prev) => prev.filter((t) => t !== tag));

      showUndo('削除しました', async () => {
        try {
          await restoreExhibitions(affected);
        } catch {
          return;
        }
        if (prevColor) setColor(tag, prevColor);
        setOrder(prevOrder);
        setSelectedTags(prevSelected);
      });
    },
    [exhibitions, colors, order, selectedTags, removeTag, restoreExhibitions, removeColor, setColor, setOrder, setSelectedTags, showUndo],
  );

  // タグ編集：名前変更／統合と色の変更を同時に反映する
  const handleEditTag = useCallback(
    async (oldName: string, newName: string, color: string) => {
      const nameChanged = oldName !== newName;
      if (nameChanged) {
        try {
          await renameTag(oldName, newName);
        } catch {
          return;
        }
      }
      // 編集後タグの色を確定（統合先・新名・同名いずれも選択色を適用）
      setColor(newName, color);
      if (nameChanged) {
        removeColor(oldName);
        // 表示順の旧名を新名へ置換（統合時は重複を除去して位置を保持）
        setOrder(Array.from(new Set(order.map((t) => (t === oldName ? newName : t)))));
        setSelectedTags((prev) => {
          if (!prev.includes(oldName)) return prev;
          return Array.from(new Set(prev.map((t) => (t === oldName ? newName : t))));
        });
      }
    },
    [order, renameTag, setColor, removeColor, setOrder, setSelectedTags],
  );

  return { handleDeleteTag, handleEditTag };
}