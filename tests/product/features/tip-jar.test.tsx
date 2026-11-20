import { act } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { tipJar } from '@/platform/tip-jar';

import { resetProductCoreForTests } from '../../../src/testing/product-core.mock';
import { fireEvent, renderRouter, screen, settle } from '../../../src/testing/render';

jest.mock('expo-application', () => ({ nativeApplicationVersion: 'test', nativeBuildVersion: 'test' }));

jest.mock('@/platform/tip-jar', () => ({
  tipJar: {
    supported: jest.fn(() => true),
    getStatus: jest.fn(),
    purchase: jest.fn(),
    restore: jest.fn(),
    addChangeListener: jest.fn(() => () => {}),
  },
}));

const store = jest.mocked(tipJar);
const available = { available: true, displayPrice: '$1.99', hasSupported: false };

async function openSupport() {
  renderRouter('src/app', { initialUrl: '/settings/support' });
  await settle();
}

async function press(testID: string) {
  fireEvent.press(screen.getByTestId(testID));
  await settle();
}

beforeEach(() => {
  resetProductCoreForTests();
  jest.clearAllMocks();
  store.supported.mockReturnValue(true);
  store.getStatus.mockResolvedValue(available);
  store.purchase.mockResolvedValue('purchased');
  store.restore.mockResolvedValue({ ...available, hasSupported: true });
  store.addChangeListener.mockImplementation(() => () => {});
});

it('opens from Settings only where the tip jar exists', async () => {
  renderRouter('src/app', { initialUrl: '/settings' });
  await settle();
  await press('settings-support');
  expect(screen).toHavePathname('/settings/support');
  expect(await screen.findByText('Donate $1.99')).toBeOnTheScreen();
});

it('hides the Settings row on a build without the tip jar', async () => {
  store.supported.mockReturnValue(false);
  renderRouter('src/app', { initialUrl: '/settings' });
  await screen.findByTestId('settings-feedback');
  expect(screen.queryByTestId('settings-support')).toBeNull();
});

it('shows the actual store price and thanks the person after a donation', async () => {
  await openSupport();
  expect(await screen.findByText('Donate $1.99')).toBeOnTheScreen();
  expect(screen.getByText(/A donation unlocks nothing/)).toBeOnTheScreen();
  await press('donate-button');
  expect(await screen.findByText('Thank you for your support')).toBeOnTheScreen();
  expect(store.purchase).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('donate-button')).toBeNull();
  expect(screen.queryByTestId('restore-donation-button')).toBeNull();
});

it('never invents a price or charges when the product is unavailable', async () => {
  store.getStatus.mockResolvedValueOnce({ available: false, hasSupported: false });
  await openSupport();
  expect(await screen.findByText('Retry App Store')).toBeOnTheScreen();
  expect(screen.getByTestId('support-message')).toHaveTextContent(/Donations are unavailable right now/);
  await press('donate-button');
  expect(await screen.findByText('Donate $1.99')).toBeOnTheScreen();
  expect(store.purchase).not.toHaveBeenCalled();
});

it('handles an offline store and recovers on retry', async () => {
  store.getStatus.mockRejectedValueOnce(new Error('offline'));
  await openSupport();
  expect(await screen.findByText(/Couldn't connect to the App Store/)).toBeOnTheScreen();
  await press('donate-button');
  expect(await screen.findByText('Donate $1.99')).toBeOnTheScreen();
  expect(screen.queryByTestId('support-message')).toBeNull();
});

it.each(['cancelled', 'pending'] as const)('does not thank a %s purchase as paid', async (result) => {
  store.purchase.mockResolvedValue(result);
  await openSupport();
  await screen.findByText('Donate $1.99');
  await press('donate-button');
  expect(await screen.findByText('Donate $1.99')).toBeOnTheScreen();
  expect(screen.queryByText('Thank you for your support')).toBeNull();
  if (result === 'pending') expect(screen.getByText(/waiting for approval from Apple/)).toBeOnTheScreen();
  else expect(screen.queryByTestId('support-message')).toBeNull();
});

it('restores an earlier donation through the Apple Account', async () => {
  await openSupport();
  await screen.findByText('Donate $1.99');
  await press('restore-donation-button');
  expect(await screen.findByText('Thank you for your support')).toBeOnTheScreen();
  expect(store.restore).toHaveBeenCalledTimes(1);
});

it('explains an empty restore without thanking the person', async () => {
  store.restore.mockResolvedValue(available);
  await openSupport();
  await screen.findByText('Donate $1.99');
  await press('restore-donation-button');
  expect(await screen.findByText('No earlier donation was found for this Apple Account.')).toBeOnTheScreen();
  expect(screen.queryByText('Thank you for your support')).toBeNull();
});

it('reports a failed purchase and refuses overlapping requests', async () => {
  let reject: (error: Error) => void = () => {};
  store.purchase.mockImplementation(() => new Promise((_resolve, fail) => { reject = fail; }));
  await openSupport();
  await screen.findByText('Donate $1.99');
  fireEvent.press(screen.getByTestId('donate-button'));
  fireEvent.press(screen.getByTestId('restore-donation-button'));
  fireEvent.press(screen.getByTestId('donate-button'));
  expect(store.purchase).toHaveBeenCalledTimes(1);
  expect(store.restore).not.toHaveBeenCalled();
  expect(screen.getByText('Connecting to the App Store…')).toBeOnTheScreen();
  await act(async () => { reject(new Error('failed')); });
  await settle();
  expect(screen.getByText(/couldn't complete this request/)).toBeOnTheScreen();
  expect(screen.getByText('Donate $1.99')).toBeOnTheScreen();
});

it('shows a donation completed elsewhere, refreshes on foreground, and removes its observers', async () => {
  let changed: () => void = () => {};
  const removeListener = jest.fn();
  store.addChangeListener.mockImplementation((listener: () => void) => { changed = listener; return removeListener; });
  const appState = jest.spyOn(AppState, 'addEventListener');
  await openSupport();
  await screen.findByText('Donate $1.99');
  // the screen's own foreground listener is the one registered beside its store observer
  const index = appState.mock.calls.findIndex(([, listener]) => {
    store.getStatus.mockClear();
    (listener as (state: string) => void)('active');
    return store.getStatus.mock.calls.length === 1;
  });
  expect(index).toBeGreaterThanOrEqual(0);
  await settle();
  const foreground = appState.mock.calls[index][1] as (state: string) => void;
  const removeForeground = jest.mocked(appState.mock.results[index].value.remove);
  store.getStatus.mockClear();
  await act(async () => { foreground('background'); });
  expect(store.getStatus).not.toHaveBeenCalled();
  await act(async () => { foreground('active'); });
  expect(store.getStatus).toHaveBeenCalledTimes(1);
  store.getStatus.mockResolvedValue({ ...available, hasSupported: true });
  await act(async () => { changed(); });
  expect(await screen.findByText('Thank you for your support')).toBeOnTheScreen();
  screen.unmount();
  expect(removeListener).toHaveBeenCalledTimes(1);
  expect(removeForeground).toHaveBeenCalled();
});

it('ignores answers that arrive after the screen closed', async () => {
  let resolve: (status: typeof available) => void = () => {};
  store.getStatus.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  await openSupport();
  screen.unmount();
  await act(async () => { resolve(available); });
  let fail: (error: Error) => void = () => {};
  store.getStatus.mockImplementationOnce(() => new Promise((_done, reject) => { fail = reject; }));
  await openSupport();
  screen.unmount();
  await act(async () => { fail(new Error('late')); });
  expect(store.purchase).not.toHaveBeenCalled();
});

it('ignores purchase and restore answers that arrive after the screen closed', async () => {
  let purchased: (result: 'purchased') => void = () => {};
  store.purchase.mockImplementationOnce(() => new Promise((done) => { purchased = done; }));
  await openSupport();
  await screen.findByText('Donate $1.99');
  fireEvent.press(screen.getByTestId('donate-button'));
  screen.unmount();
  await act(async () => { purchased('purchased'); });
  let restored: (status: typeof available) => void = () => {};
  store.restore.mockImplementationOnce(() => new Promise((done) => { restored = done; }));
  await openSupport();
  await screen.findByText('Donate $1.99');
  fireEvent.press(screen.getByTestId('restore-donation-button'));
  screen.unmount();
  await act(async () => { restored(available); });
  let failed: (error: Error) => void = () => {};
  store.restore.mockImplementationOnce(() => new Promise((_done, reject) => { failed = reject; }));
  await openSupport();
  await screen.findByText('Donate $1.99');
  fireEvent.press(screen.getByTestId('restore-donation-button'));
  screen.unmount();
  await act(async () => { failed(new Error('late')); });
  expect(store.purchase).toHaveBeenCalledTimes(1);
});
