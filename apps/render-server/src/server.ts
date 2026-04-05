/**
 * HTTP server for the Remotion render service.
 * Accepts render jobs and shells out to `npx remotion render`.
 */

import express from "express";
import { execFile } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { RenderJobSchema } from "@clipper/shared";

const execFileAsync = promisify(execFile);

const PORT = parseInt(process.env.RENDER_PORT || "3001", 10);
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.resolve("../../output");
const PUBLIC_DIR = process.env.PUBLIC_DIR || OUTPUT_DIR;

const app = express();
app.use(express.json({ limit: "10mb" }));

// Serve video files so Remotion <Video> can access them
app.use("/video", express.static(PUBLIC_DIR));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/render", async (req, res) => {
  // Validate request body
  const parsed = RenderJobSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.format() });
    return;
  }

  const job = parsed.data;
  const durationMs = job.endMs - job.startMs;
  const outputFileName = `${job.videoId}_clip_${job.clipIndex}.mp4`;
  const outputPath = path.join(OUTPUT_DIR, outputFileName);

  // Write input props to a temp file for Remotion
  await mkdir(OUTPUT_DIR, { recursive: true });
  const propsPath = path.join(
    OUTPUT_DIR,
    `${job.videoId}_clip_${job.clipIndex}_props.json`
  );
  const inputProps = {
    videoSrc: job.videoSrc,
    captions: job.captions,
    durationMs,
  };
  await writeFile(propsPath, JSON.stringify(inputProps));

  try {
    console.log(`Rendering clip ${job.clipIndex} for ${job.videoId}...`);
    const { stdout, stderr } = await execFileAsync(
      "npx",
      [
        "remotion",
        "render",
        "VerticalClip",
        `--props=${propsPath}`,
        `--output=${outputPath}`,
      ],
      {
        cwd: path.resolve(__dirname, ".."),
        timeout: 300_000, // 5 minute timeout
      }
    );

    if (stderr) console.error("Render stderr:", stderr);
    console.log(`Rendered: ${outputPath}`);

    res.json({ outputPath, outputFileName });
  } catch (err) {
    console.error("Render failed:", err);
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Render failed: ${message}` });
  }
});

app.listen(PORT, () => {
  console.log(`Render server listening on port ${PORT}`);
  console.log(`Serving videos from: ${PUBLIC_DIR}`);
});
