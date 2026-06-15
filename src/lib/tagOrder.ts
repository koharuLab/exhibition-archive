// タグの表示順ユーティリティ。
// 保存された順序リスト(order)に従って並べ替える。
// order に無いタグ（新規など）は元の相対順を保ったまま末尾に残す。

/** order の並びに従って items を安定ソートする。order に無いキーは元の順序のまま後ろに置く。 */
export function sortByTagOrder<T>(
  items: T[],
  keyOf: (item: T) => string,
  order: string[],
): T[] {
  const rank = new Map(order.map((name, i) => [name, i] as const));
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const ra = rank.get(keyOf(a.item));
      const rb = rank.get(keyOf(b.item));
      if (ra !== undefined && rb !== undefined) return ra - rb;
      if (ra !== undefined) return -1; // a だけ登録済み → a を前へ
      if (rb !== undefined) return 1; // b だけ登録済み → b を前へ
      return a.index - b.index; // どちらも未登録 → 元の順序を維持
    })
    .map((x) => x.item);
}

/** 文字列のタグ配列を order に従って並べ替える簡易版。 */
export function sortTagsByOrder(tags: string[], order: string[]): string[] {
  return sortByTagOrder(tags, (t) => t, order);
}
