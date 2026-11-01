import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../lib/errors.js";
import { completeUsage, reserveUsage } from "../../usage/usage.service.js";
import { readM4aDurationSec } from "../audio/m4aDuration.js";
import { transcribeAudio } from "../transcription/transcribeAudio.js";
import {
  ALLOWED_AUDIO_MIME_TYPES,
  MAX_DURATION_SEC,
  MAX_TOPIC_LENGTH,
  MIN_DURATION_SEC,
} from "../explanation.const.js";

const bodySchema = z.object({
  topic: z.string().trim().min(1).max(MAX_TOPIC_LENGTH),
});

/**
 * Receives a recorded explanation, transcribes it and saves the transcript.
 * Every check runs before the paid transcription call, and a failed transcription is not counted as a use.
 */
export async function createExplanation(req: Request, res: Response) {
  // 1. Validate input first: a 400 must not consume a use
  const body = bodySchema.safeParse(req.body);
  if (!body.success) throw new AppError("BAD_REQUEST");
  const { topic } = body.data;

  const file = req.file;
  if (!file || !ALLOWED_AUDIO_MIME_TYPES.includes(file.mimetype)) {
    throw new AppError("INVALID_AUDIO");
  }

  const durationSec = readM4aDurationSec(file.buffer);
  if (
    durationSec === null ||
    durationSec < MIN_DURATION_SEC ||
    durationSec > MAX_DURATION_SEC + 1
  ) {
    throw new AppError("INVALID_AUDIO");
  }

  // 2. Reserve: throws AppError (429) when the limit is reached
  const userId = req.user!.id;
  const usageId = await reserveUsage(userId, "ANALYSIS");

  let transcript: string;
  try {
    transcript = await transcribeAudio({
      audio: file.buffer,
      fileName: "explanation.m4a",
      topic,
      durationSec,
    });
  } catch (err) {
    await completeUsage(usageId, false, prisma);
    // Log only the error, never the audio or transcript (spec §72)
    console.error("Transcription failed:", (err as Error).message);
    throw new AppError("TRANSCRIPTION_FAILED");
  }

  if (!transcript) {
    // Silence or unintelligible speech: give the use back
    await completeUsage(usageId, false, prisma);
    throw new AppError("INVALID_AUDIO");
  }

  // 3. Save the transcript and count the use together; the audio buffer is discarded after this request (spec §23)
  const explanation = await prisma.$transaction(async (tx) => {
    const created = await tx.explanation.create({
      data: { userId, topic, transcript },
      select: { id: true, topic: true, transcript: true, createdAt: true },
    });
    await completeUsage(usageId, true, tx);
    return created;
  }).catch(async (err) => {
    await completeUsage(usageId, false, prisma);
    throw err;
  });

  res.status(201).json(explanation);
}
