// keep the rating action hidden until the app's store listing is public.

export type ReleaseLinkKey =
  | 'feedback'
  | 'appStoreReview'
  | 'moreProducts'
  | 'privacyPolicy'
  | 'termsOfUse';

const RELEASE_LINKS: Record<ReleaseLinkKey, string | null> = {
  feedback: 'https://flint.orbitlabs.studio/support',
  appStoreReview: null,
  moreProducts: 'https://apps.apple.com/developer/rami-maalouf/id1783932552',
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
