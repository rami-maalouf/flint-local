import type { TipJarPort } from './port';

export type { TipJarPort, TipJarStatus, TipPurchaseResult } from './port';

// the tip jar is storekit only; other platforms show no donation row
export const tipJar: TipJarPort = {
  supported: () => false,
  getStatus: async () => ({ available: false, hasSupported: false }),
  purchase: async () => { throw new Error('Donations are unavailable on this device.'); },
  restore: async () => ({ available: false, hasSupported: false }),
  addChangeListener: () => () => {},
};
