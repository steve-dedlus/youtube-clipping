# AI Technical Clipper

Automated pipeline to clip long-form YouTube content into short-form (9:16) videos targeting the **AI Engineering & B2B SaaS** niche. Identifies high-signal technical "aha" moments and automates transcription, reframing, and rendering.

## Pipeline

```
YouTube URL
    │
    ▼
┌─────────────────────┐
│  1. Ingestion       │  yt-dlp: download source video at max resolution
│     (ml-processor)  │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  2. Transcription   │  OpenAI Whisper (large-v3): word-level timestamps
│     (ml-processor)  │  Output: JSON with all times in milliseconds
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  3. LLM Analysis    │  Claude 3.5 Sonnet: score segments for virality
│     (web)           │  Detects: benchmarks, coding breakthroughs,
│                     │  founder revenue reveals
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  4. Reframing       │  MediaPipe (BlazeFace) + OpenCV:
│     (ml-processor)  │  subject-centered 9:16 crop
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  5. Rendering       │  Remotion: React-based video generation
│     (render-server) │  Hormozi-style dynamic captions
└─────────────────────┘
```

## Monorepo Structure

```
ai-technical-clipper/
├── apps/
│   ├── web/               # Next.js 16 — UI and orchestration
│   └── render-server/     # Remotion — programmatic video rendering
├── packages/
│   └── shared/            # Shared Zod schemas and types
└── services/
    └── ml-processor/      # Python — ingestion, transcription, reframing
```

## Tech Stack

| Layer         | Technology                              |
|---------------|----------------------------------------|
| Frontend/Glue | Next.js 16 (App Router)                |
| Transcription | OpenAI Whisper (large-v3)              |
| Ingestion     | yt-dlp                                 |
| Reframing     | MediaPipe (BlazeFace) + OpenCV         |
| Intelligence  | Claude 3.5 Sonnet API                  |
| Rendering     | Remotion                               |
| Monorepo      | Turborepo                              |
| Validation    | Zod                                    |

## Architectural Decisions

- **Unified Time Format**: All timestamps are in **milliseconds** throughout the pipeline to prevent subtitle desynchronization.
- **Schema Validation**: Zod schemas enforce data contracts across all internal API boundaries.
- **Microservices Monorepo**: Turborepo manages builds across JS/TS apps while the Python service runs independently.

## Getting Started

```bash
# Install JS dependencies
npm install

# Set up Python environment
cd services/ml-processor
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run development servers
npm run dev
```

## Environment Variables

Create a `.env.local` in `apps/web/`:

```
ANTHROPIC_API_KEY=your-api-key
ML_PROCESSOR_URL=http://localhost:8000
RENDER_SERVER_URL=http://localhost:3001
```
