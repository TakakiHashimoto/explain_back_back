/// <reference types="bun" />

import { beforeEach, expect, mock, test } from 'bun:test';
import type { AlertButton } from 'react-native';
import type { PushSubscriptionChangedState } from 'react-native-onesignal';

const platform = { OS: 'android' };
const constants = { executionEnvironment: 'bare' };
const alert = mock((_title: string, _message: string, _buttons: AlertButton[]) => {});
const initialize = mock((_appId: string) => {});
const requestPermission = mock(async (_fallback: boolean) => true);
const getIdAsync = mock((): Promise<string | null> => Promise.resolve(null));
type Listener = (event: PushSubscriptionChangedState) => void;
const listeners = new Set<Listener>();
const addEventListener = mock((_event: string, listener: Listener) => listeners.add(listener));
const removeEventListener = mock((_event: string, listener: Listener) => listeners.delete(listener));

mock.module('react-native', () => ({ Alert: { alert }, Platform: platform }));
mock.module('expo-constants', () => ({
  default: constants,
  ExecutionEnvironment: { StoreClient: 'storeClient' },
}));
mock.module('react-native-onesignal', () => ({
  LogLevel: { Verbose: 6, None: 0 },
  OneSignal: {
    initialize,
    Debug: { setLogLevel: mock(() => {}) },
    Notifications: { requestPermission },
    User: { pushSubscription: { addEventListener, removeEventListener, getIdAsync } },
  },
}));
Object.assign(globalThis, { __DEV__: true });

let notifications: typeof import('./onesignal').notifications;
let moduleId = 0;
beforeEach(async () => {
  platform.OS = 'android';
  constants.executionEnvironment = 'bare';
  listeners.clear();
  for (const fn of [alert, initialize, requestPermission, addEventListener, removeEventListener]) {
    fn.mockClear();
  }
  getIdAsync.mockImplementation(() => Promise.resolve(null));
  // Each case represents a fresh app process, including the module's shown-once guard.
  ({ notifications } = await import(`./onesignal.ts?test=${moduleId++}`));
});

function emit(id: string | null) {
  const state = { id: id ?? undefined, token: undefined, optedIn: false };
  for (const listener of listeners) listener({ previous: state, current: state });
}

test('web and Expo Go skip native initialization', () => {
  platform.OS = 'web';
  notifications.initialize()();
  platform.OS = 'ios';
  constants.executionEnvironment = 'storeClient';
  notifications.initialize()();
  expect(initialize).not.toHaveBeenCalled();
  expect(addEventListener).not.toHaveBeenCalled();
});

test('waits for a server subscription and requests permission only on Got it', async () => {
  getIdAsync.mockResolvedValue('local-pending');
  const cleanup = notifications.initialize();
  await Promise.resolve();
  for (const id of [null, '', ' ', 'local-pending']) emit(id);
  expect(alert).not.toHaveBeenCalled();
  expect(requestPermission).not.toHaveBeenCalled();

  emit('server-subscription');
  emit('server-subscription');
  expect(initialize).toHaveBeenCalledWith('4ef89c9c-db70-4019-9b48-5cbd71f70e87');
  expect(alert).toHaveBeenCalledTimes(1);
  expect(requestPermission).not.toHaveBeenCalled();
  const buttons = alert.mock.calls[0]![2];
  expect(buttons).toHaveLength(1);
  expect(buttons[0]!.text).toBe('Got it');
  buttons[0]!.onPress!();
  expect(requestPermission).toHaveBeenCalledWith(true);
  cleanup();
});

test('checks existing registration immediately and does not repeat the dialog on remount', async () => {
  platform.OS = 'ios';
  getIdAsync.mockResolvedValue('existing-subscription');
  const cleanup = notifications.initialize();
  await Promise.resolve();
  expect(alert).toHaveBeenCalledTimes(1);
  cleanup();
  const cleanupAgain = notifications.initialize();
  await Promise.resolve();
  emit('existing-subscription');
  expect(initialize).toHaveBeenCalledTimes(1);
  expect(alert).toHaveBeenCalledTimes(1);
  expect(listeners.size).toBe(1);
  cleanupAgain();
  expect(listeners.size).toBe(0);
});

test('unmount removes the exact listener and ignores a pending subscription lookup', async () => {
  let resolveId!: (id: string) => void;
  getIdAsync.mockImplementation(() => new Promise((resolve) => { resolveId = resolve; }));
  const cleanup = notifications.initialize();
  cleanup();
  expect(removeEventListener.mock.calls[0]![1]).toBe(addEventListener.mock.calls[0]![1]);
  resolveId('registered-after-unmount');
  await Promise.resolve();
  expect(alert).not.toHaveBeenCalled();
  expect(listeners.size).toBe(0);
});
