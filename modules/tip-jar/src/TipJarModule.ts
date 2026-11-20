import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { TipJarModuleEvents, TipJarStatus, TipPurchaseResult } from './TipJar.types';

declare class TipJarModule extends NativeModule<TipJarModuleEvents> {
  getStatus(): Promise<TipJarStatus>;
  purchase(): Promise<TipPurchaseResult>;
  restore(): Promise<TipJarStatus>;
}

// optional: the module is ios only, and a build without it reports the tip
// jar as unavailable instead of failing at import
export default requireOptionalNativeModule<TipJarModule>('TipJar');
