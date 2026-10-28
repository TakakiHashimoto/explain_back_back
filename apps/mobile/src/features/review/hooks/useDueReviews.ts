import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import type { GetSessionToken } from '../api/api.review';
import { loadDueReviews, type DueReviewsState } from './loadDueReviews';

export function useDueReviews(getToken: GetSessionToken) {
  const [state, setState] = useState<DueReviewsState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    void loadDueReviews(getToken, controller.signal, setState);
    return () => controller.abort();
  }, [getToken, attempt]));

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { state, reload };
}
