// 日付ユーティリティ（仕様 §10 日付仕様）
// 入力: "YYYY/MM" または "YYYY-MM" / 内部保存: "YYYY-MM" / 表示: "YYYY/MM"

const INPUT_RE = /^(\d{4})[/-](\d{1,2})$/;
const INTERNAL_RE = /^(\d{4})-(\d{2})$/;

/**
 * 入力文字列を内部保存形式 "YYYY-MM" に正規化する。
 * 不正な形式・存在しない月の場合は null を返す。
 */
export function parseToInternal(input: string): string | null {
  const m = input.trim().match(INPUT_RE);
  if (!m) return null;
  const year = m[1];
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** 内部形式 "YYYY-MM" を表示用 "YYYY/MM" に変換する。 */
export function formatForDisplay(internal: string): string {
  const m = internal.match(INTERNAL_RE);
  if (!m) return internal;
  return `${m[1]}/${m[2]}`;
}
