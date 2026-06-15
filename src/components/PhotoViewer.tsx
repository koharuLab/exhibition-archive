// チケット写真表示（仕様 §5「チケット写真を見る」/§12）。
import { usePhotoUrl } from '../hooks/usePhotoUrl';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface PhotoViewerProps {
  photoId: string;
  onClose: () => void;
}

export function PhotoViewer({ photoId, onClose }: PhotoViewerProps) {
  // 写真の読み込み・URL 解放はフックに委ねる（usePhotoUrl と重複実装しない）
  const url = usePhotoUrl(photoId);

  useEscapeKey(onClose);

  return (
    <div className="viewer-overlay" onClick={onClose}>
      <button type="button" className="viewer-close" aria-label="閉じる">
        ✕
      </button>
      {url && <img className="viewer-img" src={url} alt="カード画像" onClick={(e) => e.stopPropagation()} />}
    </div>
  );
}
