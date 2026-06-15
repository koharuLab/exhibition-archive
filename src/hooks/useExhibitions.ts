// 展覧会データの読み込みと操作をまとめる hook。
import { useCallback, useEffect, useState } from 'react';
import type { Exhibition, TicketPhoto } from '../types';
import {
  listExhibitions,
  sortExhibitions,
  addExhibition,
  updateExhibition,
  deleteExhibition,
  putExhibitions,
  removeTagFromAll,
  renameTagInAll,
  addTagsToExhibitions,
  type NewExhibition,
} from '../db/exhibitions';
import { restorePhoto } from '../db/photos';

export interface UseExhibitions {
  exhibitions: Exhibition[];
  loading: boolean;
  /** 直近の操作で発生したエラーメッセージ（なければ null） */
  error: string | null;
  /** エラー表示を消す */
  clearError: () => void;
  add: (input: NewExhibition) => Promise<Exhibition>;
  update: (id: string, input: NewExhibition) => Promise<Exhibition>;
  remove: (id: string) => Promise<void>;
  /** 複数の展覧会をまとめて削除する */
  removeMany: (ids: string[]) => Promise<void>;
  /** 全カードから指定タグを削除する */
  removeTag: (tag: string) => Promise<void>;
  /** 全カードのタグ名を一括変更する（統合含む） */
  renameTag: (oldName: string, newName: string) => Promise<void>;
  /** 指定カード群へタグを一括追加する（重複なし） */
  addTags: (ids: string[], tags: string[]) => Promise<void>;
  /** 削除の取り消し用：展覧会レコード（と写真）をそのまま復元する */
  restoreExhibitions: (records: Exhibition[], photos?: TicketPhoto[]) => Promise<void>;
}

export function useExhibitions(): UseExhibitions {
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = await listExhibitions();
        if (active) setExhibitions(list);
      } catch {
        if (active) setError('データの読み込みに失敗しました');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // DB 操作を実行し、失敗時はエラーメッセージを表示して再 throw する。
  // 成功時に渡された関数でローカル状態を更新する（全件再取得を避ける）。
  const run = useCallback(async <T>(failMessage: string, op: () => Promise<T>): Promise<T> => {
    try {
      const result = await op();
      setError(null);
      return result;
    } catch (e) {
      setError(failMessage);
      throw e;
    }
  }, []);

  const add = useCallback(
    (input: NewExhibition) =>
      run('保存に失敗しました', async () => {
        const created = await addExhibition(input);
        setExhibitions((prev) => sortExhibitions([...prev, created]));
        return created;
      }),
    [run],
  );

  const update = useCallback(
    (id: string, input: NewExhibition) =>
      run('保存に失敗しました', async () => {
        const updated = await updateExhibition(id, input);
        setExhibitions((prev) =>
          sortExhibitions(prev.map((e) => (e.id === id ? updated : e))),
        );
        return updated;
      }),
    [run],
  );

  const remove = useCallback(
    (id: string) =>
      run('削除に失敗しました', async () => {
        await deleteExhibition(id);
        setExhibitions((prev) => prev.filter((e) => e.id !== id));
      }),
    [run],
  );

  const removeMany = useCallback(
    (ids: string[]) =>
      run('削除に失敗しました', async () => {
        for (const id of ids) await deleteExhibition(id);
        const idSet = new Set(ids);
        setExhibitions((prev) => prev.filter((e) => !idSet.has(e.id)));
      }),
    [run],
  );

  const removeTag = useCallback(
    (tag: string) =>
      run('タグの削除に失敗しました', async () => {
        await removeTagFromAll(tag);
        setExhibitions((prev) =>
          prev.map((e) =>
            e.tags.includes(tag) ? { ...e, tags: e.tags.filter((t) => t !== tag) } : e,
          ),
        );
      }),
    [run],
  );

  const renameTag = useCallback(
    (oldName: string, newName: string) =>
      run('タグの変更に失敗しました', async () => {
        await renameTagInAll(oldName, newName);
        setExhibitions((prev) =>
          prev.map((e) => {
            if (!e.tags.includes(oldName)) return e;
            const renamed = e.tags.map((t) => (t === oldName ? newName : t));
            // 置換後に同一カード内で重複したタグは 1 つにまとめる（DB 側と同じ挙動）
            return { ...e, tags: Array.from(new Set(renamed)) };
          }),
        );
      }),
    [run],
  );

  const addTags = useCallback(
    (ids: string[], tags: string[]) =>
      run('タグの追加に失敗しました', async () => {
        await addTagsToExhibitions(ids, tags);
        const idSet = new Set(ids);
        setExhibitions((prev) =>
          prev.map((e) =>
            idSet.has(e.id) ? { ...e, tags: Array.from(new Set([...e.tags, ...tags])) } : e,
          ),
        );
      }),
    [run],
  );

  const restoreExhibitions = useCallback(
    (records: Exhibition[], photos: TicketPhoto[] = []) =>
      run('元に戻す操作に失敗しました', async () => {
        for (const photo of photos) await restorePhoto(photo);
        await putExhibitions(records);
        const restoredIds = new Set(records.map((r) => r.id));
        setExhibitions((prev) =>
          sortExhibitions([...prev.filter((e) => !restoredIds.has(e.id)), ...records]),
        );
      }),
    [run],
  );

  return {
    exhibitions,
    loading,
    error,
    clearError,
    add,
    update,
    remove,
    removeMany,
    removeTag,
    renameTag,
    addTags,
    restoreExhibitions,
  };
}

/** AND 検索：選択中タグをすべて含む展覧会のみ返す（仕様 §9）。 */
export function filterByTags(
  exhibitions: Exhibition[],
  selectedTags: string[],
): Exhibition[] {
  if (selectedTags.length === 0) return exhibitions;
  return exhibitions.filter((ex) =>
    selectedTags.every((tag) => ex.tags.includes(tag)),
  );
}