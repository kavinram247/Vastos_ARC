// Connector registry. Phase 1 ships the mock Meta connector; the live Meta
// connector (backed by the meta-oauth / meta-sync edge functions) and future
// Google/LinkedIn/TikTok connectors register here without UI changes.
import type { AdProvider } from '../types';
import type { AdConnector } from './types';
import { mockMetaConnector } from './mockMeta';

const REGISTRY: Partial<Record<AdProvider, AdConnector>> = {
  meta: mockMetaConnector,
};

export function getConnector(provider: AdProvider): AdConnector | undefined {
  return REGISTRY[provider];
}

/** Providers offered in the "Connect account" UI (live or mock). */
export const AVAILABLE_PROVIDERS: { provider: AdProvider; label: string; live: boolean }[] = [
  { provider: 'meta', label: 'Meta (Facebook & Instagram)', live: false },
  { provider: 'google', label: 'Google Ads', live: false },
  { provider: 'linkedin', label: 'LinkedIn Ads', live: false },
  { provider: 'tiktok', label: 'TikTok Ads', live: false },
];

export type { AdConnector };
