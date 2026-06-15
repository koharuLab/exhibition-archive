// 一覧の展覧会表示（グリッド／リスト切替・仕様 §3）。
import type { Exhibition } from '../types';
import type { ViewMode } from '../hooks/useViewMode';
import { ExhibitionCard } from './ExhibitionCard';

interface ExhibitionGridProps {
  exhibitions: Exhibition[];
  viewMode: ViewMode;
  onOpen: (id: string) => void;
  onSelectTag: (tag: string) => void;
  /** 複数選択モード中か */
  selectionMode: boolean;
  /** 選択中のカード id */
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onLongPress: (id: string) => void;
}

export function ExhibitionGrid({
  exhibitions,
  viewMode,
  onOpen,
  onSelectTag,
  selectionMode,
  selectedIds,
  onToggleSelect,
  onLongPress,
}: ExhibitionGridProps) {
  if (exhibitions.length === 0) {
    // ここに来るのは絞り込み結果が0件のとき（全体が0件のときは App 側で案内を表示）
    return <p className="empty-state">該当する展覧会がありません。</p>;
  }
  return (
    <div className={viewMode === 'list' ? 'list' : 'grid'}>
      {exhibitions.map((ex) => (
        <ExhibitionCard
          key={ex.id}
          exhibition={ex}
          onOpen={onOpen}
          onSelectTag={onSelectTag}
          selectionMode={selectionMode}
          selected={selectedIds.includes(ex.id)}
          onToggleSelect={onToggleSelect}
          onLongPress={onLongPress}
        />
      ))}
    </div>
  );
}
