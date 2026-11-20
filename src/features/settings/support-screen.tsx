import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, ScrollView, View } from 'react-native';

import { AppText } from '@/components/foundation/app-text';
import { tipJar, type TipJarStatus } from '@/platform/tip-jar';
import { radius, radiusCurve, semanticColor, spacing } from '@/theme';

import { useProduct } from '../product-store';
import { SampleDisabledScreen } from '../sample/disabled-screen';
import { PrimaryButton, ProductPressable, useScheme } from '../ui';
import { useSettingsActivity } from './use-settings-activity';

// an optional, one-time storekit donation. it unlocks nothing: the screen only
// thanks the person and restores the thank-you on another device.
export function SupportScreen() {
  const { scope } = useProduct();
  if (scope.kind === 'sample') return <SampleDisabledScreen title="Support Flint Local" message="Donations are disabled in sample mode." />;
  return <SupportBody />;
}

const UNAVAILABLE = 'Donations are unavailable right now. Every feature of Flint Local stays free.';
const OFFLINE = "Couldn't connect to the App Store. Try again when you're online.";
const FAILED = "The App Store couldn't complete this request. Try again, or use Restore Purchase for an earlier donation.";
const PENDING = 'Your donation is waiting for approval from Apple. Thank you for your support.';
const NOT_FOUND = 'No earlier donation was found for this Apple Account.';

function SupportBody() {
  const scheme = useScheme();
  const { scope } = useProduct();
  const activity = useSettingsActivity(scope);
  const secondary = semanticColor('secondaryLabel', scheme);
  const [status, setStatus] = useState<TipJarStatus | null>(null);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const mounted = useRef(true);
  const operationRunning = useRef(false);

  const refresh = useCallback(() => {
    return tipJar.getStatus().then((next) => {
      if (!mounted.current) return;
      setStatus(next);
      setMessage(next.available || next.hasSupported ? null : UNAVAILABLE);
    }).catch(() => {
      if (mounted.current) setMessage(OFFLINE);
    }).finally(() => {
      if (mounted.current) setBusy(false);
    });
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const removeListener = tipJar.addChangeListener(() => { void refresh(); });
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !operationRunning.current) void refresh();
    });
    return () => {
      mounted.current = false;
      removeListener();
      foreground.remove();
    };
  }, [refresh]);

  const run = async (action: 'purchase' | 'restore') => {
    if (!activity.active || operationRunning.current) return;
    operationRunning.current = true;
    setBusy(true);
    setMessage(null);
    try {
      if (action === 'restore') {
        const restored = await tipJar.restore();
        if (mounted.current) {
          setStatus(restored);
          setMessage(restored.hasSupported ? null : NOT_FOUND);
        }
      } else {
        const result = await tipJar.purchase();
        if (mounted.current && result === 'purchased') {
          setStatus((current) => ({ available: current?.available ?? true, displayPrice: current?.displayPrice, hasSupported: true }));
        } else if (mounted.current && result === 'pending') {
          setMessage(PENDING);
        }
      }
    } catch {
      if (mounted.current) setMessage(FAILED);
    } finally {
      operationRunning.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const supported = status?.hasSupported === true;
  const price = status?.available ? status.displayPrice : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: semanticColor('groupedBackground', scheme) }}>
      <Stack.Screen options={{ title: 'Support Flint Local' }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}
      >
        <View style={{ alignItems: 'center', gap: spacing.md, paddingTop: spacing.sm, paddingHorizontal: spacing.sm }}>
          <Image
            accessibilityIgnoresInvertColors
            source={require('../../../assets/images/icon.png')}
            contentFit="cover"
            style={{
              width: 72,
              height: 72,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: semanticColor('separator', scheme),
            }}
            testID="support-icon"
          />
          <AppText variant="title2" accessibilityRole="header" style={{ textAlign: 'center' }}>
            Keep the flame going
          </AppText>
          <AppText style={{ color: secondary, textAlign: 'center' }}>
            Flint Local is free, and every feature stays free. If it helps you keep your habits lit, a
            one-time donation helps me keep improving it.
          </AppText>
          <AppText style={{ color: secondary, textAlign: 'center' }}>Thank you for using it. - Rami</AppText>
        </View>

        <View
          testID="support-card"
          style={{
            backgroundColor: semanticColor('secondaryGroupedBackground', scheme),
            borderRadius: radius.lg,
            borderCurve: radiusCurve,
            padding: spacing.lg,
            gap: spacing.md,
          }}
        >
          <AppText variant="headline" accessibilityRole="header">
            {supported ? 'Thank you for your support' : 'One-time donation'}
          </AppText>
          <AppText variant="subheadline" style={{ color: secondary }}>
            {supported
              ? 'Your donation is saved with your Apple Account, so this thank-you comes back on every device you use. It means a lot.'
              : 'Billed once by Apple. A donation unlocks nothing: every feature is free whether you donate or not, and there is no subscription.'}
          </AppText>
          {supported ? null : (
            <View style={{ gap: spacing.xs, paddingTop: spacing.xs }}>
              <PrimaryButton
                testID="donate-button"
                disabled={busy}
                title={busy ? 'Connecting to the App Store…' : price ? `Donate ${price}` : 'Retry App Store'}
                onPress={() => {
                  if (price) void run('purchase');
                  else if (activity.active) { setBusy(true); void refresh(); }
                }}
              />
              <ProductPressable
                testID="restore-donation-button"
                label="Restore Purchase"
                disabled={busy}
                onPress={() => { void run('restore'); }}
                stretch
              >
                <AppText variant="subheadline" selectable={false} style={{ textAlign: 'center', fontWeight: '600' }}>
                  Restore Purchase
                </AppText>
              </ProductPressable>
            </View>
          )}
        </View>

        {message !== null ? (
          <AppText variant="footnote" accessibilityLiveRegion="polite" testID="support-message"
            style={{ color: secondary, paddingHorizontal: spacing.sm }}>
            {message}
          </AppText>
        ) : null}
      </ScrollView>
    </View>
  );
}
