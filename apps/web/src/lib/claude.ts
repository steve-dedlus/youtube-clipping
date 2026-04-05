/**
 * Claude API integration for virality scoring.
 * Takes a transcript and returns ranked clip candidates.
 */

import Anthropic from "@anthropic-ai/sdk";
import { ClipAnalysisSchema } from "@clipper/shared";
import type { Transcript, ClipAnalysis } from "@clipper/shared";

import {
  VIRALITY_SCORE_SYSTEM_PROMPT,
  VIRALITY_SCORE_USER_PROMPT,
} from "./prompts";

const anthropic = new Anthropic();

/**
 * Format transcript segments into timestamped text for the LLM prompt.
 * Example: "[00:05:230] The inference time dropped to 50ms..."
 */
function formatTranscriptForPrompt(transcript: Transcript): string {
  return transcript.segments
    .map((seg) => {
      const mins = Math.floor(seg.startMs / 60000);
      const secs = Math.floor((seg.startMs % 60000) / 1000);
      const ms = seg.startMs % 1000;
      const timestamp = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}:${String(ms).padStart(3, "0")}`;
      return `[${timestamp}] ${seg.text}`;
    })
    .join("\n");
}

/**
 * Analyze a transcript using Claude and return ranked clip candidates.
 * Retries once on JSON parse/validation failure.
 */
export async function analyzeTranscript(
  transcript: Transcript
): Promise<ClipAnalysis> {
  const transcriptText = formatTranscriptForPrompt(transcript);
  const userPrompt = VIRALITY_SCORE_USER_PROMPT.replace(
    "{transcript_text}",
    transcriptText
  );

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userPrompt },
  ];

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: VIRALITY_SCORE_SYSTEM_PROMPT,
      messages,
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    try {
      // Extract JSON array from response (handle markdown code blocks)
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error("No JSON array found in response");
      }

      const clips = JSON.parse(jsonMatch[0]);
      const analysis = { videoId: transcript.videoId, clips };
      const result = ClipAnalysisSchema.safeParse(analysis);

      if (result.success) {
        // Sort by score descending
        result.data.clips.sort((a, b) => b.score - a.score);
        return result.data;
      }

      throw new Error(`Validation failed: ${result.error.message}`);
    } catch (err) {
      if (attempt === 0) {
        // Retry with a fix-up message
        messages.push({ role: "assistant", content: text });
        messages.push({
          role: "user",
          content: `Your response was not valid JSON conforming to the schema. Error: ${err instanceof Error ? err.message : String(err)}. Please return ONLY a valid JSON array of clip objects with the exact fields specified.`,
        });
        continue;
      }
      throw new Error(
        `Claude analysis failed after retry: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  throw new Error("Unreachable");
}
