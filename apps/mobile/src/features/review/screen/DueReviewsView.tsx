import { styled } from 'nativewind';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/styles/tokens';
import type { DueReviewsState } from '../hooks/loadDueReviews';

const StyledSafeAreaView = styled(SafeAreaView);

export function DueReviewsView({ state, onReload }: {
  state: DueReviewsState;
  onReload?: () => void;
}) {
  return (
    <StyledSafeAreaView className="app-shell" edges={['top', 'left', 'right']}>
      <ScrollView contentContainerClassName="grow pb-xl">
        {/* The existing web tabs float at the top of the page. */}
        <View className={`screen stack max-w-[600px] ${Platform.OS === 'web' ? 'pt-24' : ''}`}>
          <View className="stack gap-sm">
            <Text accessibilityRole="header" className="headline-lg">Your Reviews</Text>
            <Text className="body-md text-muted">Revisit what you have learned, one question at a time.</Text>
          </View>

          {state.status === 'loading' && (
            <View className="card row" accessibilityLiveRegion="polite">
              <ActivityIndicator color={colors.primary} accessibilityLabel="Loading reviews" />
              <Text className="body-md">Loading your reviews…</Text>
            </View>
          )}

          {state.status === 'error' && (
            <View className="card stack" accessibilityLiveRegion="polite">
              <Text accessibilityRole="header" className="headline-sm">Could not load reviews</Text>
              <Text accessibilityRole="alert" className="body-md text-muted">{state.message}</Text>
              <Pressable accessibilityRole="button" onPress={onReload} className="btn-primary active:bg-primary-pressed">
                <Text className="btn-primary-text">Try again</Text>
              </Pressable>
            </View>
          )}

          {state.status === 'success' && (
            <View className="stack">
              <Text className="body-md" accessibilityLiveRegion="polite">
                {state.reviews.length === 1 ? '1 review ready' : `${state.reviews.length} reviews ready`}
              </Text>
              {state.reviews.length === 0 ? (
                <View className="card stack gap-sm">
                  <Text accessibilityRole="header" className="headline-sm">You’re all caught up</Text>
                  <Text className="body-md text-muted">No reviews are due right now. Check back later.</Text>
                </View>
              ) : (
                state.reviews.map((review) => (
                  <View key={review.questionId} className="card stack gap-sm">
                    <Text accessibilityRole="header" className="label-lg text-primary">
                      {review.question.knowledgeGap.concept}
                    </Text>
                    <Text className="headline-sm">{review.question.question}</Text>
                  </View>
                ))
              )}
              <Pressable accessibilityRole="button" onPress={onReload} className="btn-secondary">
                <Text className="btn-secondary-text">Refresh reviews</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </StyledSafeAreaView>
  );
}
