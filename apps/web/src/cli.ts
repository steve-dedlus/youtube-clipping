#!/usr/bin/env tsx
/**
 * CLI orchestrator for the AI Technical Clipper pipeline.
 *
 * Usage:
 *   npx tsx apps/web/src/cli.ts <youtube-url> [--max-clips 5] [--output-dir ./output]
 *
 * Requires:
 *   - ml-processor running on port 8000
 *   - render-server running on port 3001
 *   - ANTHROPIC_API_KEY set in environment
 */

import type { Transcript, ClipAnalysis } from "@clipper/shared";
import { analyzeTranscript } from "./lib/claude";
import { extractCaptions } from "./lib/captions";

const ML_PROCESSOR_URL =
  process.env.ML_PROCESSOR_URL || "http://localhost:8000";
const RENDER_SERVER_URL =
  process.env.RENDER_SERVER_URL || "http://localhost:3001";

// --- Argument parsing ---

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0].startsWith("--")) {
    console.error(
      "Usage: npx tsx apps/web/src/cli.ts <youtube-url> [--max-clips 5]"
    );
    process.exit(1);
  }

  const url = args[0];
  let maxClips = 5;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--max-clips" && args[i + 1]) {
      maxClips = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return { url, maxClips };
}

// --- HTTP helpers ---

async function post<T>(url: string, body: unknown): Promise<T> {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`${url} returned ${resp.status}: ${text}`);
  }
  return resp.json() as Promise<T>;
}

// --- Pipeline stages ---

async function ingest(url: string) {
  console.log(`\n[1/4] Ingesting: ${url}`);
  const result = await post<{
    videoId: string;
    videoPath: string;
    metadata: Record<string, unknown>;
  }>(`${ML_PROCESSOR_URL}/ingest`, { url });

  console.log(`  Video ID: ${result.videoId}`);
  console.log(`  Title: ${result.metadata.title}`);
  console.log(`  Channel: ${result.metadata.channel}`);
  console.log(`  Duration: ${result.metadata.duration}s`);
  return result;
}

async function transcribe(videoId: string) {
  console.log(`\n[2/4] Transcribing: ${videoId}`);
  const transcript = await post<Transcript>(
    `${ML_PROCESSOR_URL}/transcribe`,
    { videoId }
  );
  console.log(
    `  Segments: ${transcript.segments.length}, Duration: ${transcript.durationMs}ms`
  );
  return transcript;
}

async function analyze(transcript: Transcript, maxClips: number) {
  console.log(`\n[3/4] Analyzing transcript with Claude...`);
  const analysis = await analyzeTranscript(transcript);

  // Limit to requested number of clips
  analysis.clips = analysis.clips.slice(0, maxClips);

  console.log(`  Found ${analysis.clips.length} clip candidates:`);
  for (const clip of analysis.clips) {
    const duration = ((clip.endMs - clip.startMs) / 1000).toFixed(1);
    console.log(
      `    [${clip.score}] ${clip.category} (${duration}s) — "${clip.hook}"`
    );
  }
  return analysis;
}

async function render(
  analysis: ClipAnalysis,
  transcript: Transcript,
  videoId: string
) {
  console.log(`\n[4/4] Rendering ${analysis.clips.length} clips...`);
  const results: string[] = [];

  for (let i = 0; i < analysis.clips.length; i++) {
    const clip = analysis.clips[i];
    const captions = extractCaptions(transcript, clip);

    // Video source URL served by the render server's static route
    const videoSrc = `${RENDER_SERVER_URL}/video/${videoId}.mp4`;

    console.log(`  Rendering clip ${i + 1}/${analysis.clips.length}...`);
    try {
      const result = await post<{ outputPath: string; outputFileName: string }>(
        `${RENDER_SERVER_URL}/render`,
        {
          videoId,
          clipIndex: i,
          videoSrc,
          captions,
          startMs: clip.startMs,
          endMs: clip.endMs,
        }
      );
      results.push(result.outputPath);
      console.log(`    -> ${result.outputFileName}`);
    } catch (err) {
      console.error(
        `    FAILED: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  return results;
}

// --- Main ---

async function main() {
  const { url, maxClips } = parseArgs();

  console.log("=== AI Technical Clipper ===");
  console.log(`URL: ${url}`);
  console.log(`Max clips: ${maxClips}`);

  try {
    const { videoId } = await ingest(url);
    const transcript = await transcribe(videoId);
    const analysis = await analyze(transcript, maxClips);
    const outputPaths = await render(analysis, transcript, videoId);

    console.log(`\n=== Done ===`);
    console.log(`Rendered ${outputPaths.length} clips:`);
    for (const p of outputPaths) {
      console.log(`  ${p}`);
    }
  } catch (err) {
    console.error(
      `\nPipeline failed: ${err instanceof Error ? err.message : String(err)}`
    );
    process.exit(1);
  }
}

main();
