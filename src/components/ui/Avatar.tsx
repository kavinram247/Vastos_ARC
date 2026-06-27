import { cn } from '../../utils/cn';

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const colors = [
  'bg-indigo-600', 'bg-emerald-600', 'bg-amber-600', 'bg-rose-600',
  'bg-sky-700', 'bg-violet-600', 'bg-teal-700', 'bg-orange-600',
];

function getColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const sizes = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-base',
};

export function Avatar({ name, size = 'md', className }: AvatarProps) {
  return (
    <div className={cn(
      'rounded-[9px] ring-1 ring-black/5 flex items-center justify-center text-white font-semibold shrink-0',
      getColor(name),
      sizes[size],
      className
    )}>
      {getInitials(name)}
    </div>
  );
}
