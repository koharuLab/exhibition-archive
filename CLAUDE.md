# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> ベースの作業方針（日本語で回答、結論先出し、削除や外部送信は事前確認 等）はユーザーのグローバル `~/.claude/CLAUDE.md` に従う。本ファイルはこのプロジェクト固有の情報のみを記載する。

## プロジェクト概要

行った展覧会を「訪問年月・展覧会名・タグ・参照情報」で記録する**個人用 PWA**。
メイン画面で登録済み展覧会を訪問年月の新しい順に2列グリッドで表示する。
完全な仕様は [project.txt](project.txt) を参照（これが唯一の信頼できる仕様源）。

- 技術スタック: **React + TypeScript + Vite + IndexedDB (PWA)**
- データは**端末内（IndexedDB）のみ**に保存。複数端末間の自動同期は行わない。

## 現在の状態

**Phase 1・2 とも実装済み**。加えてグリッド/リスト切替・テーマ切替・タグ管理（色設定・表示順変更）・一括タグ操作・バックアップ（JSON エクスポート/インポート）・削除 Undo も実装済み。

ディレクトリ構成:
- [src/types.ts](src/types.ts) — ドメイン型・`PhotoIntent`
- [src/lib/](src/lib/) — `date.ts`（年月変換）/ `validation.ts`（入力チェック）/ `image.ts`（画像縮小・圧縮 via browser-image-compression）/ `tagColors.ts`（12色パレット定義）/ `tagOrder.ts`（タグ並び順ユーティリティ）
- [src/db/](src/db/) — `database.ts`（idb スキーマ・**v3・4 store**）/ `exhibitions.ts`（CRUD・並び替え・タグ収集）/ `photos.ts`（写真 CRUD・`resolvePhotoIntent`）/ `tags.ts`（タグ色の読込・保存）/ `backup.ts`（全データの JSON エクスポート・インポート）
- [src/hooks/](src/hooks/) — `useExhibitions.ts`（データ読込・操作・タグ AND フィルタ）/ `useViewMode.ts`（グリッド/リスト切替・localStorage 永続化）/ `useTheme.ts`（テーマ切替）/ `usePhotoUrl.ts`（写真 URL 生成）/ `useTagOperations.ts`（タグ操作）/ `useEscapeKey.ts`（Escape キーフック）
- [src/context/](src/context/) — `tagColorContext.ts`（Context＋`useTagColors`）/ `TagColorProvider.tsx`（色マップを読込・供給）。Provider は [main.tsx](src/main.tsx) で全体をラップ。
- [src/components/](src/components/) — `BottomSheet`（追加/編集シート共有）/ `ExhibitionGrid`（一覧）/ `ExhibitionCard`（カード）/ `ExhibitionDetail`（詳細）/ `ExhibitionFormSheet`（追加/編集フォーム）/ `PhotoField`・`PhotoViewer`（写真）/ `TagChip`（タグ表示）/ `TagFilterBar`（タグ絞り込みバー）/ `TagInput`（タグ入力）/ `TagManager`（タグ管理）/ `BulkTagSheet`（一括タグ操作）/ `AppMenu`（ハンバーガーメニュー）/ `DisplaySettings`（表示設定）/ `DataManager`（データ管理）/ `UndoToast`（削除取り消し）
- [src/App.tsx](src/App.tsx) — 画面遷移・タグ絞り込み・シート表示・写真意図の解決を統括（ルータ未使用、状態で list/detail を切替。シートは open 中のみマウントしフォーム状態を初期化）

### 写真の保存フロー（重要）
フォームは写真本体を直接保存せず `PhotoIntent`（keep/replace/remove）を親へ通知する。保存時に [App.tsx](src/App.tsx) が `resolvePhotoIntent` を呼び、replace なら新写真を保存して旧写真を削除、remove なら削除し、確定した `ticketPhotoId` を展覧会データへ書き込む。展覧会削除時は `deleteExhibition` が紐づく写真もトランザクションで削除する。

## コマンド

```bash
npm install            # 依存インストール
npm run dev            # Vite 開発サーバ
npm run build          # 本番ビルド
npm run preview        # ビルド成果物のプレビュー
npm run lint           # ESLint
```

## ドメインモデル（IndexedDB 設計）

4つの object store で管理する（DB v3）。**展覧会データに画像本体を直接含めず、`ticketPhotoId` で写真を参照する**（一覧表示時に重い画像を読まないため）。

- `exhibitions` / `ticketPhotos` / `tagColors`（タグ名 → 色キー）/ `tagOrder`（タグ表示順）
- **タグ色はタグ名ごとに共通**（展覧会データには持たせない）。色キーは [src/lib/tagColors.ts](src/lib/tagColors.ts) の 12 色パレットの key。表示は `TagChip` が `useTagColors()` で色を引き当てる。

**Exhibition（展覧会データ）**
`id` / `name`(展覧会名) / `visitYearMonth`(訪問年月, **内部は `YYYY-MM`**) / `venue`(会場名) / `url` / `ticketPhotoId` / `tags[]` / `createdAt` / `updatedAt`

**TicketPhoto（チケット写真データ）**
`id` / 画像本体(Blob) / `format` / `fileSize` / `createdAt`

- 展覧会削除時は、紐づくチケット写真データも併せて削除する。
- 1展覧会につきチケット写真は**1枚まで**。

## 仕様上の重要ルール（実装時に外しやすい点）

- **日付**: 入力は `YYYY/MM`、内部保存は `YYYY-MM`、表示は `YYYY/MM`。訪問年月は必須で、不正形式は保存しない。`YYYY/MM`・`YYYY-MM` 両方を受け付け内部で `YYYY-MM` に統一。
- **並び順**: 訪問年月の新しい順。同一年月は登録順／更新順。
- **タグ AND 検索**: 選択中タグは累積し、**すべて**を含む展覧会のみ表示。複数選択可・個別解除・一括解除を用意。追加/編集フォームでは過去使用タグを候補表示。同一展覧会内の重複タグは1つにまとめる。
- **カード内タグ押下**: タグ押下時はカード本体の詳細遷移を**発火させない**（イベント伝播を止める）。
- **一覧での URL / チケット写真**: 本体は表示せず、**登録状態を示すアイコンのみ**表示。
- **追加シートと編集シートは同一フォーム構造を共有**できるよう設計する。
- **入力チェック**: 展覧会名は必須（前後空白除去、空欄不可）。会場名・URL・タグ・写真は任意（空白除去、空は未登録扱い）。URL は入力時のみ形式確認。

## チケット写真の保存パイプライン

保存前に必ず縮小・圧縮する。順序: ①ファイル選択 → ②形式確認 → ③元サイズ確認 → ④縮小・圧縮 → ⑤保存後サイズ確認 → ⑥端末内保存。
目安: 元画像上限 ~10MB / 保存後 ~1MB / 長辺 ~1200px。画像ファイルのみ受け付ける。

## 画面構成

一覧画面（起動時メイン）/ 詳細画面 / 追加シート（下から表示）/ 編集シート / チケット写真表示。
追加シートは一覧右下の丸い追加ボタンから、編集シートは詳細画面の編集ボタンから開く。
