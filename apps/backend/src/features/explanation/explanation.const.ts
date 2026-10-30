// Recording limits (spec §18, §20). Checked before any paid API call.
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
export const MIN_DURATION_SEC = 3;
export const MAX_DURATION_SEC = 120;

// m4a (AAC) only. Clients report m4a with different MIME types.
export const ALLOWED_AUDIO_MIME_TYPES = [
  "audio/m4a",
  "audio/x-m4a",
  "audio/mp4",
  "audio/aac",
  "video/mp4",
  "application/octet-stream",
];

export const MAX_TOPIC_LENGTH = 200;

// Cheapest OpenAI transcription model at the time of writing; override with TRANSCRIPTION_MODEL.
export const DEFAULT_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";
