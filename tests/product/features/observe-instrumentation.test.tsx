import { Text } from 'react-native';

import { createBoard, setICloudSyncEnabled } from '@/core/domain/commands';
import * as queries from '@/core/domain/queries';
import { err } from '@/core/domain/result';
import { SyncCoordinator } from '@/features/product-store/sync-coordinator';
import { redactDiagnostic, reportHandledError } from '@/platform/diagnostics';

import RootLayout from '../../../src/app/_layout';
// jest maps expo-observe to this file, so it is the instance the app uses
import { Observe, boundaryErrors } from '../../../src/testing/expo-observe.mock';
import * as coreModule from '../../../src/testing/product-core.mock';
import { fireEvent, renderRouter, screen, settle } from '../../../src/testing/render';
import { FakeSyncTransport } from '../helpers/fake-transport';
import { createTestHarness } from '../helpers/test-db';

// captured before any test clears the mocks: configure runs once, at import
const configureCalls = Observe.configure.mock.calls.slice();

const reported = () => Observe.reportError.mock.calls.map(([error]) => error as Error);

describe('expo observe instrumentation', () => {
  beforeEach(() => {
    coreModule.resetProductCoreForTests();
    jest.restoreAllMocks();
    Observe.reportError.mockClear();
    Observe.markInteractive.mockClear();
    boundaryErrors.length = 0;
  });

  it('configures observe once, before any screen, with record ids filtered out', () => {
    expect(configureCalls).toEqual([[{
      integrations: {
        'expo-router': { filteredParams: ['boardId', 'checkInId', 'reminderId', 'rewardId', 'rootId'] },
      },
    }]]);
  });

  it('replaces the app with the fallback on a render error and recovers with try again', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    let fail = true;
    function Flaky() {
      if (fail) throw new Error('render failed');
      return <Text>Recovered home</Text>;
    }
    renderRouter({ _layout: RootLayout, '(product)/index': Flaky, 'sample/index': () => null }, { initialUrl: '/' });

    expect(await screen.findByTestId('app-error-fallback')).toBeOnTheScreen();
    expect(screen.getByText('Something went wrong.')).toBeOnTheScreen();
    expect(boundaryErrors).toEqual([new Error('render failed')]);

    fail = false;
    fireEvent.press(screen.getByTestId('app-error-retry'));
    expect(await screen.findByText('Recovered home')).toBeOnTheScreen();
    expect(screen.queryByTestId('app-error-fallback')).toBeNull();
  });

  it('marks home interactive once its boards have loaded', async () => {
    renderRouter('src/app', { initialUrl: '/' });
    await screen.findByTestId('empty-create-board');
    await settle();
    expect(Observe.markInteractive).toHaveBeenCalled();
  });

  it('marks a deep-linked board interactive', async () => {
    const opened = await coreModule.getProductCore();
    if (!opened.ok) throw new Error(opened.error.message);
    const board = await createBoard(opened.value, {
      commandId: coreModule.newCommandId(), title: 'Read', kind: 'count', symbol: 'star.fill', accentHex: '#70A7FF',
      usesTintedBackground: true, tracksAmount: false, tracksTime: false, startOfDayMinute: 0, metricsEnabled: true,
    });
    if (!board.ok) throw new Error(board.error.message);

    renderRouter('src/app', { initialUrl: `/boards/${board.value.boardId}` });
    await screen.findByTestId('edit-board');
    await settle();
    expect(Observe.markInteractive).toHaveBeenCalled();
  });

  it('reports a failed database open with its code and system message', async () => {
    jest.spyOn(coreModule, 'getProductCore')
      .mockResolvedValueOnce(err('migration', 'Migration 7 does not match its recorded checksum.'));

    renderRouter('src/app', { initialUrl: '/' });
    expect(await screen.findByTestId('product-recovery')).toBeOnTheScreen();
    expect(reported().map((error) => error.message)).toEqual([
      'persistence: product database could not be opened (migration): Migration 7 does not match its recorded checksum.',
    ]);
  });

  it('reports a rejected database open', async () => {
    jest.spyOn(coreModule, 'getProductCore').mockRejectedValueOnce(new Error('disk I/O error'));

    renderRouter('src/app', { initialUrl: '/' });
    expect(await screen.findByTestId('product-recovery')).toBeOnTheScreen();
    expect(reported().map((error) => error.message)).toEqual(['persistence: disk I/O error']);
  });

  it('reports a local sync failure with its domain code, not its message', async () => {
    const harness = await createTestHarness();
    await setICloudSyncEnabled(harness.deps, { commandId: harness.ids.nextCommandId(), enabled: true });
    jest.spyOn(queries, 'getSyncSummary')
      .mockResolvedValueOnce(err('database', 'Board "Morning pages" could not be read.'));
    const states: string[] = [];
    const coordinator = new SyncCoordinator(harness.deps, new FakeSyncTransport(), (state) => states.push(state.status), () => {});

    await coordinator.request();
    expect(states.at(-1)).toBe('needs_attention');
    expect(reported().map((error) => error.message)).toEqual(['sync: sync settings unavailable: database']);
    await coordinator.dispose();
  });

  it('does not report expected offline sync outcomes', async () => {
    const harness = await createTestHarness();
    await setICloudSyncEnabled(harness.deps, { commandId: harness.ids.nextCommandId(), enabled: true });
    const transport = new FakeSyncTransport();
    const { SyncTransportError } = jest.requireActual<typeof import('@/core/sync/transport')>('@/core/sync/transport');
    transport.failNext = new SyncTransportError('offline', 'no connection');
    const states: string[] = [];
    const coordinator = new SyncCoordinator(harness.deps, transport, (state) => states.push(state.status), () => {});

    await coordinator.request();
    expect(states.at(-1)).toBe('offline');
    expect(Observe.reportError).not.toHaveBeenCalled();
    await coordinator.dispose();
  });

  describe('reportHandledError', () => {
    it('prefixes the area, redacts ids and email addresses, and keeps the stack frames', () => {
      const cause = new TypeError('row 1b4e28ba-2fa1-41d2-883f-0016d3cca427 for person@example.com failed');
      cause.stack = `${cause.name}: ${cause.message}\n    at upload (main.jsbundle:1:4242)`;

      reportHandledError('sync', cause);

      const [error] = reported();
      expect(error.name).toBe('TypeError');
      expect(error.message).toBe('sync: row <id> for <email> failed');
      expect(error.stack).toBe('TypeError: sync: row <id> for <email> failed\n    at upload (main.jsbundle:1:4242)');
    });

    it('drops a stack whose header it cannot replace, so its raw message never leaves', () => {
      const cause = new Error('rejected for person@example.com');
      cause.stack = 'upload@main.jsbundle:1:4242 rejected for person@example.com';

      reportHandledError('import', cause);

      const [error] = reported();
      expect(error.message).toBe('import: rejected for <email>');
      expect(error.stack).not.toContain('person@example.com');
    });

    it('stringifies a non-error value', () => {
      reportHandledError('widgets', 'timeline rejected');
      expect(reported()[0].message).toBe('widgets: timeline rejected');
    });

    it('leaves text without ids or addresses unchanged', () => {
      expect(redactDiagnostic('database is locked')).toBe('database is locked');
    });
  });
});
