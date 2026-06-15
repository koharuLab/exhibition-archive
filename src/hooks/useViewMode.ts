// 一覧の表示形式（グリッド／リスト）。localStorage に永続化する。
import { useEffect, useState } from 'react';

export type ViewMode = 'grid' | 'list';

const STORAGE_KEY = 'viewMode';

function loadInitial(): ViewMode {
  return localStorage.getItem(STORAGE_KEY) === 'list' ? 'list' : 'grid';
}

export function useViewMode(): [ViewMode, (mode: ViewMode) => void] {
  const [viewMode, setViewMode] = useState<ViewMode>(loadInitial);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, viewMode);
  }, [viewMode]);

  return [viewMode, setViewMode];
}
