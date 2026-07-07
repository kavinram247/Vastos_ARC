// Dashboard theme editor — primary/secondary/card/widget/border colors, font
// family + scale, grid spacing, rounded-vs-square cards, and light/dark mode.
// Changes are applied live (the parent commits them onto the layout's config).
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import type { DashboardTheme } from './types';
import { DEFAULT_THEME } from './types';
import { cn } from '../../utils/cn';

const FONTS = [
  { value: 'inherit', label: 'System (default)' },
  { value: "'Avenir Next', Avenir, sans-serif", label: 'Avenir Next' },
  { value: 'Georgia, serif', label: 'Georgia (serif)' },
  { value: "'Courier New', monospace", label: 'Monospace' },
  { value: "'Trebuchet MS', sans-serif", label: 'Trebuchet' },
];

interface Props {
  theme: DashboardTheme;
  onChange: (patch: Partial<DashboardTheme>) => void;
  onClose: () => void;
}

export function ThemePanel({ theme, onChange, onClose }: Props) {
  const t = { ...DEFAULT_THEME, ...theme };
  return (
    <Modal open onClose={onClose} title="Dashboard theme" size="md">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Color label="Primary" value={t.primary!} onChange={v => onChange({ primary: v })} />
          <Color label="Secondary" value={t.secondary!} onChange={v => onChange({ secondary: v })} />
          <Color label="Card background" value={t.cardBg!} onChange={v => onChange({ cardBg: v })} />
          <Color label="Widget background" value={t.widgetBg!} onChange={v => onChange({ widgetBg: v })} />
          <Color label="Border" value={t.border!} onChange={v => onChange({ border: v })} />
        </div>

        <Row label="Font family">
          <select value={t.fontFamily} onChange={e => onChange({ fontFamily: e.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-600 focus:border-indigo-500 focus:outline-none">
            {FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </Row>

        <Row label={`Font size · ${Math.round((t.fontScale || 1) * 100)}%`}>
          <input type="range" min={0.85} max={1.25} step={0.05} value={t.fontScale} onChange={e => onChange({ fontScale: Number(e.target.value) })} className="w-full" />
        </Row>

        <Row label={`Dashboard spacing · ${t.spacing}px`}>
          <input type="range" min={4} max={28} step={2} value={t.spacing} onChange={e => onChange({ spacing: Number(e.target.value) })} className="w-full" />
        </Row>

        <div className="grid grid-cols-2 gap-3">
          <Segmented label="Cards" value={t.rounded ? 'rounded' : 'square'} options={[['rounded', 'Rounded'], ['square', 'Square']]} onChange={v => onChange({ rounded: v === 'rounded' })} />
          <Segmented label="Mode" value={t.mode || 'light'} options={[['light', 'Light'], ['dark', 'Dark']]} onChange={v => onChange({ mode: v as 'light' | 'dark' })} />
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <button onClick={() => onChange({ ...DEFAULT_THEME })} className="text-xs font-medium text-slate-400 hover:text-slate-700">Reset theme</button>
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </Modal>
  );
}

function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="block text-[11px] font-medium text-slate-500">{label}</label>
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5">
        <input type="color" value={value} onChange={e => onChange(e.target.value)} className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0" />
        <span className="text-[11px] tabular-nums text-slate-500">{value}</span>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><label className="block text-xs font-semibold text-slate-700">{label}</label>{children}</div>;
}

function Segmented({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-slate-700">{label}</label>
      <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5">
        {options.map(([v, l]) => (
          <button key={v} onClick={() => onChange(v)} className={cn('flex-1 rounded-md px-2 py-1 text-xs font-medium', value === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}>{l}</button>
        ))}
      </div>
    </div>
  );
}
