/// <reference types="bun" />
import { afterEach, expect, mock, test } from 'bun:test';
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';

// Inspect the real JSX tree with native platform primitives replaced. These
// tests do not claim to mount React Native or validate device layout.
mock.module('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', ScrollView: 'ScrollView',
  Text: 'Text', View: 'View', Platform: { OS: 'android' },
}));
mock.module('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
mock.module('nativewind', () => ({ styled: (component: unknown) => component }));
const token = mock(async () => 'clerk-jwt');
let auth = { isLoaded: true, isSignedIn: true, userId: 'user-a', sessionId: 'session-a', getToken: token };
mock.module('@clerk/expo', () => ({ useAuth: () => auth }));
mock.module('expo-router', () => ({ Redirect: 'Redirect', useFocusEffect: () => {} }));

const { DueReviewsView } = await import('./DueReviewsView');
const { default: DueReviewsScreen } = await import('./DueReviewsScreen');

type ElementProps = { children?: ReactNode; accessibilityRole?: string; onPress?: () => void; href?: string };
function elements(node: ReactNode): ReactElement<ElementProps>[] {
  return Children.toArray(node).flatMap((child) => {
    if (!isValidElement<ElementProps>(child)) return [];
    return [child, ...elements(child.props.children)];
  });
}
function text(node: ReactNode): string {
  return Children.toArray(node).map((child) => {
    if (isValidElement<ElementProps>(child)) return text(child.props.children);
    return typeof child === 'string' || typeof child === 'number' ? String(child) : '';
  }).join(' ');
}

afterEach(() => {
  auth = { isLoaded: true, isSignedIn: true, userId: 'user-a', sessionId: 'session-a', getToken: token };
  token.mockClear();
});

test('loading shows progress without reviews or action buttons', () => {
  const tree = DueReviewsView({ state: { status: 'loading' } });
  expect(text(tree)).toContain('Loading your reviews');
  expect(text(tree)).not.toContain('reviews ready');
  expect(elements(tree).some((node) => String(node.type) === 'ActivityIndicator')).toBe(true);
  expect(elements(tree).filter((node) => node.props.accessibilityRole === 'button')).toHaveLength(0);
});

test('success displays supplied concept/question as non-interactive content', () => {
  const tree = DueReviewsView({ state: { status: 'success', reviews: [{
    questionId: 'server-question', intervalDays: 2, nextReviewAt: '2026-10-27T00:00:00.000Z',
    question: { id: 'server-question', question: 'Question unique to this API response?', knowledgeGap: { concept: 'Concept from PostgreSQL' } },
  }] }, onReload: () => {} });
  expect(text(tree)).toContain('1 review ready');
  expect(text(tree)).toContain('Question unique to this API response?');
  expect(text(tree)).toContain('Concept from PostgreSQL');
  expect(text(tree)).not.toContain('How does React determine');
  const buttons = elements(tree).filter((node) => node.props.accessibilityRole === 'button');
  expect(buttons).toHaveLength(1);
  expect(text(buttons[0])).toBe('Refresh reviews');
  expect(elements(tree).filter((node) => node.props.href)).toHaveLength(0);
});

test('empty state has no question cards and refresh invokes its callback', () => {
  const reload = mock(() => {});
  const tree = DueReviewsView({ state: { status: 'success', reviews: [] }, onReload: reload });
  expect(text(tree)).toContain('0 reviews ready');
  expect(text(tree)).toContain('No reviews are due right now');
  const button = elements(tree).find((node) => node.props.accessibilityRole === 'button');
  button?.props.onPress?.();
  expect(reload).toHaveBeenCalledTimes(1);
});

test('error shows useful feedback and Try again invokes the reload callback', () => {
  const reload = mock(() => {});
  const tree = DueReviewsView({ state: { status: 'error', message: 'Check your connection and try again.' }, onReload: reload });
  expect(text(tree)).toContain('Could not load reviews');
  expect(text(tree)).toContain('Check your connection and try again.');
  const button = elements(tree).find((node) => node.props.accessibilityRole === 'button');
  expect(text(button)).toBe('Try again');
  button?.props.onPress?.();
  expect(reload).toHaveBeenCalledTimes(1);
});

test('Clerk loading does not render the authenticated fetching component', () => {
  auth.isLoaded = false;
  const screen = DueReviewsScreen();
  expect(screen.type).toBe(DueReviewsView);
  expect(screen.props.state).toEqual({ status: 'loading' });
  expect(token).not.toHaveBeenCalled();
});

test('signed-out users are redirected before rendering a fetching component', () => {
  auth.isSignedIn = false;
  const screen = DueReviewsScreen();
  expect(String(screen.type)).toBe('Redirect');
  expect(screen.props.href).toBe('/(auth)/sign-in');
  expect(token).not.toHaveBeenCalled();
});

test('account/session changes change the React key, discarding the previous request state', () => {
  const first = DueReviewsScreen();
  auth.userId = 'user-b';
  const nextUser = DueReviewsScreen();
  auth.sessionId = 'session-b';
  const nextSession = DueReviewsScreen();
  expect(first.key).not.toBe(nextUser.key);
  expect(nextUser.key).not.toBe(nextSession.key);
  expect(nextSession.props.getToken).toBe(token);
});
