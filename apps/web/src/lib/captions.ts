/**
 * Caption extraction and timestamp rebasing for Remotion rendering.
 * Takes a transcript + clip boundaries and produces rebased caption phrases.
 */

import type { Transcript, ViralityScore, Caption } from "@clipper/shared";

const MAX_WORDS_PER_CAPTION = 5;
const MIN_WORDS_PER_CAPTION = 2;
const PAUSE_THRESHOLD_MS = 300; // break caption on gaps > 300ms

interface WordWithTiming {
  word: string;
  startMs: number;
  endMs: number;
}

/**
 * Extract words from transcript that fall within a clip's time range,
 * group them into caption phrases, and rebase timestamps to start at 0.
 */
export function extractCaptions(
  transcript: Transcript,
  clip: Pick<ViralityScore, "startMs" | "endMs">
): Caption[] {
  // Collect all words within the clip's time range
  const words: WordWithTiming[] = [];

  for (const segment of transcript.segments) {
    // Skip segments entirely outside the clip range
    if (segment.endMs <= clip.startMs || segment.startMs >= clip.endMs) {
      continue;
    }

    for (const w of segment.words) {
      if (w.startMs >= clip.startMs && w.endMs <= clip.endMs) {
        words.push({
          word: w.word,
          startMs: w.startMs - clip.startMs, // rebase to 0
          endMs: w.endMs - clip.startMs,
        });
      }
    }
  }

  if (words.length === 0) return [];

  // Group words into caption phrases
  const captions: Caption[] = [];
  let groupStart = 0;

  for (let i = 1; i <= words.length; i++) {
    const groupLen = i - groupStart;
    const isLastWord = i === words.length;
    const prevWord = words[i - 1];
    const nextWord = i < words.length ? words[i] : null;

    // Determine if we should break here
    const hasLongPause =
      nextWord !== null && nextWord.startMs - prevWord.endMs > PAUSE_THRESHOLD_MS;
    const hitMaxWords = groupLen >= MAX_WORDS_PER_CAPTION;
    const endsWithPunctuation = /[.!?,;:]$/.test(prevWord.word);

    const shouldBreak =
      isLastWord ||
      hitMaxWords ||
      (groupLen >= MIN_WORDS_PER_CAPTION && (hasLongPause || endsWithPunctuation));

    if (shouldBreak) {
      const groupWords = words.slice(groupStart, i);
      captions.push({
        text: groupWords.map((w) => w.word).join(" "),
        startMs: groupWords[0].startMs,
        endMs: groupWords[groupWords.length - 1].endMs,
      });
      groupStart = i;
    }
  }

  return captions;
}
