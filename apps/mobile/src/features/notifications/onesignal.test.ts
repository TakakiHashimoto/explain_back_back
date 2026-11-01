/// <reference types="bun" />

import { beforeEach, expect, mock, test } from 'bun:test';

const platform = { OS: 'android' };
const constants = { executionEnvironment: 'bare' };
const initialize = mock((_appId: string) => {});
const requestPermission = mock(async (_fallback: boolean) => true);
const getOptedInAsync = mock(async () => false);
const optIn = mock(() => {});
const optOut = mock(() => {});

mock.module('react-native', () => ({ Platform: platform }));
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
    User: { pushSubscription: { getOptedInAsync, optIn, optOut } },
  },
}));
Object.assign(globalThis, { __DEV__: true });

let notifications: typeof import('./onesignal').notifications;
let moduleId = 0;
beforeEach(async () => {
  platform.OS = 'android';
  constants.executionEnvironment = 'bare';
  for (const fn of [initialize, requestPermission, getOptedInAsync, optIn, optOut]) {
    fn.mockClear();
  }
  requestPermission.mockImplementation(async () => true);
  getOptedInAsync.mockImplementation(async () => false);
  // Each case represents a fresh app process, including the module's loaded-SDK cache.
  ({ notifications } = await import(`./onesignal.ts?test=${moduleId++}`));
});

test('web and Expo Go skip native initialization and report pushes off', async () => {
  platform.OS = 'web';
  notifications.initialize();
  platform.OS = 'ios';
  constants.executionEnvironment = 'storeClient';
  notifications.initialize();
  expect(initialize).not.toHaveBeenCalled();
  expect(await notifications.isOptedIn()).toBe(false);
  expect(await notifications.enable()).toBe(false);
  expect(requestPermission).not.toHaveBeenCalled();
});

test('initializes once and does not ask for permission at launch', () => {
  notifications.initialize();
  notifications.initialize();
  expect(initialize).toHaveBeenCalledTimes(1);
  expect(initialize).toHaveBeenCalledWith('4ef89c9c-db70-4019-9b48-5cbd71f70e87');
  expect(requestPermission).not.toHaveBeenCalled();
});

test('isOptedIn reports the subscription state', async () => {
  notifications.initialize();
  getOptedInAsync.mockImplementation(async () => true);
  expect(await notifications.isOptedIn()).toBe(true);
});

test('enable asks for permission with the settings fallback, then opts in', async () => {
  notifications.initialize();
  expect(await notifications.enable()).toBe(true);
  expect(requestPermission).toHaveBeenCalledWith(true);
  expect(optIn).toHaveBeenCalledTimes(1);
});

test('enable stays off when permission is denied', async () => {
  notifications.initialize();
  requestPermission.mockImplementation(async () => false);
  expect(await notifications.enable()).toBe(false);
  expect(optIn).not.toHaveBeenCalled();
});

test('disable opts out without touching the permission', () => {
  notifications.initialize();
  notifications.disable();
  expect(optOut).toHaveBeenCalledTimes(1);
  expect(requestPermission).not.toHaveBeenCalled();
});
