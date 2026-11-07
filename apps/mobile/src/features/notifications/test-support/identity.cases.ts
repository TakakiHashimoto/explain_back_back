import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test';

// Execute the bridge's effect callbacks with mocked boundaries; no React Native
// renderer or native OneSignal process is exercised by these tests.
let effects: Array<() => void | (() => void)> = [];
const getToken = mock(async () => 'clerk-token');
let auth = { isLoaded: true, isSignedIn: true, userId: 'clerk-user-a', sessionId: 'session-a', getToken };
const initialize = mock(() => {});
const login = mock((_id: string) => {});
const logout = mock(() => {});
mock.module('react', () => ({
  useEffect: (effect: () => void | (() => void)) => effects.push(effect),
  useRef: (current: unknown) => ({ current }),
}));
mock.module('@clerk/expo', () => ({ useAuth: () => auth }));
mock.module('../onesignal', () => ({ notifications: { initialize, login, logout } }));
const { NotificationIdentityBridge } = await import('../NotificationIdentityBridge');
const apiUrl = process.env.EXPO_PUBLIC_API_URL;
let fetchMock: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>;
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

beforeEach(() => {
  effects = [];
  auth = { isLoaded: true, isSignedIn: true, userId: 'clerk-user-a', sessionId: 'session-a', getToken };
  for (const fn of [initialize, login, logout, getToken]) fn.mockClear();
  process.env.EXPO_PUBLIC_API_URL = 'https://test.invalid';
  fetchMock = spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ id: 'internal-user-a' }));
  spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  mock.restore();
  if (apiUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = apiUrl;
});

function mountEffects() {
  effects = [];
  NotificationIdentityBridge();
  effects[0]!();
  effects[1]!();
  return effects[2]!();
}

test('authenticated bootstrap targets the backend UUID and clears persisted identity first', async () => {
  const cleanup = mountEffects();
  expect(logout).toHaveBeenCalledTimes(1);
  await settle();
  expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({ Authorization: 'Bearer clerk-token' });
  expect(login).toHaveBeenCalledWith('internal-user-a');
  expect(login).not.toHaveBeenCalledWith('clerk-user-a');
  cleanup?.();
  expect(logout).toHaveBeenCalledTimes(2);
});

test('account-switch cleanup aborts the old request and rejects its late response', async () => {
  let resolve!: (response: Response) => void;
  fetchMock.mockReturnValueOnce(new Promise<Response>((done) => { resolve = done; }));
  const cleanup = mountEffects();
  await settle();
  const signal = fetchMock.mock.calls[0]?.[1]?.signal;
  cleanup?.();
  expect(signal?.aborted).toBe(true);
  auth = { ...auth, userId: 'clerk-user-b', sessionId: 'session-b' };
  fetchMock.mockResolvedValue(Response.json({ id: 'internal-user-b' }));
  const cleanupB = mountEffects();
  resolve(Response.json({ id: 'internal-user-a' }));
  await settle();
  expect(login.mock.calls).toEqual([['internal-user-b']]);
  cleanupB?.();
});

test('expired bootstrap leaves no previous identity attached', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
  const cleanup = mountEffects();
  await settle();
  expect(logout).toHaveBeenCalled();
  expect(login).not.toHaveBeenCalled();
  cleanup?.();
});

test('Clerk loading and signed-out states never fetch an identity', async () => {
  auth = { ...auth, isLoaded: false };
  mountEffects();
  auth = { ...auth, isLoaded: true, isSignedIn: false };
  mountEffects();
  await settle();
  expect(fetchMock).not.toHaveBeenCalled();
  expect(login).not.toHaveBeenCalled();
  expect(logout).toHaveBeenCalledTimes(1);
});
