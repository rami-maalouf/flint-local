import type { TipJarStatus, TipPurchaseResult } from '../../../modules/tip-jar/src/TipJar.types';

export type { TipJarStatus, TipPurchaseResult } from '../../../modules/tip-jar/src/TipJar.types';

export type TipJarPort = Readonly<{
  supported(): boolean;
  getStatus(): Promise<TipJarStatus>;
  purchase(): Promise<TipPurchaseResult>;
  restore(): Promise<TipJarStatus>;
  // purchases approved or refunded outside the screen (ask to buy, refunds)
  addChangeListener(listener: () => void): () => void;
}>;
