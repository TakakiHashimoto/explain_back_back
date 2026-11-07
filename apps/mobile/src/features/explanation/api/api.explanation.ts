import { File } from 'expo-file-system';

import { ApiError, GetToken } from '@/lib/api-fetch';
import { Explanation } from '../types';

/**
 * Uploads a recorded explanation as multipart/form-data and returns the saved transcript.
 * apiFetch always sends JSON, so this request builds its own headers and lets fetch set the multipart boundary.
 */
export async function uploadExplanation(
  getToken: GetToken,
  input: { recordingUri: string; topic: string },
): Promise<Explanation> {
  const form = new FormData();
  form.append('topic', input.topic);
  // expo/fetch (the global fetch since SDK 57) rejects React Native's { uri } parts with
  // "Unsupported FormDataPart implementation"; it reads parts that have bytes() instead.
  const recording = new File(input.recordingUri);
  form.append('audio', {
    name: 'explanation.m4a',
    type: 'audio/m4a',
    bytes: async () => new Uint8Array(await recording.arrayBuffer()),
  } as unknown as Blob);

  const token = await getToken();
  const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/v1/explanations`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  const body = await res.json();
  if (!res.ok) {
    throw new ApiError(res.status, body.error.code, body.error.message);
  }
  return body as Explanation;
}

/** Idempotent recovery: existing questions are reused and only missing ones generated. */
export async function retryReviewQuestionGeneration(getToken: GetToken, gapId: string): Promise<void> {
  const token = await getToken();
  const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/v1/knowledge-gaps/${encodeURIComponent(gapId)}/review-questions`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error(`Review question generation failed: ${res.status}`);
  }
}
