import * as SplashScreen from 'expo-splash-screen';

// the launch flame stays up until home has its habits to show, then fades, so opening the app
// reads as one move instead of a cut to an empty screen.

// never keep the launch flame up longer than this, whatever happens behind it
export const launchScreenLimitMs = 4000;
// how long the flame takes to fade into the app
export const launchScreenFadeMs = 350;

let isHeld = false;
let isRevealed = false;

export function holdLaunchScreen(): void {
  if (isHeld) return;
  isHeld = true;
  SplashScreen.setOptions({ duration: launchScreenFadeMs, fade: true });
  void SplashScreen.preventAutoHideAsync().catch(() => undefined);
  setTimeout(revealApp, launchScreenLimitMs);
}

export function revealApp(): void {
  if (isRevealed) return;
  isRevealed = true;
  SplashScreen.hide();
}
