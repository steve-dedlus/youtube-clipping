"""Video ingestion using yt-dlp and transcription using OpenAI Whisper."""

import json
import os
import sys
from pathlib import Path
from typing import Optional

import whisper
import yt_dlp

# Module-level Whisper model cache — loaded once, reused across calls
_whisper_model: Optional[whisper.Whisper] = None
_whisper_model_name: Optional[str] = None


def get_whisper_model(model_name: str = "large-v3") -> whisper.Whisper:
    """Get or load the Whisper model (cached at module level)."""
    global _whisper_model, _whisper_model_name
    if _whisper_model is None or _whisper_model_name != model_name:
        _whisper_model = whisper.load_model(model_name)
        _whisper_model_name = model_name
    return _whisper_model


def download_video(url: str, output_dir: Path) -> tuple[Path, dict]:
    """Download a YouTube video at max resolution using yt-dlp.

    Returns a tuple of (video_path, metadata_dict).
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    output_template = str(output_dir / "%(id)s.%(ext)s")

    ydl_opts = {
        "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "outtmpl": output_template,
        "merge_output_format": "mp4",
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        video_id = info["id"]
        video_path = output_dir / f"{video_id}.mp4"
        metadata = {
            "title": info.get("title", ""),
            "channel": info.get("channel", info.get("uploader", "")),
            "duration": info.get("duration", 0),
            "upload_date": info.get("upload_date", ""),
            "thumbnail_url": info.get("thumbnail", ""),
        }
        return video_path, metadata


def transcribe_video(video_path: Path, model_name: str = "large-v3") -> dict:
    """Transcribe a video using Whisper with word-level timestamps.

    All timestamps are converted to milliseconds.
    """
    model = get_whisper_model(model_name)
    result = model.transcribe(
        str(video_path),
        word_timestamps=True,
        verbose=False,
    )

    segments = []
    for seg in result["segments"]:
        words = []
        for w in seg.get("words", []):
            words.append({
                "word": w["word"].strip(),
                "startMs": int(w["start"] * 1000),
                "endMs": int(w["end"] * 1000),
                "confidence": round(w.get("probability", 0.0), 4),
            })
        segments.append({
            "text": seg["text"].strip(),
            "startMs": int(seg["start"] * 1000),
            "endMs": int(seg["end"] * 1000),
            "words": words,
        })

    duration_ms = int(result["segments"][-1]["end"] * 1000) if result["segments"] else 0

    return {
        "videoId": video_path.stem,
        "language": result.get("language", "en"),
        "durationMs": duration_ms,
        "segments": segments,
    }


def main():
    if len(sys.argv) < 2:
        print("Usage: python -m src.ingest <youtube_url> [output_dir]")
        sys.exit(1)

    url = sys.argv[1]
    output_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("./output")

    print(f"Downloading: {url}")
    video_path, metadata = download_video(url, output_dir)
    print(f"Downloaded to: {video_path}")
    print(f"Metadata: {json.dumps(metadata, indent=2)}")

    print("Transcribing with Whisper large-v3...")
    transcript = transcribe_video(video_path)

    transcript_path = video_path.with_suffix(".transcript.json")
    with open(transcript_path, "w") as f:
        json.dump(transcript, f, indent=2)

    print(f"Transcript saved to: {transcript_path}")
    print(f"Segments: {len(transcript['segments'])}, Duration: {transcript['durationMs']}ms")


if __name__ == "__main__":
    main()
