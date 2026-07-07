// The responsive widget grid. A 4-column CSS grid on desktop (2 on tablet, 1 on
// mobile); each widget spans `w` columns. Reordering is native HTML5 drag-and-
// drop — the frame is the drag source, and dropping onto another frame asks the
// parent to move the dragged widget in front of it.
import { useState } from 'react';
import type { DashboardWidget } from './types';
import { WidgetFrame } from './WidgetFrame';
import type { WidgetRenderCtx } from './widgets';

interface Props {
  widgets: DashboardWidget[];
  editing: boolean;
  ctx: WidgetRenderCtx;
  gap: number;
  onReorder: (draggedId: string, targetId: string) => void;
  onResizeW: (id: string, dir: -1 | 1) => void;
  onResizeH: (id: string) => void;
  onSettings: (id: string) => void;
  onToggleHide: (id: string) => void;
  onRemove: (id: string) => void;
}

export function DashboardGrid({ widgets, editing, ctx, gap, onReorder, onResizeW, onResizeH, onSettings, onToggleHide, onRemove }: Props) {
  const [dragged, setDragged] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  // In view mode, hidden widgets are dropped entirely; in edit mode they show dimmed.
  const visible = editing ? widgets : widgets.filter(w => !w.hidden);

  if (visible.length === 0) {
    return <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-sm text-slate-400">No widgets{editing ? '' : ' — turn on Customize to add some'}.</div>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap }}>
      {visible.map(w => (
        <WidgetFrame
          key={w.id}
          widget={w}
          editing={editing}
          ctx={ctx}
          dragOver={over === w.id && dragged !== w.id}
          onResizeW={onResizeW}
          onResizeH={onResizeH}
          onSettings={onSettings}
          onToggleHide={onToggleHide}
          onRemove={onRemove}
          onDragStart={setDragged}
          onDragEnterWidget={id => setOver(id)}
          onDrop={targetId => { if (dragged && dragged !== targetId) onReorder(dragged, targetId); setDragged(null); setOver(null); }}
          onDragEnd={() => { setDragged(null); setOver(null); }}
        />
      ))}
    </div>
  );
}
