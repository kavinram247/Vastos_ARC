// One widget shell: title + (in edit mode) a toolbar to drag / resize / configure
// / hide / remove, wrapping the registry-provided visualization. Reorder is
// native HTML5 drag-and-drop; the parent grid owns the widgets array.
import { GripVertical, Settings2, EyeOff, Eye, Trash2, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';
import type { DashboardWidget } from './types';
import { WIDGET_REGISTRY, widgetTitle, type WidgetRenderCtx } from './widgets';
import { cn } from '../../utils/cn';

const H_CLASS = { sm: 'min-h-[104px]', md: 'min-h-[228px]', lg: 'min-h-[320px]' };

interface Props {
  widget: DashboardWidget;
  editing: boolean;
  ctx: WidgetRenderCtx;
  dragOver: boolean;
  onResizeW: (id: string, dir: -1 | 1) => void;
  onResizeH: (id: string) => void;
  onSettings: (id: string) => void;
  onToggleHide: (id: string) => void;
  onRemove: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragEnterWidget: (id: string) => void;
  onDrop: (id: string) => void;
  onDragEnd: () => void;
}

export function WidgetFrame({
  widget, editing, ctx, dragOver, onResizeW, onResizeH, onSettings, onToggleHide, onRemove,
  onDragStart, onDragEnterWidget, onDrop, onDragEnd,
}: Props) {
  const def = WIDGET_REGISTRY[widget.type];
  const hasChartChoice = def.chartTypes.length > 0;
  const dim = widget.hidden ? 'opacity-45' : '';

  return (
    <div
      style={{ gridColumn: `span ${widget.w}`, background: 'var(--dash-widget)', borderColor: 'var(--dash-border)', borderRadius: 'var(--dash-radius)' }}
      className={cn('dash-widget group relative flex flex-col border shadow-[0_1px_2px_rgba(16,32,26,0.05)] transition-all',
        dragOver && 'ring-2 ring-indigo-400 ring-offset-2', dim)}
      draggable={editing}
      onDragStart={e => { if (editing) { e.dataTransfer.effectAllowed = 'move'; onDragStart(widget.id); } }}
      onDragEnter={() => editing && onDragEnterWidget(widget.id)}
      onDragOver={e => { if (editing) e.preventDefault(); }}
      onDrop={e => { if (editing) { e.preventDefault(); onDrop(widget.id); } }}
      onDragEnd={onDragEnd}
    >
      {/* header */}
      <div className="flex items-center gap-1.5 border-b border-slate-100 px-3 py-2">
        {editing && <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-slate-300 active:cursor-grabbing" />}
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700">{widgetTitle(widget)}</span>
        {editing && (
          <div className="flex items-center gap-0.5">
            <IconBtn title="Narrower" disabled={widget.w <= 1} onClick={() => onResizeW(widget.id, -1)}><ChevronLeft className="h-3.5 w-3.5" /></IconBtn>
            <IconBtn title="Wider" disabled={widget.w >= 4} onClick={() => onResizeW(widget.id, 1)}><ChevronRight className="h-3.5 w-3.5" /></IconBtn>
            <IconBtn title="Cycle height" onClick={() => onResizeH(widget.id)}><Maximize2 className="h-3.5 w-3.5" /></IconBtn>
            {hasChartChoice && <IconBtn title="Configure" onClick={() => onSettings(widget.id)}><Settings2 className="h-3.5 w-3.5" /></IconBtn>}
            <IconBtn title={widget.hidden ? 'Show' : 'Hide'} onClick={() => onToggleHide(widget.id)}>{widget.hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}</IconBtn>
            <IconBtn title="Remove" onClick={() => onRemove(widget.id)} danger><Trash2 className="h-3.5 w-3.5" /></IconBtn>
          </div>
        )}
      </div>
      {/* body */}
      <div className={cn('flex-1 overflow-auto px-3.5 py-3', H_CLASS[widget.h])}
        style={widget.options?.background ? { background: widget.options.background } : undefined}>
        {def.render(widget, ctx)}
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, title, disabled, danger }: { children: React.ReactNode; onClick: () => void; title: string; disabled?: boolean; danger?: boolean }) {
  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick}
      className={cn('rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30', danger ? 'hover:text-red-600' : 'hover:text-slate-700')}>
      {children}
    </button>
  );
}
