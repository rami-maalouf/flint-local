// validated https release links. a key without a value shows the spec's
// explicit missing-link state instead of a dead tap; nothing else enforces
// them. the app store review and more-products links wait for the app store
// app id, which exists only after the app store connect record is created.

export type ReleaseLinkKey =
  | 'feedback'
  | 'appStoreReview'
  | 'moreProducts'
  | 'privacyPolicy'
  | 'termsOfUse';

const RELEASE_LINKS: Record<ReleaseLinkKey, string | null> = {
  feedback: 'https://flint.orbitlabs.studio/support',
  appStoreReview: null,
  moreProducts: null,
  privacyPolicy: 'https://flint.orbitlabs.studio/privacy',
  // the website has no terms of its own; apple's standard eula applies
  termsOfUse: 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/',
};

export function releaseLink(
  key: ReleaseLinkKey,
  links: Record<ReleaseLinkKey, string | null> = RELEASE_LINKS,
): string | null {
  const value = links[key];
  if (value !== null && !value.startsWith('https://')) {
    return null;
  }
  return value;
}
