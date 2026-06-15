# exhibition-archive

行った展覧会を記録する個人用 PWA。訪問年月・展覧会名・会場・タグ・チケット写真・URL を端末内（IndexedDB）に保存する。

## 機能

- 展覧会の一覧（グリッド/リスト切替）・詳細・追加・編集・削除
- チケット写真の登録（縮小圧縮して保存）・表示・差し替え・削除
- タグによる AND 絞り込み検索
- タグ管理（色設定・表示順変更）・一括タグ操作
- テーマ切替（ライト/ダーク）
- データのバックアップ（JSON エクスポート/インポート）
- 削除取り消し（Undo Toast）

## 技術スタック

- React + TypeScript + Vite
- IndexedDB（`idb` ライブラリ）
- browser-image-compression（写真縮小圧縮）

## 開発

```bash
npm install       # 依存インストール
npm run dev       # 開発サーバ起動
npm run build     # 本番ビルド
npm run preview   # ビルド成果物プレビュー
npm run lint      # ESLint
```

## データ保存

データはすべてブラウザの IndexedDB（`exhibition-records`）に保存される。端末をまたいだ自動同期は行わない。
メニュー→データ管理からバックアップ（JSON）の書き出し・読み込みが可能。
