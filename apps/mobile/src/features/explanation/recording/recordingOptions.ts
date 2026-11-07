import { AudioQuality, IOSOutputFormat, type RecordingOptions } from 'expo-audio';

// Must match the backend limits (apps/backend/src/features/explanation/explanation.const.ts).
export const MIN_RECORDING_SEC = 3;
export const MAX_RECORDING_SEC = 120;

/**
 * Speech-only m4a: mono, 16 kHz, 32 kbps AAC.
 * Speech recognition needs no more than this, and 2 minutes stay around 0.5 MB, so uploads are fast on mobile data.
 */
export const SPEECH_RECORDING_OPTIONS: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  android: {
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
  },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.MEDIUM,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 32000,
  },
};
