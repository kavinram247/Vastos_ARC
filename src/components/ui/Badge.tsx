import { cn } from '../../utils/cn';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'outline';
  size?: 'sm' | 'md';
  className?: string;
}

const variants = {
  default: 'bg-slate-100 text-slate-700',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  error: 'bg-red-50 text-red-700',
  info: 'bg-sky-50 text-sky-700',
  outline: 'bg-transparent border border-slate-300 text-slate-600',
};

export function Badge({ children, variant = 'default', size = 'sm', className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-md font-semibold leading-none whitespace-nowrap',
      size === 'sm' ? 'min-h-5 px-2 py-1 text-[11px]' : 'min-h-7 px-2.5 py-1 text-xs',
      variants[variant],
      className
    )}>
      {children}
    </span>
  );
}
