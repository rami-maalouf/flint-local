import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { SampleSessionProvider } from '@/features/sample/session-context';
import { holdLaunchScreen } from '@/platform/launch-screen';

// hold the launch flame from the first moment; home reveals the app once its habits are ready
holdLaunchScreen();

export default function RootLayout() {
  const scheme = useColorScheme();
  return <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
    <SampleSessionProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(product)" />
        <Stack.Screen name="sample" options={{ presentation: 'fullScreenModal' }} />
      </Stack>
    </SampleSessionProvider>
  </ThemeProvider>;
}
