import { useEffect, useRef, useState } from 'react';
import type { GetSessionToken } from '../api/api.review';
import { createReviewSession, type ReviewQuestionState } from './reviewSession';

export function useReviewQuestion(questionId: string, getToken: GetSessionToken) {
  const [state, setState] = useState<ReviewQuestionState>({ status: 'loading' });
  const session = useRef<ReturnType<typeof createReviewSession> | null>(null);
  useEffect(() => {
    const current = createReviewSession(questionId, getToken, setState);
    session.current = current;
    void current.load();
    return () => { current.dispose(); session.current = null; };
  }, [questionId, getToken]);
  return {
    state,
    setAnswer: (answer: string) => session.current?.setAnswer(answer),
    submit: () => { void session.current?.submit(); },
    reload: () => { void session.current?.load(); },
    cancel: () => session.current?.dispose(),
  };
}
