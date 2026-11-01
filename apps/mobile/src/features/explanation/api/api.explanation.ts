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
  // React Native reads the file from the uri; the cast is needed because the DOM typing expects a Blob.
  form.append('audio', {
    uri: input.recordingUri,
    name: 'explanation.m4a',
    type: 'audio/m4a',
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
