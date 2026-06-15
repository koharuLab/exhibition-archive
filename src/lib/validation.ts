// 入力チェック・正規化（仕様 §15 入力チェック仕様）
import type { Exhibition, ExhibitionFormInput } from '../types';
import { parseToInternal } from './date';

export interface ValidationResult {
  /** 検証・正規化に成功した場合の保存用フィールド */
  value?: Pick<Exhibition, 'name' | 'visitYearMonth' | 'venue' | 'url' | 'tags'>;
  /** フィールド名 -> エラーメッセージ */
  errors: Partial<Record<'name' | 'visitYearMonth' | 'url', string>>;
}

/** タグ配列を正規化する：trim・空文字除去・重複統合（順序は保持）。 */
function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const t = raw.trim();
    if (t === '' || seen.has(t)) continue;
    seen.add(t);
    result.push(t);
  }
  return result;
}

function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** フォーム入力を検証し、保存用に正規化する。 */
export function validateForm(input: ExhibitionFormInput): ValidationResult {
  const errors: ValidationResult['errors'] = {};

  // 展覧会名：必須・trim
  const name = input.name.trim();
  if (name === '') {
    errors.name = '展覧会名は必須です';
  }

  // 訪問年月：必須・形式チェック・内部形式へ統一
  const visitYearMonth = parseToInternal(input.visitYearMonth);
  if (visitYearMonth === null) {
    errors.visitYearMonth = '訪問年月は YYYY/MM 形式で入力してください';
  }

  // 会場名：任意・trim・空は未登録扱い
  const venueTrimmed = input.venue.trim();
  const venue = venueTrimmed === '' ? undefined : venueTrimmed;

  // URL：任意・入力時のみ形式チェック
  const urlTrimmed = input.url.trim();
  let url: string | undefined;
  if (urlTrimmed !== '') {
    if (!isValidUrl(urlTrimmed)) {
      errors.url = 'URL の形式が正しくありません';
    } else {
      url = urlTrimmed;
    }
  }

  // タグ：任意・正規化
  const tags = normalizeTags(input.tags);

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return {
    errors: {},
    value: { name, visitYearMonth: visitYearMonth!, venue, url, tags },
  };
}
