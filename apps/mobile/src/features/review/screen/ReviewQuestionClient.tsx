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
        <View className="self-center gap-sm px-margin py-sm w-full max-w-[600px] min-h-16 row-between">
          <View className="flex-1 min-w-0 row">
            <Image
              accessibilityLabel="Explain It Back App Icon"
              source={{
                uri: 'https://lh3.googleusercontent.com/aida/AEtjO1Xrx4o-5LYSgaW1a8hL7lndjAOpG0opvA5jGCeaPYocajwrEBlUY4PM6GT4_9T2OcoOhW4hKkc3bjFC53cnCn1zPNaQ3l6KwbqCBhzh8Ze7aBUPxArY-1bLuvrUut45TJzZ-JMtBpQcDkmvFvNKbbgUMVi0B2BOZ5ugUyn0QwVxh7CsIIh2Tlbv8dENcNsGzGoI9MXOOoZvt8it8YswlXlbhR_qidu3D_HgX97LVhb46d-BoV5DBxdDPg8',
              }}
              className="w-8 h-8"
              resizeMode="contain"
            />
            <View className="flex-1 min-w-0">
              <Text className="headline-sm">Explain It Back</Text>
              <Text className="text-muted label-sm">Review</Text>
            </View>
          </View>
          <View className="row">
            <View accessibilityLabel="Notifications" className="justify-center items-center w-11 h-11">
              <Icon name="notifications" size={22} />
            </View>
            <Image
              accessibilityLabel="Profile"
              source={{
                uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuClpeK1EFHWl5EM1GfCr5rRZdZwgMhs9ptUrg-3wEJUxT0-aJzbuEu6nt_IfFuzLQQGqCbZnW9as3VagrfQDqaSyHBrqXtn5qJLPxpl4tg584etrtNIYK_Rtbew3q6k8jpW4_qfgqBO4rqbhMvUkngvCZSZnlFm6SUYpxTRtKWNWd_b8sAgF0SEYc94XxjmKNXkPkCUM3VhVawIORLqraEzvIODJdNo8xRtJmQjQRTcOBVppOIQOXTn',
              }}
              className="rounded-full w-8 h-8"
            />
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="grow pb-xl">
        <View className="max-w-[600px] screen stack">
          <View className="row-between">
            <View accessibilityLabel="Cancel session" className="review-circle">
              <Icon name="close" />
            </View>
            <View className="flex-1 items-center gap-xs min-w-0">
              <View className="row">
                <View className="bg-primary rounded-full w-2 h-2" />
                <Text className="label-md">React useEffect</Text>
              </View>
              <Text className="text-muted text-center label-sm">Active Mental Model Check</Text>
            </View>
            <View accessibilityLabel="Targeted recall item 1 of 3" className="review-circle">
              <Text className="text-primary label-sm">1/3</Text>
            </View>
          </View>

          <View className="px-3 py-1.5 border-0 max-w-full chip-danger">
            <Icon name="error" size={16} color={colors.danger} />
            <Text className="text-danger-text tracking-[-0.2px] label-sm shrink">
              Reviewing Misconception: {knowledgeGap.concept}
            </Text>
          </View>

          <View className="gap-sm border-0 card">
            <View className="row-between">
              <Text className="text-primary tracking-[1px] label-sm">THE CORE QUESTION</Text>
              <Icon name="psychology" color={colors.primary} />
            </View>
            <Text accessibilityRole="header" className="headline-md">
              {reviewQuestion.question}
            </Text>
            <View className="bg-surface-muted p-[10px] rounded-md row">
              <Icon name="lightbulb" size={18} color={colors.primary} />
              <Text className="flex-1 min-w-0 text-muted body-sm">
                Answer from memory in your own words. Explain the exact mechanism rather than just
                syntax.
              </Text>
            </View>
          </View>

          <View className="gap-sm border-0 card">
            <View className="flex-wrap gap-sm row-between">
              <View className="row">
                <Icon name="edit" size={18} color={colors.primary} />
                <Text className="label-sm">Your Mental Model</Text>
              </View>
              <View className="gap-xs row">
                <Icon name="lock" size={14} color={colors.placeholder} />
                <Text className="text-placeholder label-sm">No hints active</Text>
              </View>
            </View>
            <TextInput
              accessibilityLabel="Your Mental Model"
              multiline
              editable={false}
              textAlignVertical="top"
              placeholder="Explain your answer here... e.g., what does React compare, which JavaScript algorithm is used, and what happens to object references?"
              placeholderTextColor={colors.placeholder}
              className="bg-surface-muted p-[14px] border-0 text-[15px] leading-[22px] textarea"
            />
            <View className="flex-wrap gap-sm pt-xs row-between">
              <Text className="text-muted label-sm">
                <Text className="font-semibold text-text">0</Text> / 600 words &amp; chars
              </Text>
              <View className="gap-[6px] bg-surface-muted shadow-card px-3 py-1.5 rounded-full row">
                <Icon name="mic" size={18} color={colors.primary} />
                <Text className="label-sm">Speak answer</Text>
              </View>
            </View>
          </View>

          <View className="gap-sm pt-sm stack">
            <View className="shadow-card btn-primary">
              <Text className="btn-primary-text">Submit Answer</Text>
              <Icon name="arrow" color={colors.onPrimary} />
            </View>
            <View className="justify-center gap-xs row">
              <Icon name="verified" size={15} color={colors.placeholder} />
              <Text className="text-muted text-center label-sm shrink">
                Evaluated against accurate mental model criteria
              </Text>
            </View>
          </View>

          <View className="gap-sm bg-surface-muted mt-sm p-md rounded-md stack">
            <View className="flex-wrap gap-sm row-between">
              <View className="row">
                <Icon name="tips" size={18} color={colors.warning} />
                <Text className="label-md">Why is this item flagged?</Text>
              </View>
              <View className="bg-warning-soft px-sm py-0.5 rounded-sm">
                <Text className="text-warning-text label-sm">Past Gap</Text>
              </View>
            </View>
            <Text className="text-muted body-sm">
              In your last session, you mentioned React does a &quot;deep check on objects&quot;.
              Recall whether{' '}
              <Text className="bg-divider font-mono text-[12px] text-secondary">Object.is</Text>{' '}
              verifies values or memory references.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View className="px-margin py-sm">
        <View className="flex-row items-center self-center bg-surface shadow-floating px-sm rounded-full w-full max-w-[448px] min-h-16">
          {tabs.map(({ icon, label }) =>
            icon === 'mic' ? (
              <View
                key={icon}
                accessibilityLabel="Speak"
                className="justify-center items-center bg-primary shadow-floating mx-xs -mt-5 rounded-full w-[52px] h-[52px]"
              >
                <Icon name="mic" size={26} color={colors.onPrimary} />
              </View>
            ) : (
              <View
                key={icon}
                className="flex-1 justify-center items-center gap-0.5 min-h-16"
                accessibilityLabel={icon === 'review' ? 'Review, 3 items' : label}
              >
                <View>
                  <Icon
                    name={icon}
                    size={22}
                    color={icon === 'review' ? colors.primary : colors.textMuted}
                  />
                  {icon === 'review' && (
                    <View className="-top-1 -right-2 absolute justify-center items-center bg-danger rounded-full w-4 h-4">
                      <Text className="text-[10px] text-on-primary leading-[12px] label-sm">3</Text>
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
