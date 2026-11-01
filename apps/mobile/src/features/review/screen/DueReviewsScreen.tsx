import { useAuth } from '@clerk/expo';
import { Redirect, useRouter } from 'expo-router';

import type { GetSessionToken } from '../api/api.review';
import { useDueReviews } from '../hooks/useDueReviews';
import { DueReviewsView } from './DueReviewsView';

function AuthenticatedReviews({ getToken }: { getToken: GetSessionToken }) {
  const { state, reload } = useDueReviews(getToken);
  const router = useRouter();
  return <DueReviewsView state={state} onReload={reload} onSelectQuestion={(questionId) =>
    router.push({ pathname: '/review/[questionId]', params: { questionId } })} />;
}

export default function DueReviewsScreen() {
  const { isLoaded, isSignedIn, userId, sessionId, getToken } = useAuth();

  if (!isLoaded) return <DueReviewsView state={{ status: 'loading' }} />;
  if (!isSignedIn || !userId || !sessionId) return <Redirect href="/(auth)/sign-in" />;

  // Account/session changes unmount the previous request and discard its data.
  return <AuthenticatedReviews key={`${userId}:${sessionId}`} getToken={getToken} />;
}
