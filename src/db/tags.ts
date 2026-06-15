// タグ色・表示順の永続化操作。
import { getDB, TAG_COLORS_STORE, TAG_ORDER_STORE } from './database';

/** タグ表示順レコードの固定キー（順序は単一レコードで保持）。 */
const TAG_ORDER_KEY = 'order';

/** 保存済みのタグ色をすべて読み込み、{ タグ名: 色キー } で返す。 */
export async function loadTagColors(): Promise<Record<string, string>> {
  const db = await getDB();
  const all = await db.getAll(TAG_COLORS_STORE);
  const map: Record<string, string> = {};
  for (const record of all) {
    map[record.name] = record.color;
  }
  return map;
}

/** タグに色を割り当てる（既存があれば上書き）。 */
export async function setTagColor(name: string, color: string): Promise<void> {
  const db = await getDB();
  await db.put(TAG_COLORS_STORE, { name, color });
}

/** タグの色割り当てを削除する（タグ削除時の掃除）。 */
export async function deleteTagColor(name: string): Promise<void> {
  const db = await getDB();
  await db.delete(TAG_COLORS_STORE, name);
}

/** 保存済みのタグ表示順（タグ名の配列）を返す。未保存なら空配列。 */
export async function loadTagOrder(): Promise<string[]> {
  const db = await getDB();
  const record = await db.get(TAG_ORDER_STORE, TAG_ORDER_KEY);
  return record?.tags ?? [];
}

/** タグ表示順を保存する（表示順に並んだタグ名の配列）。 */
export async function saveTagOrder(tags: string[]): Promise<void> {
  const db = await getDB();
  await db.put(TAG_ORDER_STORE, { id: TAG_ORDER_KEY, tags });
}
