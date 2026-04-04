# Product Requirements Document: AI Technical Clipper

**Version:** 1.0
**Last Updated:** 2026-04-04
**Status:** Draft
**Author:** Engineering

---

## 1. Overview

### 1.1 Problem Statement

Long-form YouTube content in the AI Engineering and B2B SaaS space contains high-value technical moments — benchmark reveals, architecture insights, revenue milestones — buried inside 60-120 minute interviews and talks. Manually identifying, clipping, reframing, and captioning these moments for short-form platforms (TikTok, YouTube Shorts, Instagram Reels) is labor-intensive, typically requiring 2-4 hours of skilled editor time per clip.

### 1.2 Product Vision

AI Technical Clipper is an end-to-end automation pipeline that takes a YouTube URL as input and produces publish-ready 9:16 vertical clips as output. The system uses ML-driven transcription, LLM-powered moment detection, computer-vision-based subject reframing, and programmatic video rendering to reduce the clip creation cycle from hours to minutes.

### 1.3 Target Niche

**AI Engineering & B2B SaaS** content exclusively. This focus enables domain-specific tuning of the virality scoring model to recognize patterns unique to this niche: technical benchmarks, inference optimizations, ARR milestones, pricing reveals, and system architecture discussions.

### 1.4 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| End-to-end processing time | < 10 min for a 60-min video | Wall clock from URL submission to rendered clips |
| Virality score precision | > 70% of clips scoring V_s >= 75 should get > 10K views | Tracked over 30-day window post-publish |
| Subtitle sync accuracy | < 50ms drift from ground truth | Manual spot-check on 5% sample |
| Subject framing accuracy | Face centered in frame > 95% of clip duration | MediaPipe confidence threshold |
| User intervention rate | < 20% of clips need manual editing | Tracked per batch |

---

## 2. User Personas

### 2.1 Primary: Technical Content Repurposer

- **Role:** Solo creator or small-team operator running AI/SaaS-focused short-form channels
- **Behavior:** Monitors 10-20 long-form YouTube channels weekly, manually scrubs through to find clip-worthy moments
- **Pain point:** Spends 3+ hours per clip on identification, cutting, reframing, and captioning
- **Goal:** Batch-process multiple source videos and receive a ranked queue of publish-ready clips

### 2.2 Secondary: AI/SaaS Media Company

- **Role:** Content team at a media brand (e.g., newsletter + social presence)
- **Behavior:** Needs consistent daily output of 3-5 clips across platforms
- **Pain point:** Cannot scale editorial team fast enough to maintain posting cadence
- **Goal:** Automated first-pass that editorial reviews and approves, not creates from scratch

---

## 3. System Architecture

### 3.1 High-Level Pipeline

```
┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Ingestion│───>│ Transcription│───>│ LLM Analysis │───>│  Reframing   │───>│  Rendering   │
│ (yt-dlp) │    │  (Whisper)   │    │  (Claude)    │    │ (MediaPipe)  │    │  (Remotion)  │
└──────────┘    └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
     ▲                                                                             │
     │                          apps/web (Next.js 16)                              │
     └──────────────────── orchestrates the full flow ─────────────────────────────┘
```

### 3.2 Monorepo Structure

```
ai-technical-clipper/
├── apps/
│   ├── web/                  # Next.js 16 (App Router) — UI + orchestration
│   └── render-server/        # Remotion — programmatic video rendering
├── packages/
│   └── shared/               # Zod schemas — cross-service data contracts
└── services/
    └── ml-processor/         # Python — ingestion, transcription, reframing
```

### 3.3 Service Responsibilities

| Service | Language | Port | Responsibility |
|---------|----------|------|---------------|
| `apps/web` | TypeScript | 3000 | UI, job orchestration, LLM API calls, queue management |
| `apps/render-server` | TypeScript | 3001 | Remotion compositions, render API, video export |
| `services/ml-processor` | Python | 8000 | Video download, Whisper transcription, MediaPipe reframing |
| `packages/shared` | TypeScript | — | Zod schemas shared across all TS services |

---

## 4. Functional Requirements

### 4.1 Ingestion (P0)

**Service:** `ml-processor`

| ID | Requirement | Details |
|----|-------------|---------|
| ING-1 | Accept YouTube URL | Validate URL format, extract video ID |
| ING-2 | Download at max resolution | Use yt-dlp with `bestvideo[ext=mp4]+bestaudio[ext=m4a]` format selection |
| ING-3 | Output MP4 file | Merge video+audio into single MP4, named `{videoId}.mp4` |
| ING-4 | Extract metadata | Title, channel, duration, upload date, thumbnail URL |
| ING-5 | Handle age-restricted content | Support cookie-based authentication for restricted videos |
| ING-6 | Respect rate limits | Implement exponential backoff on 429 responses |

### 4.2 Transcription (P0)

**Service:** `ml-processor`

| ID | Requirement | Details |
|----|-------------|---------|
| TRX-1 | Word-level timestamps | Use Whisper large-v3 with `word_timestamps=True` |
| TRX-2 | Millisecond precision | All `startMs` and `endMs` values as integer milliseconds |
| TRX-3 | Confidence scores | Per-word probability from Whisper, range [0, 1] |
| TRX-4 | Language detection | Auto-detect language, store in transcript metadata |
| TRX-5 | Output JSON transcript | Conform to `TranscriptSchema` from `@clipper/shared` |
| TRX-6 | GPU acceleration | Detect CUDA availability, fall back to CPU gracefully |

**Transcript Schema:**

```typescript
{
  videoId: string,
  language: string,
  durationMs: number,
  segments: [{
    text: string,
    startMs: number,
    endMs: number,
    words: [{
      word: string,
      startMs: number,
      endMs: number,
      confidence: number
    }]
  }]
}
```

### 4.3 LLM Analysis — Virality Scoring (P0)

**Service:** `apps/web`

| ID | Requirement | Details |
|----|-------------|---------|
| LLM-1 | Analyze full transcript | Send transcript text to Claude 3.5 Sonnet |
| LLM-2 | Score segments 0-100 | Weighted virality score (V_s) per candidate clip |
| LLM-3 | Categorize moments | One of: `technical_benchmark`, `coding_breakthrough`, `revenue_reveal`, `architecture_insight`, `hot_take`, `tutorial_moment` |
| LLM-4 | Generate hooks | 1-sentence attention-grabbing hook per clip |
| LLM-5 | Enforce clip length | Target 30-90 second clips |
| LLM-6 | Return top 5 clips | Ranked by V_s descending |
| LLM-7 | Structured JSON output | Conform to `ClipAnalysisSchema` |

**Virality Score Weights:**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Technical Benchmark / Metric Drop | 0.30 | Specific numbers: latency, cost, accuracy improvements |
| Coding Breakthrough / Architecture Insight | 0.25 | Novel approaches, surprising implementation details |
| Founder Revenue / Growth Reveal | 0.25 | ARR milestones, conversion rates, pricing reveals |
| Narrative Completeness | 0.10 | Complete micro-story: setup, insight, payoff |
| Hook Strength | 0.10 | First 3 seconds contain attention-grabbing statement |

### 4.4 Subject Reframing (P1)

**Service:** `ml-processor`

| ID | Requirement | Details |
|----|-------------|---------|
| FRM-1 | Detect face position | MediaPipe BlazeFace model, per-frame |
| FRM-2 | Compute crop window | Center 9:16 (1080x1920) crop on detected face |
| FRM-3 | Smooth crop transitions | Apply exponential moving average to prevent jitter |
| FRM-4 | Handle no-face frames | Hold last known crop position for up to 2 seconds, then center |
| FRM-5 | Multi-face handling | Track the dominant speaker (largest face or most centered) |
| FRM-6 | Output crop coordinates | Per-frame JSON: `{ frameIndex, cropX, cropY, cropW, cropH }` |
| FRM-7 | Direct video cropping | Use OpenCV to produce a pre-cropped 1080x1920 MP4 |

### 4.5 Rendering (P0)

**Service:** `apps/render-server`

| ID | Requirement | Details |
|----|-------------|---------|
| RND-1 | 9:16 composition | 1080x1920 at 30fps |
| RND-2 | Video layer | Full-bleed background video with `objectFit: cover` |
| RND-3 | Dynamic captions | Hormozi-style: bold, uppercase, high-contrast text shadow |
| RND-4 | Word-synced display | Captions appear/disappear synchronized to word timestamps |
| RND-5 | Caption positioning | Bottom-third of frame with 40px horizontal padding |
| RND-6 | Configurable duration | Accept `startMs`/`endMs` to render arbitrary clip ranges |
| RND-7 | Export MP4 | Remotion CLI render to H.264 MP4 |
| RND-8 | Render API | HTTP endpoint to trigger renders programmatically |

**Caption Style Spec:**

```
Font: Arial Black
Size: 64px
Weight: 900
Color: #FFFFFF
Transform: uppercase
Shadow: 4px 4px 0px #000, -2px -2px 0px #000
Line height: 1.2
Letter spacing: -0.02em
Position: 200px from bottom
```

### 4.6 Web UI — Orchestration Dashboard (P1)

**Service:** `apps/web`

| ID | Requirement | Details |
|----|-------------|---------|
| UI-1 | URL input form | Accept YouTube URL, validate, show video thumbnail |
| UI-2 | Job progress tracker | Real-time status: ingesting → transcribing → analyzing → reframing → rendering |
| UI-3 | Clip review grid | Display top-5 clips with V_s score, category badge, hook text |
| UI-4 | Inline preview | Remotion Player embedded for in-browser clip preview |
| UI-5 | Approve/reject workflow | Mark clips for export or discard |
| UI-6 | Batch processing | Queue multiple YouTube URLs |
| UI-7 | Export controls | Download individual clips or full batch as ZIP |

---

## 5. Non-Functional Requirements

### 5.1 Performance

| Requirement | Target |
|-------------|--------|
| Video download speed | Limited by network; support resumable downloads |
| Whisper transcription | < 3 min for 60-min video on A100 GPU |
| LLM analysis latency | < 15 seconds per transcript |
| Remotion render time | < 30 seconds per 60-second clip |
| Full pipeline (60-min video) | < 10 minutes end-to-end on GPU instance |

### 5.2 Data Integrity

| Requirement | Details |
|-------------|---------|
| Timestamp consistency | All times in milliseconds (integer) across every service boundary |
| Schema validation | Zod validation on every inter-service API call |
| Idempotent processing | Re-processing the same video ID produces identical transcript |

### 5.3 Reliability

| Requirement | Details |
|-------------|---------|
| Pipeline resumability | If a stage fails, restart from the last completed stage |
| Disk cleanup | Auto-delete source video after all clips are rendered (configurable) |
| Error reporting | Structured error responses with stage, videoId, and error detail |

### 5.4 Security

| Requirement | Details |
|-------------|---------|
| API key management | Anthropic key stored in env vars, never logged or exposed to client |
| Input sanitization | Validate and sanitize YouTube URLs before passing to yt-dlp |
| No user content storage | Process and export only; do not persist videos beyond session |
| CORS | Restrict render-server API to web app origin only |

---

## 6. Data Contracts

All inter-service communication uses Zod-validated JSON. Schemas are defined in `packages/shared/src/schemas.ts` and serve as the single source of truth.

### 6.1 Schema Inventory

| Schema | Producer | Consumer | Description |
|--------|----------|----------|-------------|
| `TranscriptSchema` | ml-processor | web | Full transcript with word-level timestamps |
| `ClipAnalysisSchema` | web (LLM) | web, render-server | Ranked clips with virality scores |
| `ViralityScoreSchema` | web (LLM) | web | Individual clip score and metadata |
| `RenderJobSchema` | web | render-server | Render instruction for a single clip |
| `CaptionSchema` | web | render-server | Individual caption timing and text |

### 6.2 API Endpoints

#### ml-processor (FastAPI, port 8000)

| Method | Path | Request | Response | Description |
|--------|------|---------|----------|-------------|
| POST | `/ingest` | `{ url: string }` | `{ videoId, videoPath, metadata }` | Download video |
| POST | `/transcribe` | `{ videoId: string }` | `TranscriptSchema` | Run Whisper |
| POST | `/reframe` | `{ videoId, startMs, endMs }` | `{ videoPath: string, crops: CropFrame[] }` | Run MediaPipe + crop |
| GET | `/health` | — | `{ status: "ok" }` | Health check |

#### render-server (HTTP API, port 3001)

| Method | Path | Request | Response | Description |
|--------|------|---------|----------|-------------|
| POST | `/render` | `RenderJobSchema` | `{ outputPath: string }` | Render a clip |
| GET | `/preview/:jobId` | — | Remotion Player URL | Preview in browser |
| GET | `/health` | — | `{ status: "ok" }` | Health check |

---

## 7. Virality Score (V_s) — Deep Dive

The Virality Score is the core intelligence of the system. It determines which moments from a long-form video are worth clipping.

### 7.1 Scoring Formula

```
V_s = (0.30 × Benchmark) + (0.25 × Breakthrough) + (0.25 × Revenue) + (0.10 × Narrative) + (0.10 × Hook)
```

Each sub-score is on a 0-100 scale. The weighted sum produces a final V_s in [0, 100].

### 7.2 Category Definitions

| Category | Signal Patterns | Examples |
|----------|----------------|---------|
| `technical_benchmark` | Specific numbers, before/after comparisons, latency/throughput/cost metrics | "Inference dropped from 2s to 50ms", "We reduced hallucinations by 84%" |
| `coding_breakthrough` | Novel implementation trick, unexpected simplicity, paradigm shift | "We replaced the entire ML pipeline with a single prompt" |
| `revenue_reveal` | ARR, MRR, conversion rate, deal size, fundraise amount | "Hit $5M ARR in month 14", "Average contract is $180K" |
| `architecture_insight` | System design decision, tradeoff explanation, scaling strategy | "We shard by tenant, not by table" |
| `hot_take` | Contrarian opinion, industry prediction, provocative framing | "RAG is dead for production use cases" |
| `tutorial_moment` | Step-by-step explanation, live coding, clear how-to | "Here's the exact prompt template we use in production" |

### 7.3 Clip Boundary Rules

- **Minimum duration:** 20 seconds
- **Maximum duration:** 90 seconds
- **Ideal range:** 30-60 seconds
- **Start alignment:** Snap to nearest sentence boundary (using word timestamps)
- **End alignment:** Snap to nearest sentence boundary
- **Buffer:** Add 500ms padding at start and end for breathing room

### 7.4 Filtering Thresholds

| Threshold | Action |
|-----------|--------|
| V_s >= 75 | Auto-include in render queue |
| V_s 50-74 | Present for manual review |
| V_s < 50 | Discard |

---

## 8. Technical Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Frontend / Orchestration | Next.js | 16.x | App Router, server actions, API routes |
| Schema Validation | Zod | 3.24.x | Data contracts across all services |
| Video Download | yt-dlp | latest | YouTube ingestion |
| Transcription | OpenAI Whisper | large-v3 | Word-level timestamped STT |
| Face Detection | MediaPipe BlazeFace | 0.10.x | Real-time face localization |
| Video Processing | OpenCV | 4.9.x | Frame-level crop and export |
| LLM Intelligence | Claude 3.5 Sonnet | — | Transcript analysis, virality scoring |
| Video Rendering | Remotion | 4.x | React-based programmatic video |
| Monorepo | Turborepo | 2.5.x | Build orchestration, caching |
| ML Service Framework | FastAPI | 0.115.x | Python HTTP API |
| Runtime | Node.js 20, Python 3.11+ | — | — |

---

## 9. Milestones & Phasing

### Phase 1: Core Pipeline (MVP)

**Goal:** YouTube URL in, rendered vertical clips out.

- [x] Monorepo scaffolding (Turborepo, workspaces, shared schemas)
- [ ] yt-dlp ingestion with metadata extraction
- [ ] Whisper transcription with word-level timestamps
- [ ] Claude virality scoring integration
- [ ] Remotion 9:16 render with dynamic captions
- [ ] CLI-driven end-to-end flow (no UI required)

### Phase 2: Intelligent Reframing

**Goal:** Subject-centered crops with smooth tracking.

- [ ] MediaPipe BlazeFace integration
- [ ] Per-frame crop coordinate generation
- [ ] Exponential moving average smoothing
- [ ] OpenCV crop + export pipeline
- [ ] Multi-face dominant-speaker detection

### Phase 3: Web Dashboard

**Goal:** Visual interface for managing the clip pipeline.

- [ ] URL input with thumbnail preview
- [ ] Real-time job progress tracking
- [ ] Clip review grid with Remotion Player preview
- [ ] Approve/reject/export workflow
- [ ] Batch URL processing

### Phase 4: Scale & Polish

**Goal:** Production-grade reliability and throughput.

- [ ] Job queue (Redis/BullMQ) for pipeline stages
- [ ] Parallel processing of multiple clips
- [ ] Webhook notifications on job completion
- [ ] Caption style customization (fonts, colors, animation)
- [ ] A/B hook variant generation via LLM
- [ ] Analytics integration for tracking clip performance post-publish

---

## 10. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| yt-dlp breaks due to YouTube changes | Pipeline blocked | High | Pin yt-dlp version, monitor releases, fallback to gallery-dl |
| Whisper hallucinations on low-quality audio | Bad captions | Medium | Confidence threshold filter (drop words < 0.5), manual review flag |
| LLM misidentifies clip boundaries | Clips start/end mid-sentence | Medium | Snap to sentence boundaries using word timestamps, add 500ms buffer |
| MediaPipe loses face during fast motion | Jittery crop | Medium | EMA smoothing, 2-second hold on lost frames |
| Remotion render failures on long clips | No output | Low | Cap clip length at 90s, retry with reduced resolution |
| YouTube rate limiting / DMCA | Blocked downloads | Medium | Rate limit compliance, process only public content, no redistribution of full videos |
| GPU unavailability | Slow transcription | Low | CPU fallback with smaller Whisper model (medium), queue management |

---

## 11. Open Questions

1. **Caption animation:** Should captions animate word-by-word (karaoke style) or appear as full phrases? Word-by-word is more engaging but increases render complexity.
2. **Multi-language support:** Should V1 support non-English content, or English-only? Whisper supports multi-language, but virality scoring prompts are English-tuned.
3. **Storage backend:** Should processed videos be stored in cloud storage (S3) or remain local-only for V1?
4. **Authentication:** Does the web UI need user auth for V1, or is it a single-user local tool?
5. **Clip overlap:** If two high-scoring moments overlap in time range, should they be merged or kept as separate clips?

---

## 12. Glossary

| Term | Definition |
|------|-----------|
| **V_s** | Virality Score — weighted 0-100 score predicting a clip's short-form performance |
| **Reframing** | Cropping a 16:9 source video to 9:16 with subject-centered tracking |
| **Hook** | The attention-grabbing opening statement of a clip (first 3 seconds) |
| **Hormozi-style captions** | Bold, uppercase, high-contrast text overlays popularized by Alex Hormozi's content |
| **Word-level timestamp** | Per-word start/end time enabling precise caption synchronization |
| **BlazeFace** | Google's lightweight face detection model, part of MediaPipe |
| **Composition** | A Remotion component defining video structure, layout, and timing |
