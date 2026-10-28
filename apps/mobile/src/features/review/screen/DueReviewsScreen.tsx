import { useAuth } from '@clerk/expo';
import { Redirect } from 'expo-router';

import type { GetSessionToken } from '../api/api.review';
import { useDueReviews } from '../hooks/useDueReviews';
import { DueReviewsView } from './DueReviewsView';

function AuthenticatedReviews({ getToken }: { getToken: GetSessionToken }) {
  const { state, reload } = useDueReviews(getToken);
  return <DueReviewsView state={state} onReload={reload} />;
}

export default function DueReviewsScreen() {
  const { isLoaded, isSignedIn, userId, sessionId, getToken } = useAuth();

  if (!isLoaded) return <DueReviewsView state={{ status: 'loading' }} />;
  if (!isSignedIn || !userId || !sessionId) return <Redirect href="/(auth)/sign-in" />;

  // Account/session changes unmount the previous request and discard its data.
  return <AuthenticatedReviews key={`${userId}:${sessionId}`} getToken={getToken} />;
}
