import { cn } from '../../utils/cn';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
  padding?: 'sm' | 'md' | 'lg' | 'none';
}

export function Card({ children, className, onClick, hover, padding = 'md' }: CardProps) {
  const paddings = { none: '', sm: 'p-3', md: 'p-4 sm:p-5', lg: 'p-6' };
  return (
    <div
      onClick={onClick}
      onKeyDown={onClick ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      } : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cn(
        'surface-panel',
        hover && 'hover:-translate-y-0.5 hover:shadow-[0_6px_14px_rgba(16,32,26,0.08)] transition-all duration-200 ease-out cursor-pointer',
        paddings[padding],
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mb-4', className)}>{children}</div>;
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn('text-base font-semibold tracking-[-0.012em] text-slate-900', className)}>{children}</h3>;
}
