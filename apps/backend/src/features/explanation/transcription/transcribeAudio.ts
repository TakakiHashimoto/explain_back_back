import { toFile } from "openai";
import { openai } from "../../../lib/ai/openai.js";
import { DEFAULT_TRANSCRIPTION_MODEL } from "../explanation.const.js";

type TranscribeInput = {
  audio: Buffer;
  fileName: string;
  topic: string;
  durationSec: number;
};

/**
 * Whether to skip the paid OpenAI call and return a fake transcript.
 * Only the exact value "false" enables real calls, so a missing variable never costs money.
 */
export function isTranscriptionDryRun(): boolean {
  return process.env.TRANSCRIPTION_DRY_RUN !== "false";
}

/**
 * Converts the recorded explanation into text.
 * @param input - The validated audio and its topic.
 * @returns The transcript text.
 */
export async function transcribeAudio(input: TranscribeInput): Promise<string> {
  if (isTranscriptionDryRun()) {
    return `[dry run] This is a fake transcript of a ${Math.round(input.durationSec)}-second explanation about ${input.topic}.`;
  }

  const result = await openai.audio.transcriptions.create(
    {
      file: await toFile(input.audio, input.fileName, { type: "audio/mp4" }),
      model: process.env.TRANSCRIPTION_MODEL || DEFAULT_TRANSCRIPTION_MODEL,
      // The app is English only (spec §4.1); fixing the language skips detection and avoids mistranscription.
      language: "en",
      // The topic name helps the model spell technical terms correctly.
      prompt: `The speaker is explaining: ${input.topic}`,
      response_format: "json",
    },
    // A retry would send the same audio again; let the user retry instead.
    { maxRetries: 0 },
  );

  return result.text.trim();
}
