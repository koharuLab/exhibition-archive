// チケット写真データの永続化操作（仕様 §12/§14）。
import type { TicketPhoto } from '../types';
import { getDB, TICKET_PHOTOS_STORE } from './database';

/** 写真を保存し、生成した ID を返す（⑥ 端末内に保存する）。 */
export async function savePhoto(blob: Blob, format: string): Promise<string> {
  const photo: TicketPhoto = {
    id: crypto.randomUUID(),
    blob,
    format,
    fileSize: blob.size,
    createdAt: Date.now(),
  };
  const db = await getDB();
  await db.put(TICKET_PHOTOS_STORE, photo);
  return photo.id;
}

export async function getPhoto(id: string): Promise<TicketPhoto | undefined> {
  const db = await getDB();
  return db.get(TICKET_PHOTOS_STORE, id);
}

export async function deletePhoto(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(TICKET_PHOTOS_STORE, id);
}

/** 削除の取り消し用：写真レコードをそのまま（同じ id で）書き戻す。 */
export async function restorePhoto(photo: TicketPhoto): Promise<void> {
  const db = await getDB();
  await db.put(TICKET_PHOTOS_STORE, photo);
}

/**
 * フォームの写真操作意図を反映し、最終的な ticketPhotoId を返す。
 * replace 時は旧写真を削除して差し替え、remove 時は削除する。
 */
export async function resolvePhotoIntent(
  prevPhotoId: string | undefined,
  intent: import('../types').PhotoIntent,
): Promise<string | undefined> {
  switch (intent.kind) {
    case 'keep':
      return prevPhotoId;
    case 'replace': {
      const newId = await savePhoto(intent.blob, intent.format);
      if (prevPhotoId) await deletePhoto(prevPhotoId);
      return newId;
    }
    case 'remove':
      if (prevPhotoId) await deletePhoto(prevPhotoId);
      return undefined;
  }
}
