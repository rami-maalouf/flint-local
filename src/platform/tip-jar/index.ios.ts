import TipJarModule from '../../../modules/tip-jar';
import type { TipJarPort } from './port';

export type { TipJarPort, TipJarStatus, TipPurchaseResult } from './port';

function requireModule() {
  if (!TipJarModule) throw new Error('Donations are unavailable on this device.');
  return TipJarModule;
}

// a thin storekit 2 adapter: the native store verifies every transaction and
// reports only availability, the localized price and whether this apple
// account has donated. donating unlocks nothing.
export const tipJar: TipJarPort = {
  supported: () => TipJarModule !== null,
  getStatus: () => requireModule().getStatus(),
  purchase: () => requireModule().purchase(),
  restore: () => requireModule().restore(),
  addChangeListener: (listener) => {
    if (!TipJarModule) return () => {};
    const subscription = TipJarModule.addListener('onChange', listener);
    return () => subscription.remove();
  },
};
