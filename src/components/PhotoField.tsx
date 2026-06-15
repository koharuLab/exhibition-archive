// チケット写真の選択・差し替え・削除（仕様 §7/§12）。
import { useEffect, useRef, useState } from 'react';
import type { PhotoIntent } from '../types';
import { compressTicketImage, formatBytes } from '../lib/image';
import { getPhoto } from '../db/photos';

interface PhotoFieldProps {
  /** 編集時の既存写真 ID（新規追加時は undefined） */
  existingPhotoId?: string;
  /** 写真操作意図の変化を親フォームへ通知する */
  onIntentChange: (intent: PhotoIntent) => void;
}

export function PhotoField({ existingPhotoId, onIntentChange }: PhotoFieldProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'compressing' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  // プレビュー用 URL を差し替え、古い URL は解放する
  const setPreview = (url: string | null) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = url;
    setPreviewUrl(url);
  };

  // 既存写真の読み込み
  useEffect(() => {
    let active = true;
    if (existingPhotoId) {
      getPhoto(existingPhotoId).then((photo) => {
        if (active && photo) setPreview(URL.createObjectURL(photo.blob));
      });
    }
    return () => {
      active = false;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [existingPhotoId]);

  const handleSelect = async (file: File | undefined) => {
    if (!file) return;
    setStatus('compressing');
    setMessage('画像を処理しています...');
    try {
      const result = await compressTicketImage(file);
      setPreview(URL.createObjectURL(result.blob));
      setMessage(
        `${formatBytes(result.originalSize)} → ${formatBytes(result.compressedSize)} に圧縮`,
      );
      setStatus('idle');
      onIntentChange({ kind: 'replace', blob: result.blob, format: result.format });
    } catch (e) {
      setStatus('error');
      setMessage(e instanceof Error ? e.message : '画像の処理に失敗しました');
    }
  };

  const handleRemove = () => {
    setPreview(null);
    setMessage('');
    setStatus('idle');
    if (fileInputRef.current) fileInputRef.current.value = '';
    onIntentChange({ kind: 'remove' });
  };

  // 貼り付け対応：常に最新の handleSelect を ref 経由で参照する
  const handleSelectRef = useRef(handleSelect);
  useEffect(() => {
    handleSelectRef.current = handleSelect;
  });

  // クリップボードからの画像貼り付け（Ctrl+V）を受け付ける
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            void handleSelectRef.current(file);
          }
          return;
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  return (
    <div className="photo-field">
      {previewUrl ? (
        <div className="photo-preview">
          <img src={previewUrl} alt="カード画像プレビュー" />
        </div>
      ) : (
        <div className="photo-placeholder">未登録</div>
      )}

      <div className="photo-actions">
        <button
          type="button"
          className="photo-btn"
          disabled={status === 'compressing'}
          onClick={() => fileInputRef.current?.click()}
        >
          {previewUrl ? '変更' : '画像を選択'}
        </button>
        {previewUrl && (
          <button type="button" className="photo-btn danger" onClick={handleRemove}>
            削除
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => handleSelect(e.target.files?.[0])}
      />

      {message && (
        <span className={status === 'error' ? 'field-error' : 'photo-info'}>{message}</span>
      )}
    </div>
  );
}
