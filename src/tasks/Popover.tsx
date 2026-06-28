// Lightweight anchored popover + menu primitives for the Tasks UI.
// Closes on outside-click and Escape; positions under (or above) its trigger.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../utils/cn';

interface PopoverProps {
  trigger: (props: { open: boolean; toggle: () => void; ref: (el: HTMLElement | null) => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'start' | 'end';
  width?: number;
  className?: string;
}

export function Popover({ trigger, children, align = 'start', width = 220, className }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; placement: 'down' | 'up' }>({ top: 0, left: 0, placement: 'down' });
  const anchorRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const place = () => {
    const a = anchorRef.current;
    if (!a) return;
    const r = a.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const placement: 'down' | 'up' = spaceBelow < 280 && r.top > spaceBelow ? 'up' : 'down';
    let left = align === 'end' ? r.right - width : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    setPos({ top: placement === 'down' ? r.bottom + 6 : r.top - 6, left, placement });
  };

  useLayoutEffect(() => { if (open) place(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onScroll = () => place();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onClick = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node) || anchorRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <>
      {trigger({ open, toggle: () => setOpen((v) => !v), ref: (el) => { anchorRef.current = el; } })}
      {open && (
        <div
          ref={panelRef}
          style={{
            position: 'fixed', top: pos.top, left: pos.left, width,
            transform: pos.placement === 'up' ? 'translateY(-100%)' : undefined,
          }}
          className={cn('floating-panel z-[60] max-h-[60vh] overflow-y-auto p-1', className)}
          role="menu"
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </>
  );
}

export function MenuItem({ icon, label, onClick, danger, active, trailing }: {
  icon?: ReactNode; label: ReactNode; onClick?: () => void; danger?: boolean; active?: boolean; trailing?: ReactNode;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] font-medium transition-colors [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0',
        danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-100',
        active && !danger && 'bg-indigo-50 text-indigo-700',
      )}
    >
      {icon && <span className={cn(danger ? 'text-red-500' : active ? 'text-indigo-600' : 'text-slate-400')}>{icon}</span>}
      <span className="flex-1 truncate">{label}</span>
      {trailing}
    </button>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">{children}</div>;
}

export function MenuDivider() {
  return <div className="my-1 h-px bg-slate-100" />;
}
