import { z } from "zod";

// All timestamps are in milliseconds
export const WordTimestampSchema = z.object({
  word: z.string(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1),
});

export const TranscriptSegmentSchema = z.object({
  text: z.string(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
  words: z.array(WordTimestampSchema),
});

export const TranscriptSchema = z.object({
  videoId: z.string(),
  language: z.string(),
  durationMs: z.number().int().nonnegative(),
  segments: z.array(TranscriptSegmentSchema),
});

export const ViralityScoreSchema = z.object({
  segmentIndex: z.number().int().nonnegative(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
  score: z.number().min(0).max(100),
  category: z.enum([
    "technical_benchmark",
    "coding_breakthrough",
    "revenue_reveal",
    "architecture_insight",
    "hot_take",
    "tutorial_moment",
  ]),
  hook: z.string(),
  reasoning: z.string(),
});

export const ClipAnalysisSchema = z.object({
  videoId: z.string(),
  clips: z.array(ViralityScoreSchema),
});

export const CaptionSchema = z.object({
  text: z.string(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
});

export const RenderJobSchema = z.object({
  videoId: z.string(),
  clipIndex: z.number().int().nonnegative(),
  videoSrc: z.string().url(),
  captions: z.array(CaptionSchema),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
});

// Type exports
export type WordTimestamp = z.infer<typeof WordTimestampSchema>;
export type TranscriptSegment = z.infer<typeof TranscriptSegmentSchema>;
export type Transcript = z.infer<typeof TranscriptSchema>;
export type ViralityScore = z.infer<typeof ViralityScoreSchema>;
export type ClipAnalysis = z.infer<typeof ClipAnalysisSchema>;
export type Caption = z.infer<typeof CaptionSchema>;
export type RenderJob = z.infer<typeof RenderJobSchema>;
