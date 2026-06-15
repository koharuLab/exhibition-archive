// チケット写真の縮小・圧縮（仕様 §12 チケット写真仕様）。
import imageCompression from 'browser-image-compression';

/** 元画像の上限の目安（仕様 §12：10MB 程度） */
const MAX_ORIGINAL_BYTES = 10 * 1024 * 1024;
/** 保存後サイズの目安（仕様 §12：1MB 程度） */
const TARGET_MAX_MB = 1;
/** 長辺の目安（仕様 §12：1200px 程度） */
const MAX_WIDTH_OR_HEIGHT = 1200;

export interface CompressResult {
  blob: Blob;
  format: string;
  originalSize: number;
  compressedSize: number;
}

/**
 * 画像ファイルを検証し、縮小・圧縮する（仕様 §12 の保存手順 ①〜⑤）。
 * 画像以外・上限超過は Error を投げる（呼び出し側でメッセージ表示）。
 */
export async function compressTicketImage(file: File): Promise<CompressResult> {
  // ② 画像形式を確認する
  if (!file.type.startsWith('image/')) {
    throw new Error('画像ファイルを選択してください');
  }
  // ③ 元画像サイズを確認する
  if (file.size > MAX_ORIGINAL_BYTES) {
    throw new Error('画像が大きすぎます（10MB 以下にしてください）');
  }

  // ④ 縮小・圧縮する
  const compressed = await imageCompression(file, {
    maxSizeMB: TARGET_MAX_MB,
    maxWidthOrHeight: MAX_WIDTH_OR_HEIGHT,
    useWebWorker: true,
  });

  // ⑤ 保存後サイズを確認する（結果を呼び出し側へ返す）
  return {
    blob: compressed,
    format: compressed.type || file.type,
    originalSize: file.size,
    compressedSize: compressed.size,
  };
}

/** バイト数を読みやすい単位に整形する（プレビュー表示用）。 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
