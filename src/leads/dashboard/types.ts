// ─────────────────────────────────────────────────────────────
// Customizable Leads dashboard — config model.
//
// A dashboard is a named LAYOUT = an ordered list of widget instances + a
// theme. Everything a user can customize (which widgets, their size/order,
// chart type, colors, labels, theme) is DATA in this config — never code — so
// new widget types or options never require a schema change. Persisted as a
// single jsonb blob per layout row (crm_dashboard_layouts.config).
// ─────────────────────────────────────────────────────────────

export type WidgetType =
  | 'kpi'
  | 'lead_distribution'
  | 'agent_performance'
  | 'lead_status'
  | 'recent_activity';

/** KPI metric keys — one per 'kpi' widget instance. */
export type KpiMetric =
  | 'total' | 'new' | 'fresh' | 'unassigned' | 'assigned'
  | 'contacted' | 'qualified' | 'won' | 'lost'
  | 'followups_due' | 'followups_overdue' | 'conversion_rate' | 'pipeline_value';

/** Column span (desktop grid is 4 columns wide). */
export type WidgetWidth = 1 | 2 | 3 | 4;
/** Height preset. */
export type WidgetHeight = 'sm' | 'md' | 'lg';

export interface WidgetOptions {
  colors?: string[];
  background?: string;      // widget body background override
  showLegend?: boolean;
  showGrid?: boolean;
  showAxis?: boolean;
  showLabels?: boolean;
  borderRadius?: number;    // px
  animate?: boolean;
}

export interface DashboardWidget {
  id: string;               // instance id
  type: WidgetType;
  title?: string;           // override the registry default label
  hidden?: boolean;
  w: WidgetWidth;
  h: WidgetHeight;
  metric?: KpiMetric;       // for 'kpi' widgets
  chartType?: string;       // per-widget visualization key (see registry.chartTypes)
  options?: WidgetOptions;
}

export interface DashboardTheme {
  primary?: string;
  secondary?: string;
  cardBg?: string;          // page/card surface
  widgetBg?: string;        // widget surface
  border?: string;
  fontFamily?: string;
  fontScale?: number;       // 0.85 – 1.25
  spacing?: number;         // grid gap in px
  rounded?: boolean;        // rounded vs square cards
  mode?: 'light' | 'dark';
}

/** In-memory / persisted shape (matches a crm_dashboard_layouts row). */
export interface DashboardLayout {
  id: string;
  firm_id: string;
  user_id: string;
  module: string;           // 'leads'
  name: string;
  is_default: boolean;
  scope: 'personal' | 'org';
  config: { widgets: DashboardWidget[]; theme: DashboardTheme };
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

// ── defaults ─────────────────────────────────────────────────
export const DEFAULT_THEME: DashboardTheme = {
  primary: '#1b6a59',   // app primary (teal) — blends with the CRM chrome
  secondary: '#2b806c',
  cardBg: '#ffffff',
  widgetBg: '#ffffff',
  border: '#dde4df',
  fontFamily: 'inherit',
  fontScale: 1,
  spacing: 12,
  rounded: true,
  mode: 'light',
};

let seq = 0;
const wid = (t: WidgetType) => `w_${t}_${Date.now().toString(36)}_${seq++}`;

/** The out-of-the-box board every user starts from (also the "Restore defaults" target). */
export function defaultWidgets(): DashboardWidget[] {
  const kpis: KpiMetric[] = ['total', 'fresh', 'unassigned', 'assigned', 'conversion_rate', 'followups_overdue'];
  return [
    ...kpis.map<DashboardWidget>(m => ({ id: wid('kpi'), type: 'kpi', metric: m, w: 1, h: 'sm', chartType: 'number' })),
    { id: wid('lead_status'), type: 'lead_status', w: 2, h: 'md', chartType: 'funnel' },
    { id: wid('lead_distribution'), type: 'lead_distribution', w: 2, h: 'md', chartType: 'donut' },
    { id: wid('agent_performance'), type: 'agent_performance', w: 2, h: 'lg', chartType: 'leaderboard' },
    { id: wid('recent_activity'), type: 'recent_activity', w: 2, h: 'lg' },
  ];
}

export function defaultConfig(): DashboardLayout['config'] {
  return { widgets: defaultWidgets(), theme: { ...DEFAULT_THEME } };
}

/** Stable id factory for newly added widgets (exported for the AddWidgetMenu). */
export const newWidgetId = wid;
