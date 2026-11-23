import { View } from 'react-native';

import { AppText } from '@/components/foundation/app-text';
import { semanticColor, spacing } from '@/theme';

import { PrimaryButton, useScheme } from './primitives';

// whole-app fallback for a render error the root boundary caught. it sits
// outside the router and the theme provider, so it paints its own background
// and recovers by re-mounting the app instead of navigating.
export function AppErrorFallback({ onRetry }: { onRetry: () => void }) {
  const scheme = useScheme();
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        padding: spacing.xl,
        gap: spacing.lg,
        backgroundColor: semanticColor('background', scheme),
      }}
      testID="app-error-fallback"
    >
      <AppText variant="title2" accessibilityRole="header">
        Something went wrong.
      </AppText>
      <AppText>
        Flint Local hit an unexpected problem. Your saved habits are still on this device.
      </AppText>
      <PrimaryButton title="Try again" onPress={onRetry} testID="app-error-retry" />
    </View>
  );
}
