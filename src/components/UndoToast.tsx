// 削除直後に画面下部へ表示する取り消し通知。
// 表示時間の管理（5秒）は親（App）が行い、本コンポーネントは表示のみ担う。
// 下端のゲージが durationMs かけて縮み、残り時間を視覚的に示す。
interface UndoToastProps {
  message: string;
  durationMs: number;
  onUndo: () => void;
}

export function UndoToast({ message, durationMs, onUndo }: UndoToastProps) {
  return (
    <div className="undo-toast" role="status" aria-live="polite">
      <span className="undo-toast-msg">{message}</span>
      <button type="button" className="undo-toast-btn" onClick={onUndo}>
        元に戻す
      </button>
      <span
        className="undo-toast-gauge"
        style={{ animationDuration: `${durationMs}ms` }}
        aria-hidden="true"
      />
    </div>
  );
}
