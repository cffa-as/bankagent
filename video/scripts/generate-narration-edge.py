#!/usr/bin/env python3
"""Generate Mandarin narration and sentence timings with edge-tts.

Usage:
  python3 -m venv /tmp/tts-venv && /tmp/tts-venv/bin/pip install edge-tts
  /tmp/tts-venv/bin/python scripts/generate-narration-edge.py

Writes public/audio/<id>.mp3 and src/narration-timing.json.
"""

import asyncio
import json
import re
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent.parent
CONTENT = json.loads((ROOT / "content" / "narration.json").read_text(encoding="utf-8"))
AUDIO_DIR = ROOT / "public" / "audio"
TIMING_PATH = ROOT / "src" / "narration-timing.json"
TICKS_PER_SECOND = 10_000_000


def split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[。！？；])", text)
    return [part.strip() for part in parts if part.strip()]


async def synthesize(item: dict) -> dict:
    communicate = edge_tts.Communicate(
        item["text"],
        CONTENT["voice"],
        rate=CONTENT.get("rate", "+0%"),
        boundary="SentenceBoundary",
    )
    audio = bytearray()
    boundaries = []
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio.extend(chunk["data"])
        elif chunk["type"] == "SentenceBoundary":
            start = chunk["offset"] / TICKS_PER_SECOND
            end = (chunk["offset"] + chunk["duration"]) / TICKS_PER_SECOND
            boundaries.append({"text": chunk["text"], "start": round(start, 3), "end": round(end, 3)})

    (AUDIO_DIR / f"{item['id']}.mp3").write_bytes(bytes(audio))

    sentences = boundaries or [{"text": item["text"], "start": 0, "end": 0}]
    if len(boundaries) <= 1:
        total = boundaries[0]["end"] if boundaries else 0
        pieces = split_sentences(item["text"])
        weights = [len(piece) for piece in pieces]
        cursor = boundaries[0]["start"] if boundaries else 0
        span = total - cursor
        sentences = []
        for piece, weight in zip(pieces, weights):
            length = span * weight / sum(weights)
            sentences.append({"text": piece, "start": round(cursor, 3), "end": round(cursor + length, 3)})
            cursor += length

    return {"duration": sentences[-1]["end"], "sentences": sentences}


async def main() -> None:
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    timing = {}
    for item in CONTENT["items"]:
        timing[item["id"]] = await synthesize(item)
        print(f"{item['id']}: {timing[item['id']]['duration']:.2f}s, {len(timing[item['id']]['sentences'])} sentences")
    TIMING_PATH.write_text(json.dumps(timing, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {TIMING_PATH}")


asyncio.run(main())
