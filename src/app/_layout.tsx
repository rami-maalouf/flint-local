import { Observe, ObserveRoot } from 'expo-observe';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { SampleSessionProvider } from '@/features/sample/session-context';
import { AppErrorFallback } from '@/features/ui/app-error-fallback';

// the app's only observe configuration. it must run before any screen mounts,
// and a second call would replace it. record ids are filtered out of route
// params, so only route patterns such as /boards/[boardId] leave the device.
Observe.configure({
  integrations: {
    'expo-router': { filteredParams: ['boardId', 'checkInId', 'reminderId', 'rewardId', 'rootId'] },
  },
});

export default function RootLayout() {
  const scheme = useColorScheme();
  return <ObserveRoot errorBoundaryFallback={({ resetError }) => <AppErrorFallback onRetry={resetError} />}>
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SampleSessionProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(product)" />
          <Stack.Screen name="sample" options={{ presentation: 'fullScreenModal' }} />
        </Stack>
      </SampleSessionProvider>
    </ThemeProvider>
  </ObserveRoot>;
}
