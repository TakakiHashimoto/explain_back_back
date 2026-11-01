import ReviewQuestionClient from '@/features/review/screen/ReviewQuestionClient';
import { useLocalSearchParams } from 'expo-router';

export default function ReviewQuestionRoute() {
  const { questionId } = useLocalSearchParams<{ questionId?: string | string[] }>();
  const id = Array.isArray(questionId) ? questionId[0] : questionId;
  return <ReviewQuestionClient questionId={id ?? ''} />;
}
