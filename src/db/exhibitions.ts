// 展覧会データの永続化操作（CRUD）。
import type { Exhibition } from '../types';
import { getDB, EXHIBITIONS_STORE, TICKET_PHOTOS_STORE } from './database';

function newId(): string {
  return crypto.randomUUID();
}

/**
 * 一覧表示順に並べ替える（仕様 §3）。
 * 訪問年月の新しい順。同一年月は登録順（createdAt）の新しい順。
 * 元配列は変更せず、並べ替えた新しい配列を返す。
 */
export function sortExhibitions(list: Exhibition[]): Exhibition[] {
  return [...list].sort((a, b) => {
    if (a.visitYearMonth !== b.visitYearMonth) {
      return b.visitYearMonth.localeCompare(a.visitYearMonth);
    }
    return b.createdAt - a.createdAt;
  });
}

/** 一覧表示順に並べた全展覧会を返す（仕様 §3）。 */
export async function listExhibitions(): Promise<Exhibition[]> {
  const db = await getDB();
  const all = await db.getAll(EXHIBITIONS_STORE);
  return sortExhibitions(all);
}

export type NewExhibition = Pick<
  Exhibition,
  'name' | 'visitYearMonth' | 'venue' | 'url' | 'tags' | 'ticketPhotoId'
>;

/** 展覧会を新規追加する。 */
export async function addExhibition(input: NewExhibition): Promise<Exhibition> {
  const now = Date.now();
  const exhibition: Exhibition = {
    id: newId(),
    ...input,
    createdAt: now,
    updatedAt: now,
  };
  const db = await getDB();
  await db.put(EXHIBITIONS_STORE, exhibition);
  return exhibition;
}

/**
 * 削除の取り消し用：展覧会レコードをそのまま書き戻す（id・createdAt・updatedAt を保持）。
 * 通常の更新と違い updatedAt を変更しない。
 */
export async function putExhibitions(records: Exhibition[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(EXHIBITIONS_STORE, 'readwrite');
  for (const record of records) {
    await tx.objectStore(EXHIBITIONS_STORE).put(record);
  }
  await tx.done;
}

/** 既存の展覧会を更新する。 */
export async function updateExhibition(
  id: string,
  input: NewExhibition,
): Promise<Exhibition> {
  const db = await getDB();
  const existing = await db.get(EXHIBITIONS_STORE, id);
  if (!existing) {
    throw new Error(`Exhibition not found: ${id}`);
  }
  const updated: Exhibition = {
    ...existing,
    ...input,
    updatedAt: Date.now(),
  };
  await db.put(EXHIBITIONS_STORE, updated);
  return updated;
}

/**
 * 展覧会を削除する。チケット写真が紐づく場合は写真データも削除する（仕様 §16 削除）。
 */
export async function deleteExhibition(id: string): Promise<void> {
  const db = await getDB();
  const existing = await db.get(EXHIBITIONS_STORE, id);
  if (!existing) return;

  const tx = db.transaction([EXHIBITIONS_STORE, TICKET_PHOTOS_STORE], 'readwrite');
  await tx.objectStore(EXHIBITIONS_STORE).delete(id);
  if (existing.ticketPhotoId) {
    await tx.objectStore(TICKET_PHOTOS_STORE).delete(existing.ticketPhotoId);
  }
  await tx.done;
}

/**
 * 全展覧会から指定タグだけを取り除く（タグ管理の削除）。
 * カード本体・他のタグ・updatedAt は変更しない（分類整理のための保守操作）。
 * 変更があった件数を返す。
 */
export async function removeTagFromAll(tag: string): Promise<number> {
  const db = await getDB();
  const tx = db.transaction(EXHIBITIONS_STORE, 'readwrite');
  const store = tx.objectStore(EXHIBITIONS_STORE);
  let affected = 0;
  let cursor = await store.openCursor();
  while (cursor) {
    const ex = cursor.value;
    if (ex.tags.includes(tag)) {
      const tags = ex.tags.filter((t) => t !== tag);
      await cursor.update({ ...ex, tags });
      affected += 1;
    }
    cursor = await cursor.continue();
  }
  await tx.done;
  return affected;
}

/**
 * 全展覧会のタグ名を一括変更する（タグ管理の名前変更／統合）。
 * 置換後に同一カード内で重複したタグは除去する（新名が既存タグなら統合になる）。
 * カード本体・updatedAt は変更しない。変更があった件数を返す。
 */
export async function renameTagInAll(
  oldName: string,
  newName: string,
): Promise<number> {
  const db = await getDB();
  const tx = db.transaction(EXHIBITIONS_STORE, 'readwrite');
  const store = tx.objectStore(EXHIBITIONS_STORE);
  let affected = 0;
  let cursor = await store.openCursor();
  while (cursor) {
    const ex = cursor.value;
    if (ex.tags.includes(oldName)) {
      const renamed = ex.tags.map((t) => (t === oldName ? newName : t));
      // 同一カード内の重複を除去（順序は保持）
      const deduped = Array.from(new Set(renamed));
      await cursor.update({ ...ex, tags: deduped });
      affected += 1;
    }
    cursor = await cursor.continue();
  }
  await tx.done;
  return affected;
}

/**
 * 指定した展覧会（id 群）に、指定タグをまとめて追加する（一括タグ追加）。
 * すでに同じタグを持つカードには重複追加しない。変更がない場合は書き込まない。
 */
export async function addTagsToExhibitions(
  ids: string[],
  tags: string[],
): Promise<void> {
  if (ids.length === 0 || tags.length === 0) return;
  const idSet = new Set(ids);
  const db = await getDB();
  const tx = db.transaction(EXHIBITIONS_STORE, 'readwrite');
  const store = tx.objectStore(EXHIBITIONS_STORE);
  let cursor = await store.openCursor();
  while (cursor) {
    const ex = cursor.value;
    if (idSet.has(ex.id)) {
      const merged = Array.from(new Set([...ex.tags, ...tags]));
      if (merged.length !== ex.tags.length) {
        await cursor.update({ ...ex, tags: merged });
      }
    }
    cursor = await cursor.continue();
  }
  await tx.done;
}

/** 既存データから使用済みタグの一覧を返す（候補表示用・仕様 §8）。 */
export function collectUsedTags(exhibitions: Exhibition[]): string[] {
  const set = new Set<string>();
  for (const ex of exhibitions) {
    for (const tag of ex.tags) set.add(tag);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export interface TagCount {
  tag: string;
  count: number;
}

/** 使用中タグと使用件数を、件数の多い順（同数はタグ名順）で返す。 */
export function collectTagCounts(exhibitions: Exhibition[]): TagCount[] {
  const map = new Map<string, number>();
  for (const ex of exhibitions) {
    for (const tag of ex.tags) {
      map.set(tag, (map.get(tag) ?? 0) + 1);
    }
  }
  return Array.from(map, ([tag, count]) => ({ tag, count })).sort(
    (a, b) => b.count - a.count || a.tag.localeCompare(b.tag),
  );
}
