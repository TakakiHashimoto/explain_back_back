import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { styled } from 'nativewind';
import { Image, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/styles/tokens';
import { knowledgeGap, reviewQuestion } from '../data/dummy';

// SafeAreaView is a third-party component, so explicitly enable className.
const StyledSafeAreaView = styled(SafeAreaView);

const symbols = {
  close: { ios: 'xmark', android: 'close', web: 'close' },
  notifications: { ios: 'bell', android: 'notifications', web: 'notifications' },
  error: { ios: 'exclamationmark.circle.fill', android: 'error', web: 'error' },
  psychology: { ios: 'brain.head.profile', android: 'psychology', web: 'psychology' },
  lightbulb: { ios: 'lightbulb', android: 'lightbulb', web: 'lightbulb' },
  edit: { ios: 'square.and.pencil', android: 'edit_note', web: 'edit_note' },
  lock: { ios: 'lock', android: 'lock', web: 'lock' },
  mic: { ios: 'mic', android: 'mic', web: 'mic' },
  arrow: { ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' },
  verified: { ios: 'checkmark.seal', android: 'verified', web: 'verified' },
  tips: { ios: 'lightbulb.max', android: 'tips_and_updates', web: 'tips_and_updates' },
  home: { ios: 'house', android: 'home', web: 'home' },
  topics: { ios: 'book', android: 'menu_book', web: 'menu_book' },
  review: { ios: 'arrow.triangle.2.circlepath', android: 'sync', web: 'sync' },
  progress: { ios: 'chart.line.uptrend.xyaxis', android: 'trending_up', web: 'trending_up' },
} satisfies Record<string, SymbolViewProps['name']>;

function Icon({
  name,
  size = 20,
  color = colors.textMuted,
}: {
  name: keyof typeof symbols;
  size?: number;
  color?: string;
}) {
  return <SymbolView name={symbols[name]} size={size} tintColor={color} />;
}

const tabs = [
  { icon: 'home', label: 'Home' },
  { icon: 'topics', label: 'Topics' },
  { icon: 'mic', label: 'Speak' },
  { icon: 'review', label: 'Review' },
  { icon: 'progress', label: 'Progress' },
] as const;

// Static design preview; questionId is reserved for the existing route contract.
const ReviewQuestionClient = (_props: { questionId: string }) => {
  return (
    <StyledSafeAreaView className="app-shell" edges={['top', 'left', 'right', 'bottom']}>
      <View className="bg-background shadow-card">
        <View className="row-between w-full max-w-[600px] self-center min-h-16 px-margin py-sm gap-sm">
          <View className="row flex-1 min-w-0">
            <Image
              accessibilityLabel="Explain It Back App Icon"
              source={{
                uri: 'https://lh3.googleusercontent.com/aida/AEtjO1Xrx4o-5LYSgaW1a8hL7lndjAOpG0opvA5jGCeaPYocajwrEBlUY4PM6GT4_9T2OcoOhW4hKkc3bjFC53cnCn1zPNaQ3l6KwbqCBhzh8Ze7aBUPxArY-1bLuvrUut45TJzZ-JMtBpQcDkmvFvNKbbgUMVi0B2BOZ5ugUyn0QwVxh7CsIIh2Tlbv8dENcNsGzGoI9MXOOoZvt8it8YswlXlbhR_qidu3D_HgX97LVhb46d-BoV5DBxdDPg8',
              }}
              className="h-8 w-8"
              resizeMode="contain"
            />
            <View className="flex-1 min-w-0">
              <Text className="headline-sm">Explain It Back</Text>
              <Text className="label-sm text-muted">Review</Text>
            </View>
          </View>
          <View className="row">
            <View accessibilityLabel="Notifications" className="h-11 w-11 items-center justify-center">
              <Icon name="notifications" size={22} />
            </View>
            <Image
              accessibilityLabel="Profile"
              source={{
                uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuClpeK1EFHWl5EM1GfCr5rRZdZwgMhs9ptUrg-3wEJUxT0-aJzbuEu6nt_IfFuzLQQGqCbZnW9as3VagrfQDqaSyHBrqXtn5qJLPxpl4tg584etrtNIYK_Rtbew3q6k8jpW4_qfgqBO4rqbhMvUkngvCZSZnlFm6SUYpxTRtKWNWd_b8sAgF0SEYc94XxjmKNXkPkCUM3VhVawIORLqraEzvIODJdNo8xRtJmQjQRTcOBVppOIQOXTn',
              }}
              className="h-8 w-8 rounded-full"
            />
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="grow pb-xl">
        <View className="screen stack max-w-[600px]">
          <View className="row-between">
            <View accessibilityLabel="Cancel session" className="review-circle">
              <Icon name="close" />
            </View>
            <View className="flex-1 min-w-0 items-center gap-xs">
              <View className="row">
                <View className="h-2 w-2 rounded-full bg-primary" />
                <Text className="label-md">React useEffect</Text>
              </View>
              <Text className="label-sm text-muted text-center">Active Mental Model Check</Text>
            </View>
            <View accessibilityLabel="Targeted recall item 1 of 3" className="review-circle">
              <Text className="label-sm text-primary">1/3</Text>
            </View>
          </View>

          <View className="chip-danger border-0 px-3 py-1.5 max-w-full">
            <Icon name="error" size={16} color={colors.danger} />
            <Text className="label-sm text-danger-text shrink tracking-[-0.2px]">
              Reviewing Misconception: {knowledgeGap.concept}
            </Text>
          </View>

          <View className="card border-0 gap-sm">
            <View className="row-between">
              <Text className="label-sm text-primary tracking-[1px]">THE CORE QUESTION</Text>
              <Icon name="psychology" color={colors.primary} />
            </View>
            <Text accessibilityRole="header" className="headline-md">
              {reviewQuestion.question}
            </Text>
            <View className="row bg-surface-muted p-[10px] rounded-md">
              <Icon name="lightbulb" size={18} color={colors.primary} />
              <Text className="body-sm text-muted flex-1 min-w-0">
                Answer from memory in your own words. Explain the exact mechanism rather than just
                syntax.
              </Text>
            </View>
          </View>

          <View className="card border-0 gap-sm">
            <View className="row-between flex-wrap gap-sm">
              <View className="row">
                <Icon name="edit" size={18} color={colors.primary} />
                <Text className="label-sm">Your Mental Model</Text>
              </View>
              <View className="row gap-xs">
                <Icon name="lock" size={14} color={colors.placeholder} />
                <Text className="label-sm text-placeholder">No hints active</Text>
              </View>
            </View>
            <TextInput
              accessibilityLabel="Your Mental Model"
              multiline
              editable={false}
              textAlignVertical="top"
              placeholder="Explain your answer here... e.g., what does React compare, which JavaScript algorithm is used, and what happens to object references?"
              placeholderTextColor={colors.placeholder}
              className="textarea text-[15px] leading-[22px] bg-surface-muted border-0 p-[14px]"
            />
            <View className="row-between flex-wrap gap-sm pt-xs">
              <Text className="label-sm text-muted">
                <Text className="text-text font-semibold">0</Text> / 600 words &amp; chars
              </Text>
              <View className="row rounded-full px-3 py-1.5 bg-surface-muted gap-[6px] shadow-card">
                <Icon name="mic" size={18} color={colors.primary} />
                <Text className="label-sm">Speak answer</Text>
              </View>
            </View>
          </View>

          <View className="stack gap-sm pt-sm">
            <View className="btn-primary shadow-card">
              <Text className="btn-primary-text">Submit Answer</Text>
              <Icon name="arrow" color={colors.onPrimary} />
            </View>
            <View className="row justify-center gap-xs">
              <Icon name="verified" size={15} color={colors.placeholder} />
              <Text className="label-sm text-muted shrink text-center">
                Evaluated against accurate mental model criteria
              </Text>
            </View>
          </View>

          <View className="stack gap-sm bg-surface-muted rounded-md p-md mt-sm">
            <View className="row-between flex-wrap gap-sm">
              <View className="row">
                <Icon name="tips" size={18} color={colors.warning} />
                <Text className="label-md">Why is this item flagged?</Text>
              </View>
              <View className="bg-warning-soft rounded-sm px-sm py-0.5">
                <Text className="label-sm text-warning-text">Past Gap</Text>
              </View>
            </View>
            <Text className="body-sm text-muted">
              In your last session, you mentioned React does a &quot;deep check on objects&quot;.
              Recall whether{' '}
              <Text className="font-mono text-[12px] bg-divider text-secondary">Object.is</Text>{' '}
              verifies values or memory references.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View className="px-margin py-sm">
        <View className="w-full max-w-[448px] self-center min-h-16 flex-row items-center px-sm rounded-full bg-surface shadow-floating">
          {tabs.map(({ icon, label }) =>
            icon === 'mic' ? (
              <View
                key={icon}
                accessibilityLabel="Speak"
                className="h-[52px] w-[52px] -mt-5 mx-xs items-center justify-center rounded-full bg-primary shadow-floating"
              >
                <Icon name="mic" size={26} color={colors.onPrimary} />
              </View>
            ) : (
              <View
                key={icon}
                className="flex-1 min-h-16 items-center justify-center gap-0.5"
                accessibilityLabel={icon === 'review' ? 'Review, 3 items' : label}
              >
                <View>
                  <Icon
                    name={icon}
                    size={22}
                    color={icon === 'review' ? colors.primary : colors.textMuted}
                  />
                  {icon === 'review' && (
                    <View className="absolute -top-1 -right-2 h-4 w-4 rounded-full bg-danger items-center justify-center">
                      <Text className="label-sm text-on-primary text-[10px] leading-[12px]">3</Text>
                    </View>
                  )}
                </View>
                <Text className={`label-sm ${icon === 'review' ? 'text-primary' : 'text-muted'}`}>
                  {label}
                </Text>
              </View>
            ),
          )}
        </View>
      </View>
    </StyledSafeAreaView>
  );
};

export default ReviewQuestionClient;
