import { useAuth } from '@clerk/expo';
import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { router } from 'expo-router';
import { styled } from 'nativewind';
import { useRef, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { ApiError } from '@/lib/api-fetch';
import { colors } from '@/styles/tokens';
import { uploadExplanation } from '../api/api.explanation';
import {
  MAX_RECORDING_SEC,
  MIN_RECORDING_SEC,
  SPEECH_RECORDING_OPTIONS,
} from '../recording/recordingOptions';
import { Explanation } from '../types';

// SafeAreaView is a third-party component, so explicitly enable className.
const StyledSafeAreaView = styled(SafeAreaView);

type Phase =
  | { kind: 'idle' }
  | { kind: 'recording' }
  | { kind: 'recorded'; uri: string; seconds: number }
  | { kind: 'uploading'; uri: string; seconds: number }
  | { kind: 'done'; explanation: Explanation }
  | { kind: 'failed'; uri: string; seconds: number; message: string };

function formatTime(totalSec: number): string {
  const sec = Math.floor(totalSec);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

/** Maps a failed upload to a message; the recording is kept so the user can retry without speaking again. */
function uploadErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'FREE_LIMIT_REACHED':
        return "You've used all free explanations this week.";
      case 'USAGE_LIMIT_REACHED':
        return "You've reached this week's limit.";
      case 'INVALID_AUDIO':
        return `We couldn't hear an explanation. Record between ${MIN_RECORDING_SEC} seconds and ${MAX_RECORDING_SEC / 60} minutes.`;
      case 'UNAUTHENTICATED':
        return 'Your session expired. Please sign in again.';
    }
    return 'Something went wrong on our side. Please try again.';
  }
  return 'Upload failed. Check your connection and try again.';
}

/**
 * Asks for the microphone with the OS dialog, the same way notifications ask from the reminders switch.
 * Once the OS will no longer show the dialog (denied before), it offers the app settings instead.
 */
async function ensureMicPermission(): Promise<boolean> {
  const current = await getRecordingPermissionsAsync();
  if (current.granted) return true;
  if (current.canAskAgain) return (await requestRecordingPermissionsAsync()).granted;

  Alert.alert(
    'Microphone access is off',
    'Turn on the microphone for Explain It Back in Settings to record your explanation.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings() },
    ],
  );
  return false;
}

/** Records a spoken explanation, uploads it and shows the transcript (design "Record explanation"). */
export default function RecordExplanationScreen() {
  const { getToken } = useAuth();
  const [topic, setTopic] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  // Guards against double taps sending the same recording twice (spec §59.11)
  const uploadingRef = useRef(false);
  const startedAtRef = useRef(0);

  /** Moves a finished recording (manual stop or the forDuration limit) to the "recorded" phase. */
  const finishRecording = (uri: string | null) => {
    const seconds = Math.min((Date.now() - startedAtRef.current) / 1000, MAX_RECORDING_SEC);
    setPhase((prev) => {
      if (prev.kind !== 'recording') return prev;
      return uri ? { kind: 'recorded', uri, seconds } : { kind: 'idle' };
    });
    setAudioModeAsync({ allowsRecording: false });
  };

  const recorder = useAudioRecorder(SPEECH_RECORDING_OPTIONS, (status) => {
    if (status.isFinished) finishRecording(status.url);
  });
  const recorderState = useAudioRecorderState(recorder, 250);

  const elapsedSec = recorderState.durationMillis / 1000;

  const stopRecording = async () => {
    await recorder.stop();
    finishRecording(recorder.uri);
  };

  const startRecording = async () => {
    if (!(await ensureMicPermission())) return;
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    await recorder.prepareToRecordAsync();
    // Stops on its own at the limit; the server rejects anything longer anyway.
    recorder.record({ forDuration: MAX_RECORDING_SEC });
    startedAtRef.current = Date.now();
    setPhase({ kind: 'recording' });
  };

  const upload = async (uri: string, seconds: number) => {
    if (uploadingRef.current) return;
    uploadingRef.current = true;
    setPhase({ kind: 'uploading', uri, seconds });
    try {
      const explanation = await uploadExplanation(getToken, { recordingUri: uri, topic: topic.trim() });
      setPhase({ kind: 'done', explanation });
    } catch (error) {
      setPhase({ kind: 'failed', uri, seconds, message: uploadErrorMessage(error) });
    } finally {
      uploadingRef.current = false;
    }
  };

  const topicReady = topic.trim().length > 0;
  const isRecording = phase.kind === 'recording';
  const canRecord = topicReady && (phase.kind === 'idle' || phase.kind === 'recorded' || phase.kind === 'failed');

  return (
    <StyledSafeAreaView className="app-shell" edges={['top', 'left', 'right', 'bottom']}>
      <View className="self-center px-margin py-sm w-full max-w-[600px] row-between">
        <Text className="headline-sm">Explain it back</Text>
        <Pressable
          accessibilityLabel="Close"
          accessibilityRole="button"
          className="justify-center items-center w-11 h-11"
          disabled={isRecording || phase.kind === 'uploading'}
          onPress={() => router.back()}
        >
          <Icon name="close" size={22} />
        </Pressable>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="w-full max-w-[600px] self-center gap-lg px-margin pt-md pb-lg"
      >
        <View className="gap-xs">
          <Text className="text-muted uppercase label-sm">Topic</Text>
          <TextInput
            className="input"
            placeholder="e.g. React useEffect"
            placeholderTextColor={colors.textMuted}
            value={topic}
            onChangeText={setTopic}
            maxLength={200}
            editable={phase.kind === 'idle' || phase.kind === 'recorded' || phase.kind === 'failed'}
          />
        </View>

        {phase.kind === 'done' ? (
          <View className="gap-md">
            <View className="gap-xs card">
              <Text className="text-muted uppercase label-sm">What you said</Text>
              <Text className="body-md">{phase.explanation.transcript}</Text>
            </View>
            <Pressable
              className="btn-secondary"
              accessibilityRole="button"
              onPress={() => setPhase({ kind: 'idle' })}
            >
              <Text className="btn-secondary-text">Record another</Text>
            </Pressable>
          </View>
        ) : (
          <View className="items-center gap-md">
            <Text className="display-lg-mobile">
              {formatTime(isRecording ? elapsedSec : 'seconds' in phase ? phase.seconds : 0)}
            </Text>
            <Text className="text-muted label-sm">
              {isRecording
                ? `Up to ${formatTime(MAX_RECORDING_SEC)}. Tap to stop.`
                : topicReady
                  ? 'Tap the microphone and explain it in your own words.'
                  : 'Enter a topic to start.'}
            </Text>

            <Pressable
              accessibilityLabel={isRecording ? 'Stop recording' : 'Start recording'}
              accessibilityRole="button"
              className={`record-button ${isRecording ? 'is-recording' : ''}`}
              disabled={!isRecording && !canRecord}
              onPress={isRecording ? stopRecording : startRecording}
            >
              <Icon name="mic" size={32} color={colors.onPrimary} />
            </Pressable>

            {phase.kind === 'failed' && (
              <Text className="text-center chip-danger-text body-md">{phase.message}</Text>
            )}

            {(phase.kind === 'recorded' || phase.kind === 'uploading' || phase.kind === 'failed') && (
              <Pressable
                className="w-full btn-primary"
                accessibilityRole="button"
                disabled={phase.kind === 'uploading' || phase.seconds < MIN_RECORDING_SEC}
                onPress={() => upload(phase.uri, phase.seconds)}
              >
                <Text className="btn-primary-text">
                  {phase.kind === 'uploading'
                    ? 'Uploading explanation...'
                    : phase.kind === 'failed'
                      ? 'Try again'
                      : phase.seconds < MIN_RECORDING_SEC
                        ? `Too short. Speak for at least ${MIN_RECORDING_SEC} seconds.`
                        : 'Send explanation'}
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
    </StyledSafeAreaView>
  );
}
