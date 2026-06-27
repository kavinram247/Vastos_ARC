// Provider-agnostic ad connector interface. The dashboard talks to connectors,
// never to a specific platform — so Google/LinkedIn/TikTok drop in by adding a
// new implementation to the registry.
import type { AdProvider } from '../types';

export interface AdConnector {
  provider: AdProvider;
  label: string;
  /** True once real API credentials are configured (live); false for the mock. */
  isLive(): boolean;
  /** OAuth start URL for live mode, or null when mock / not configured. */
  getConnectUrl(redirectTo: string): string | null;
  /** Run a sync for one account; resolves with the number of rows touched. */
  sync(firmId: string, accountId: string): Promise<number>;
}
