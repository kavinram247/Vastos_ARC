import { cn } from '../../utils/cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-semibold text-slate-700">{label}</label>}
      <input
        className={cn(
          'h-10 w-full rounded-[9px] border px-3 text-sm text-slate-900 shadow-[0_1px_1px_rgba(16,32,26,0.02)] placeholder:text-slate-500',
          'focus:border-indigo-600 focus:outline-none focus:ring-3 focus:ring-indigo-600/12',
          error ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-slate-200 hover:border-slate-300',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className, ...props }: TextareaProps) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-semibold text-slate-700">{label}</label>}
      <textarea
        className={cn(
          'w-full rounded-[9px] border px-3 py-2.5 text-sm text-slate-900 shadow-[0_1px_1px_rgba(16,32,26,0.02)] placeholder:text-slate-500 transition-colors resize-none',
          'focus:border-indigo-600 focus:outline-none focus:ring-3 focus:ring-indigo-600/12',
          error ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-slate-200 hover:border-slate-300',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, error, options, className, ...props }: SelectProps) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-semibold text-slate-700">{label}</label>}
      <select
        className={cn(
          'h-10 w-full rounded-[9px] border px-3 text-sm text-slate-900 shadow-[0_1px_1px_rgba(16,32,26,0.02)] transition-colors',
          'focus:border-indigo-600 focus:outline-none focus:ring-3 focus:ring-indigo-600/12',
          error ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-slate-200 hover:border-slate-300',
          className
        )}
        {...props}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
