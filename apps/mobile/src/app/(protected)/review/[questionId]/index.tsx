import ReviewQuestionClient from '@/features/review/screen/ReviewQuestionClient';
import { useLocalSearchParams } from 'expo-router';

const index = () => {
  const { qeustionId } = useLocalSearchParams();
  // fetch the question with tanstack and store
  // for now using dummy data

  const id = Array.isArray(qeustionId) ? qeustionId[0] : qeustionId;

  return <ReviewQuestionClient questionId={id} />;
};

export default index;
