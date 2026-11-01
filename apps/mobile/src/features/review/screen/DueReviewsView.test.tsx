/// <reference types="bun" />
import { afterEach, expect, mock, spyOn, test } from 'bun:test';
import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from 'react';

// Inspect the real JSX tree with native platform primitives replaced. These
// tests do not claim to mount React Native or validate device layout.
mock.module('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', ScrollView: 'ScrollView',
  TextInput: 'TextInput', KeyboardAvoidingView: 'KeyboardAvoidingView',
  Text: 'Text', View: 'View', Platform: { OS: 'android' },
}));
mock.module('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
mock.module('nativewind', () => ({ styled: (component: unknown) => component }));
const token = mock(async () => 'clerk-jwt');
let auth = { isLoaded: true, isSignedIn: true, userId: 'user-a', sessionId: 'session-a', getToken: token };
mock.module('@clerk/expo', () => ({ useAuth: () => auth }));
const push = mock(() => {});
const dismissTo = mock(() => {});
let focusEffect: (() => (() => void) | void) | undefined;
let routeParams: { questionId?: string | string[] } = { questionId: 'question-123' };
mock.module('expo-router', () => ({ Redirect: 'Redirect',
  useFocusEffect: (callback: () => (() => void) | void) => { focusEffect = callback; },
  useRouter: () => ({ push, dismissTo }), useLocalSearchParams: () => routeParams,
}));

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
  }).join(' ').replace(/\s+/g, ' ').trim();
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

test('success displays real concept/question and selects the exact question ID', () => {
  const select = mock((_id: string) => {});
  const tree = DueReviewsView({ state: { status: 'success', reviews: [{
    questionId: 'server-question', intervalDays: 2, nextReviewAt: '2026-10-27T00:00:00.000Z',
    question: { id: 'server-question', question: 'Question unique to this API response?', knowledgeGap: { concept: 'Concept from PostgreSQL' } },
  }] }, onReload: () => {}, onSelectQuestion: select });
  expect(text(tree)).toContain('1 review ready');
  expect(text(tree)).toContain('Question unique to this API response?');
  expect(text(tree)).toContain('Concept from PostgreSQL');
  expect(text(tree)).not.toContain('How does React determine');
  const buttons = elements(tree).filter((node) => node.props.accessibilityRole === 'button');
  expect(buttons).toHaveLength(2);
  buttons[0]?.props.onPress?.();
  expect(select).toHaveBeenCalledWith('server-question');
  expect(text(buttons[1])).toBe('Refresh reviews');
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

// Same native/router mocks as the due-review JSX tests; no device layout claims.
const { ReviewQuestionView } = await import('./ReviewQuestionView');
const { default: ReviewQuestionClient } = await import('./ReviewQuestionClient');
const { default: ReviewQuestionRoute } = await import('../../../app/(protected)/review/[questionId]/index');
// react-dom is already a runtime dependency; type only the test API we use.
const { renderToStaticMarkup } = require('react-dom/server') as {
  renderToStaticMarkup: (children: ReactNode) => string;
};
const { question, result } = await import('../api/reviewFixtures.test-support');

test('route reads questionId (including array/missing params), never the typo', () => {
  routeParams = { questionId: 'selected-id' };
  expect(ReviewQuestionRoute().props.questionId).toBe('selected-id');
  routeParams = { questionId: ['first-id', 'second-id'] };
  expect(ReviewQuestionRoute().props.questionId).toBe('first-id');
  routeParams = {};
  expect(ReviewQuestionRoute().props.questionId).toBe('');
});

test('question screen guards authentication and keys state by user/session/question', () => {
  auth.isLoaded = false;
  expect(ReviewQuestionClient({ questionId: question.id }).props.state).toEqual({ status: 'loading' });
  auth.isLoaded = true; auth.isSignedIn = false;
  expect(ReviewQuestionClient({ questionId: question.id }).props.href).toBe('/(auth)/sign-in');
  auth.isSignedIn = true;
  const first = ReviewQuestionClient({ questionId: question.id });
  expect(first.props.questionId).toBe(question.id);
  expect(ReviewQuestionClient({ questionId: 'other' }).key).not.toBe(first.key);
  auth.userId = 'another-user';
  expect(ReviewQuestionClient({ questionId: question.id }).key).not.toBe(first.key);
  const otherUser = ReviewQuestionClient({ questionId: question.id });
  auth.sessionId = 'another-session';
  expect(ReviewQuestionClient({ questionId: question.id }).key).not.toBe(otherUser.key);
});

test('real question and editable multiline input wire answer/submit callbacks', () => {
  const change = mock((_answer: string) => {}); const submit = mock(() => {});
  const tree = ReviewQuestionView({ state: { status: 'ready', question, answer: 'my answer', submission: { status: 'idle' } },
    onAnswerChange: change, onSubmit: submit });
  expect(text(tree)).toContain(question.question); expect(text(tree)).toContain(question.knowledgeGap.concept);
  expect(text(tree)).not.toContain('React useEffect'); expect(text(tree)).not.toContain('Speak answer');
  const input = elements(tree).find((node) => String(node.type) === 'TextInput') as ReactElement<{
    value: string; editable: boolean; multiline: boolean; onChangeText: (value: string) => void;
  }>;
  expect(input.props.value).toBe('my answer'); expect(input.props.editable).toBe(true); expect(input.props.multiline).toBe(true);
  input.props.onChangeText('changed'); expect(change).toHaveBeenCalledWith('changed');
  elements(tree).find((node) => node.props.accessibilityRole === 'button' && text(node) === 'Submit Answer')?.props.onPress?.();
  expect(submit).toHaveBeenCalledTimes(1);
});

test('processing and ambiguous failures disable submission and input', () => {
  for (const submission of [{ status: 'submitting' } as const,
    { status: 'error', uncertain: true, message: 'Your answer may have been saved.' } as const]) {
    const tree = ReviewQuestionView({ state: { status: 'ready', question, answer: 'answer', submission } });
    const button = elements(tree).find((node) => node.props.accessibilityRole === 'button') as ReactElement<{ disabled: boolean }>;
    const input = elements(tree).find((node) => String(node.type) === 'TextInput') as ReactElement<{ editable: boolean }>;
    expect(button.props.disabled).toBe(true); expect(input.props.editable).toBe(false);
    expect(text(tree)).toContain(submission.status === 'submitting' ? 'Evaluating your answer' : submission.message);
  }
});

test.each([true, false])('feedback renders server score, correctness %s, feedback and persisted schedule', (correct) => {
  const onReturn = mock(() => {});
  const tree = ReviewQuestionView({ state: { status: 'ready', question, answer: 'answer',
    submission: { status: 'success', result: { ...result, attempt: { ...result.attempt, correct } } } }, onReturn });
  expect(text(tree)).toContain('91 / 100'); expect(text(tree)).toContain(correct ? 'Correct' : 'Not yet correct');
  expect(text(tree)).toContain(result.attempt.feedback);
  expect(text(tree)).toContain(new Date(result.reviewSchedule.nextReviewAt).toLocaleString());
  expect(text(tree)).toContain('Review interval: 7 days');
  expect(elements(tree).some((node) => String(node.type) === 'TextInput')).toBe(false);
  elements(tree).find((node) => node.props.accessibilityRole === 'button')?.props.onPress?.();
  expect(onReturn).toHaveBeenCalledTimes(1);
});

test('question load error shows retry; empty-answer error stays beside the answer', () => {
  const retry = mock(() => {});
  const tree = ReviewQuestionView({ state: { status: 'error', message: 'Question unavailable' }, onReload: retry });
  expect(text(tree)).toContain('Question unavailable');
  elements(tree).find((node) => text(node) === 'Try again' && node.props.accessibilityRole === 'button')?.props.onPress?.();
  expect(retry).toHaveBeenCalledTimes(1);
  const invalid = ReviewQuestionView({ state: { status: 'ready', question, answer: '',
    submission: { status: 'error', uncertain: false, message: 'Enter an answer' } } });
  expect(text(invalid)).toContain('Enter an answer');
});

test('due screen registers a fresh authenticated GET on each focus and aborts on blur', async () => {
  const previous = process.env.EXPO_PUBLIC_API_URL;
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  const transport = spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ data: [] }));
  // SSR supplies real React hook dispatch; the router focus lifecycle is simulated.
  const warnings = spyOn(console, 'error').mockImplementation(() => {});
  try {
    renderToStaticMarkup(DueReviewsScreen());
    expect(focusEffect).toBeDefined();
    const blur = focusEffect?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(transport).toHaveBeenCalledTimes(1);
    blur?.();
    expect(transport.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    const blurAgain = focusEffect?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport.mock.calls[1]?.[0]).toBe('https://api.example.test/api/v1/reviews/due');
    blurAgain?.();
  } finally {
    transport.mockRestore(); warnings.mockRestore();
    if (previous === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = previous;
  }
});


test('due selection pushes the dynamic question route with the selected ID', () => {
  const screen = DueReviewsScreen();
  let view: ReactElement<{ onSelectQuestion: (id: string) => void }> | undefined;
  function Capture() {
    const Component = screen.type as (props: typeof screen.props) => typeof view;
    view = Component(screen.props);
    return null;
  }
  renderToStaticMarkup(createElement(Capture));
  view?.props.onSelectQuestion('selected-question');
  expect(push).toHaveBeenLastCalledWith({ pathname: '/review/[questionId]', params: { questionId: 'selected-question' } });
});

test('Back to Review dismisses to the real Review tab, including direct-link fallback', () => {
  const screen = ReviewQuestionClient({ questionId: question.id });
  let view: ReactElement<{ onReturn: () => void }> | undefined;
  function Capture() {
    const Component = screen.type as (props: typeof screen.props) => typeof view;
    view = Component(screen.props);
    return null;
  }
  renderToStaticMarkup(createElement(Capture));
  view?.props.onReturn();
  expect(dismissTo).toHaveBeenLastCalledWith('/(tabs)/reviews');
});
