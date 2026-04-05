"""FastAPI application wrapping the ingestion and transcription pipeline."""

import os
import re
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from .ingest import download_video, get_whisper_model, transcribe_video

OUTPUT_DIR = Path(os.environ.get("OUTPUT_DIR", "./output"))

app = FastAPI(title="AI Technical Clipper — ML Processor", version="0.1.0")


@app.on_event("startup")
async def preload_whisper():
    """Pre-load the Whisper model at startup to avoid per-request latency."""
    model_name = os.environ.get("WHISPER_MODEL", "large-v3")
    print(f"Pre-loading Whisper model: {model_name}")
    get_whisper_model(model_name)
    print("Whisper model loaded.")


# --- Request / Response models ---


class IngestRequest(BaseModel):
    url: str


class IngestResponse(BaseModel):
    videoId: str
    videoPath: str
    metadata: dict


class TranscribeRequest(BaseModel):
    videoId: str


class ReframeRequest(BaseModel):
    videoId: str
    startMs: int
    endMs: int


# --- Helpers ---

YOUTUBE_URL_RE = re.compile(
    r"^https?://(www\.)?(youtube\.com/watch\?v=|youtu\.be/|youtube\.com/shorts/)[\w\-]+"
)


def validate_youtube_url(url: str) -> None:
    if not YOUTUBE_URL_RE.match(url):
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")


# --- Endpoints ---


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/ingest", response_model=IngestResponse)
async def ingest(req: IngestRequest):
    validate_youtube_url(req.url)
    try:
        video_path, metadata = download_video(req.url, OUTPUT_DIR)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {e}")

    video_id = video_path.stem
    return IngestResponse(
        videoId=video_id,
        videoPath=str(video_path),
        metadata=metadata,
    )


@app.post("/transcribe")
async def transcribe(req: TranscribeRequest):
    video_path = OUTPUT_DIR / f"{req.videoId}.mp4"
    if not video_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Video file not found: {req.videoId}.mp4",
        )

    model_name = os.environ.get("WHISPER_MODEL", "large-v3")
    try:
        transcript = transcribe_video(video_path, model_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e}")

    return transcript


@app.post("/reframe")
async def reframe(req: ReframeRequest):
    """Placeholder for Phase 2 MediaPipe reframing."""
    raise HTTPException(status_code=501, detail="Reframing not yet implemented")
