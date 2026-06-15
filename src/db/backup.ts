// データ管理（バックアップの書き出し／読み込み）。
// 4つの object store（exhibitions / ticketPhotos / tagColors / tagOrder）を
// 1 つの JSON にまとめる（表示設定は対象外）。
import type { Exhibition, TicketPhoto } from '../types';
import {
  getDB,
  EXHIBITIONS_STORE,
  TICKET_PHOTOS_STORE,
  TAG_COLORS_STORE,
  TAG_ORDER_STORE,
  type TagColorRecord,
  type TagOrderRecord,
} from './database';

/** バックアップ内の写真（Blob は Base64 文字列で保持）。 */
interface BackupPhoto {
  id: string;
  format: string;
  fileSize: number;
  createdAt: number;
  data: string; // Base64
}

/** バックアップ JSON の構造。 */
export interface BackupData {
  app: 'exhibition-record';
  version: number;
  exportedAt: string;
  exhibitions: Exhibition[];
  tagColors: TagColorRecord[];
  tagOrder: TagOrderRecord[];
  photos: BackupPhoto[];
}

const APP_ID = 'exhibition-record';
const BACKUP_VERSION = 1;

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToBlob(base64: string, type: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** 全データを 1 つの JSON 構造にまとめて返す。 */
export async function exportData(): Promise<BackupData> {
  const db = await getDB();
  const exhibitions = await db.getAll(EXHIBITIONS_STORE);
  const tagColors = await db.getAll(TAG_COLORS_STORE);
  const tagOrder = await db.getAll(TAG_ORDER_STORE);
  const rawPhotos = await db.getAll(TICKET_PHOTOS_STORE);
  const photos: BackupPhoto[] = await Promise.all(
    rawPhotos.map(async (p) => ({
      id: p.id,
      format: p.format,
      fileSize: p.fileSize,
      createdAt: p.createdAt,
      data: await blobToBase64(p.blob),
    })),
  );

  return {
    app: APP_ID,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    exhibitions,
    tagColors,
    tagOrder,
    photos,
  };
}

/** 読み込んだオブジェクトがバックアップ形式として妥当か判定する。 */
export function isValidBackup(data: unknown): data is BackupData {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    d.app === APP_ID &&
    Array.isArray(d.exhibitions) &&
    Array.isArray(d.photos) &&
    Array.isArray(d.tagColors) &&
    Array.isArray(d.tagOrder)
  );
}

/**
 * バックアップで現在のデータを置き換える（全クリア → 書き戻し）。
 * 4ストアは 1 トランザクションで原子的に更新する（表示設定は対象外）。
 */
export async function importData(data: BackupData): Promise<void> {
  if (!isValidBackup(data)) {
    throw new Error('バックアップファイルの形式が正しくありません');
  }
  const db = await getDB();
  const tx = db.transaction(
    [EXHIBITIONS_STORE, TICKET_PHOTOS_STORE, TAG_COLORS_STORE, TAG_ORDER_STORE],
    'readwrite',
  );

  const exStore = tx.objectStore(EXHIBITIONS_STORE);
  await exStore.clear();
  for (const ex of data.exhibitions) await exStore.put(ex);

  const photoStore = tx.objectStore(TICKET_PHOTOS_STORE);
  await photoStore.clear();
  for (const p of data.photos) {
    const photo: TicketPhoto = {
      id: p.id,
      blob: base64ToBlob(p.data, p.format),
      format: p.format,
      fileSize: p.fileSize,
      createdAt: p.createdAt,
    };
    await photoStore.put(photo);
  }

  const colorStore = tx.objectStore(TAG_COLORS_STORE);
  await colorStore.clear();
  for (const c of data.tagColors) await colorStore.put(c);

  const orderStore = tx.objectStore(TAG_ORDER_STORE);
  await orderStore.clear();
  for (const o of data.tagOrder) await orderStore.put(o);

  await tx.done;
}
