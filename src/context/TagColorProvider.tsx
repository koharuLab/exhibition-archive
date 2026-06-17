// タグ色マップを読み込み、アプリ全体へ供給するプロバイダ。
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  loadTagColors,
  setTagColor,
  deleteTagColor,
  loadTagOrder,
  saveTagOrder,
} from '../db/tags';
import { TagColorContext } from './tagColorContext';

export function TagColorProvider({ children }: { children: ReactNode }) {
  const [colors, setColors] = useState<Record<string, string>>({});
  const [order, setOrderState] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    // 色・表示順の両方が揃ってから ready にする（初期表示のガタつき防止）
    Promise.all([loadTagColors(), loadTagOrder()]).then(([map, list]) => {
      if (!active) return;
      setColors(map);
      setOrderState(list);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const setColor = useCallback((name: string, color: string) => {
    setColors((prev) => ({ ...prev, [name]: color }));
    void setTagColor(name, color);
  }, []);

  const removeColor = useCallback((name: string) => {
    setColors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
    void deleteTagColor(name);
  }, []);

  const setOrder = useCallback((tags: string[]) => {
    setOrderState(tags);
    void saveTagOrder(tags);
  }, []);

  return (
    <TagColorContext.Provider value={{ ready, colors, setColor, removeColor, order, setOrder }}>
      {children}
    </TagColorContext.Provider>
  );
}
