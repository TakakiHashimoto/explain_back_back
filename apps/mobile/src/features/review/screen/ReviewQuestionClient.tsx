import { useAuth } from '@clerk/expo';
import { Redirect, useRouter } from 'expo-router';
import type { GetSessionToken } from '../api/api.review';
import { useReviewQuestion } from '../hooks/useReviewQuestion';
import { ReviewQuestionView } from './ReviewQuestionView';

function AuthenticatedQuestion({ questionId, getToken }: { questionId: string; getToken: GetSessionToken }) {
  const router = useRouter();
  const { state, setAnswer, submit, reload, cancel } = useReviewQuestion(questionId, getToken);
  return <ReviewQuestionView state={state} onAnswerChange={setAnswer} onSubmit={submit} onReload={reload}
    onReturn={() => { cancel(); router.dismissTo('/(tabs)/reviews'); }} />;
}

export default function ReviewQuestionClient({ questionId }: { questionId: string }) {
  const { isLoaded, isSignedIn, userId, sessionId, getToken } = useAuth();
  const router = useRouter();
  if (!isLoaded) return <ReviewQuestionView state={{ status: 'loading' }}
    onReturn={() => router.dismissTo('/(tabs)/reviews')} />;
  if (!isSignedIn || !userId || !sessionId) return <Redirect href="/(auth)/sign-in" />;
  // A different question or Clerk session must never inherit answers or requests.
  return <AuthenticatedQuestion key={`${userId}:${sessionId}:${questionId}`} questionId={questionId} getToken={getToken} />;
}
