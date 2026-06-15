// 写真IDから表示用のオブジェクトURLを生成するフック。
// IDの変更・アンマウント時に古いURLを解放する。ID未指定なら null。
import { useEffect, useState } from 'react';
import { getPhoto } from '../db/photos';

export function usePhotoUrl(photoId: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!photoId) return;
    let active = true;
    let objectUrl: string | null = null;
    getPhoto(photoId).then((photo) => {
      if (active && photo) {
        objectUrl = URL.createObjectURL(photo.blob);
        setUrl(objectUrl);
      }
    });
    // ID 変更・アンマウント時に古い URL を解放し表示をクリアする
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [photoId]);

  return url;
}
