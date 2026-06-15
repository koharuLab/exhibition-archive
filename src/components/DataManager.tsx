// データ管理モーダル（バックアップの書き出し／読み込み）。
// 一覧画面に重ねて表示する。インポートは確認ダイアログを挟み、完了後にページを更新する。
import { useRef, useState } from 'react';
import { exportData, importData, isValidBackup, type BackupData } from '../db/backup';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface DataManagerProps {
  onClose: () => void;
}

/** YYYYMMDD 形式の今日の日付。 */
function todayStamp(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}${mm}${dd}`;
}

export function DataManager({ onClose }: DataManagerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [pendingImport, setPendingImport] = useState<BackupData | null>(null);
  const [busy, setBusy] = useState(false);

  useEscapeKey(() => {
    if (busy) return;
    if (pendingImport) setPendingImport(null);
    else onClose();
  });

  // バックアップを書き出す
  const handleExport = async () => {
    setError('');
    try {
      const data = await exportData();
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `exhibition-record-backup-${todayStamp()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('バックアップの書き出しに失敗しました');
    }
  };

  // ファイル選択 → 解析・検証 → 確認ダイアログ
  const handleFile = async (file: File | undefined) => {
    setError('');
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    try {
      const data: unknown = JSON.parse(await file.text());
      if (!isValidBackup(data)) {
        setError('対応していないファイル形式です。バックアップファイルを選んでください。');
        return;
      }
      setPendingImport(data);
    } catch {
      setError('ファイルを読み込めませんでした（JSON として不正です）。');
    }
  };

  // 読み込み確定：置き換え後にページを更新して全データ・設定を反映
  const confirmImport = async () => {
    if (!pendingImport) return;
    setBusy(true);
    try {
      await importData(pendingImport);
      location.reload();
    } catch (e) {
      setBusy(false);
      setPendingImport(null);
      setError(e instanceof Error ? e.message : 'バックアップの読み込みに失敗しました');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="データ管理"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2>データ管理</h2>
          <button type="button" className="icon-btn" aria-label="閉じる" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="modal-body">
          <p className="data-desc">
            バックアップを書き出して別の端末で読み込むことができます。
          </p>

          <div className="data-section">
            <button type="button" className="action-btn primary-btn" onClick={handleExport}>
              バックアップを書き出す
            </button>
            <p className="data-note">
              展覧会データ・カード画像・タグ設定・タグ表示順を JSON ファイルに保存します。
            </p>
          </div>

          <div className="data-section">
            <button
              type="button"
              className="action-btn primary-btn"
              onClick={() => fileRef.current?.click()}
            >
              バックアップを読み込む
            </button>
            <p className="data-note">
              選んだバックアップで現在のデータを置き換えます。
            </p>
          </div>

          {error && <p className="field-error data-error">{error}</p>}

          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>
      </div>

      {/* 読み込み確認ダイアログ */}
      {pendingImport && (
        <div
          className="confirm-overlay"
          onClick={(e) => {
            e.stopPropagation();
            if (!busy) setPendingImport(null);
          }}
        >
          <div
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-label="バックアップ読み込みの確認"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="confirm-title">バックアップを読み込みますか？</h3>
            <p className="confirm-text">
              現在のデータは置き換えられます。
              <br />
              この操作は取り消せません。
            </p>
            <div className="confirm-actions">
              <button
                type="button"
                className="confirm-cancel"
                disabled={busy}
                onClick={() => setPendingImport(null)}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="confirm-primary"
                disabled={busy}
                onClick={confirmImport}
              >
                読み込む
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
