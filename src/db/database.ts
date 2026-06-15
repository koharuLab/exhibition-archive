// IndexedDB セットアップ（仕様 §14 保存仕様）
// 展覧会データとチケット写真データを別 store で管理する。
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Exhibition, TicketPhoto } from '../types';

const DB_NAME = 'exhibition-records';
const DB_VERSION = 3;

export const EXHIBITIONS_STORE = 'exhibitions';
export const TICKET_PHOTOS_STORE = 'ticketPhotos';
export const TAG_COLORS_STORE = 'tagColors';
export const TAG_ORDER_STORE = 'tagOrder';

/** タグ名ごとの色割り当て（タグ名をキーに保存）。 */
export interface TagColorRecord {
  name: string;
  color: string;
}

/** タグの表示順（単一レコードで保持。tags は表示順に並んだタグ名）。 */
export interface TagOrderRecord {
  id: string;
  tags: string[];
}

interface ExhibitionDB extends DBSchema {
  [EXHIBITIONS_STORE]: {
    key: string;
    value: Exhibition;
    indexes: { visitYearMonth: string };
  };
  [TICKET_PHOTOS_STORE]: {
    key: string;
    value: TicketPhoto;
  };
  [TAG_COLORS_STORE]: {
    key: string;
    value: TagColorRecord;
  };
  [TAG_ORDER_STORE]: {
    key: string;
    value: TagOrderRecord;
  };
}

let dbPromise: Promise<IDBPDatabase<ExhibitionDB>> | null = null;

/** DB 接続を取得する（初回にスキーマを作成）。 */
export function getDB(): Promise<IDBPDatabase<ExhibitionDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ExhibitionDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(EXHIBITIONS_STORE)) {
          const store = db.createObjectStore(EXHIBITIONS_STORE, { keyPath: 'id' });
          store.createIndex('visitYearMonth', 'visitYearMonth');
        }
        if (!db.objectStoreNames.contains(TICKET_PHOTOS_STORE)) {
          db.createObjectStore(TICKET_PHOTOS_STORE, { keyPath: 'id' });
        }
        // v2: タグ色ストア
        if (!db.objectStoreNames.contains(TAG_COLORS_STORE)) {
          db.createObjectStore(TAG_COLORS_STORE, { keyPath: 'name' });
        }
        // v3: タグ表示順ストア
        if (!db.objectStoreNames.contains(TAG_ORDER_STORE)) {
          db.createObjectStore(TAG_ORDER_STORE, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}
