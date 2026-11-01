import { styled } from 'nativewind';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/styles/tokens';
import type { ReviewQuestionState } from '../hooks/reviewSession';

const StyledSafeAreaView = styled(SafeAreaView);

export function ReviewQuestionView({ state, onAnswerChange, onSubmit, onReload, onReturn }: {
  state: ReviewQuestionState;
  onAnswerChange?: (answer: string) => void;
  onSubmit?: () => void;
  onReload?: () => void;
  onReturn?: () => void;
}) {
  const submission = state.status === 'ready' ? state.submission : undefined;
  const pending = submission?.status === 'submitting';
  const uncertain = submission?.status === 'error' && submission.uncertain;
  const result = submission?.status === 'success' ? submission.result : undefined;
  return (
    <StyledSafeAreaView testID="screen-review-question" className="app-shell" edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="grow pb-xl">
          <View className="screen stack max-w-[600px]">
            <View className="stack gap-sm">
              <Text accessibilityRole="header" className="headline-lg">Explain It Back</Text>
              <Text className="label-sm text-primary">REVIEW</Text>
            </View>
            {state.status === 'loading' && <View className="card row" accessibilityLiveRegion="polite">
              <ActivityIndicator color={colors.primary} accessibilityLabel="Loading question" />
              <Text className="body-md">Loading your question…</Text>
            </View>}
            {state.status === 'error' && <View className="card stack">
              <Text accessibilityRole="alert" className="body-md">{state.message}</Text>
              <Pressable testID="review-question-retry" accessibilityRole="button" onPress={onReload} className="btn-primary">
                <Text className="btn-primary-text">Try again</Text>
              </Pressable>
            </View>}
            {state.status === 'ready' && <>
              <Text className="label-lg text-primary">{state.question.knowledgeGap.concept}</Text>
              <View className="card border-0 gap-sm">
                <Text className="label-sm text-primary tracking-[1px]">THE CORE QUESTION</Text>
                <Text accessibilityRole="header" className="headline-md">{state.question.question}</Text>
                <Text className="body-sm text-muted">Answer from memory in your own words.</Text>
              </View>
              {!result && <>
                <View className="card border-0 gap-sm">
                  <Text className="label-sm">Your Mental Model</Text>
                  <TextInput testID="review-question-answer-input" accessibilityLabel="Your answer" multiline textAlignVertical="top"
                    value={state.answer} onChangeText={onAnswerChange} editable={!pending && !uncertain}
                    placeholder="Explain your answer here…" placeholderTextColor={colors.placeholder}
                    className="textarea text-[15px] leading-[22px] bg-surface-muted border-0 p-[14px]" />
                  <Text className="label-sm text-muted">{state.answer.length} characters</Text>
                </View>
                {submission?.status === 'error' && <Text accessibilityRole="alert" className="body-md text-danger-text">{submission.message}</Text>}
                {pending && <View className="card stack" accessibilityLiveRegion="polite">
                  <ActivityIndicator color={colors.primary} accessibilityLabel="Evaluating answer" />
                  <Text className="body-md">Evaluating your answer…</Text>
                  <Text className="body-sm text-muted">This can take up to two minutes. Leaving this screen does not cancel saving your answer.</Text>
                </View>}
                <Pressable testID="review-question-submit" accessibilityRole="button" onPress={onSubmit} disabled={pending || uncertain}
                  accessibilityState={{ disabled: pending || uncertain, busy: pending }}
                  className={`btn-primary shadow-card ${pending || uncertain ? 'opacity-50' : ''}`}>
                  <Text className="btn-primary-text">{pending ? 'Evaluating…' : 'Submit Answer'}</Text>
                </Pressable>
              </>}
              {result && <View testID="review-question-result" className="card stack" accessibilityLiveRegion="polite">
                <Text accessibilityRole="header" className="headline-md">Your feedback</Text>
                <Text testID="review-question-score" className="headline-lg text-primary">{result.attempt.score} / 100</Text>
                <Text className="label-lg">{result.attempt.correct ? 'Correct' : 'Not yet correct'}</Text>
                <Text className="body-md">{result.attempt.feedback}</Text>
                <Text className="body-md">Next review: {new Date(result.reviewSchedule.nextReviewAt).toLocaleString()}</Text>
                <Text className="body-sm text-muted">Review interval: {result.reviewSchedule.intervalDays} {result.reviewSchedule.intervalDays === 1 ? 'day' : 'days'}</Text>
                <Text className="body-sm text-muted">Your answer and next review have been saved.</Text>
              </View>}
            </>}
            <Pressable testID="review-question-back" accessibilityRole="button" onPress={onReturn} className="btn-secondary">
              <Text className="btn-secondary-text">Back to Review</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </StyledSafeAreaView>
  );
}
