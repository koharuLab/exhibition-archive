// タグ色コンテキストの定義とフック（コンポーネントは TagColorProvider.tsx）。
import { createContext, useContext } from 'react';

export interface TagColorContextValue {
  /** タグ名 -> 色キー */
  colors: Record<string, string>;
  /** タグに色を割り当てて永続化する */
  setColor: (name: string, color: string) => void;
  /** タグの色割り当てを削除する（タグ削除時） */
  removeColor: (name: string) => void;
  /** タグの表示順（タグ名の配列）。 */
  order: string[];
  /** タグの表示順を更新して永続化する */
  setOrder: (tags: string[]) => void;
}

export const TagColorContext = createContext<TagColorContextValue>({
  colors: {},
  setColor: () => {},
  removeColor: () => {},
  order: [],
  setOrder: () => {},
});

export function useTagColors(): TagColorContextValue {
  return useContext(TagColorContext);
}
