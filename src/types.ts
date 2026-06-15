// ドメイン型定義（仕様 §13 データ項目）

/** 展覧会データ。画像本体は含めず ticketPhotoId で TicketPhoto を参照する。 */
export interface Exhibition {
  id: string;
  /** 展覧会名（必須・trim 済み） */
  name: string;
  /** 訪問年月。内部保存形式は "YYYY-MM"（必須） */
  visitYearMonth: string;
  /** 会場名（任意・未登録なら undefined） */
  venue?: string;
  /** 展覧会サイト URL（任意） */
  url?: string;
  /** チケット写真への参照 ID（任意・Phase 2） */
  ticketPhotoId?: string;
  /** タグ一覧（trim 済み・重複なし） */
  tags: string[];
  /** 作成日時（epoch ms） */
  createdAt: number;
  /** 更新日時（epoch ms） */
  updatedAt: number;
}

/** チケット写真データ。展覧会データとは別 store で管理する（仕様 §14）。 */
export interface TicketPhoto {
  id: string;
  /** 画像本体 */
  blob: Blob;
  /** 画像形式（MIME type 等） */
  format: string;
  /** ファイルサイズ（bytes） */
  fileSize: number;
  createdAt: number;
}

/**
 * フォームでのチケット写真の操作意図（Phase 2）。
 * - keep:    既存の写真を維持（変更なし）
 * - replace: 新しい画像で登録・差し替え
 * - remove:  写真を削除
 */
export type PhotoIntent =
  | { kind: 'keep' }
  | { kind: 'replace'; blob: Blob; format: string }
  | { kind: 'remove' };

/** 追加・編集フォームの入力値（生の文字列。保存前に検証・正規化する）。 */
export interface ExhibitionFormInput {
  name: string;
  /** "YYYY/MM" または "YYYY-MM" を受け付ける */
  visitYearMonth: string;
  venue: string;
  url: string;
  tags: string[];
}
