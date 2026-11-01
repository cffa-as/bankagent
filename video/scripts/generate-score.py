#!/usr/bin/env python3
"""Synthesize a quiet ambient bed for the product film (no samples, no licensing).

Usage: python scripts/generate-score.py [seconds]   (requires numpy)
Writes public/audio/score.wav (44.1 kHz, 16-bit stereo).
"""

import sys
import wave
from pathlib import Path

import numpy as np

SR = 44_100
SECONDS = float(sys.argv[1]) if len(sys.argv) > 1 else 240.0
OUT = Path(__file__).resolve().parent.parent / "public" / "audio" / "score.wav"
rng = np.random.default_rng(7)


def hz(midi: float) -> float:
    return 440.0 * 2 ** ((midi - 69) / 12)


CHORDS = [
    [50, 57, 61, 64, 66],  # Dmaj9
    [47, 54, 57, 61, 62],  # Bm9
    [43, 50, 54, 57, 61],  # Gmaj7(9)
    [45, 52, 54, 57, 59],  # A6sus
]
CHORD_SECONDS = 8.0

n = int(SR * SECONDS)
t = np.arange(n) / SR
left = np.zeros(n)
right = np.zeros(n)

chord_count = int(np.ceil(SECONDS / CHORD_SECONDS)) + 1
for index in range(chord_count):
    chord = CHORDS[index % len(CHORDS)]
    start = index * CHORD_SECONDS - 2.0
    length = CHORD_SECONDS + 4.0
    a, b = max(0, int(start * SR)), min(n, int((start + length) * SR))
    if a >= b:
        continue
    local = (np.arange(a, b) / SR) - start
    envelope = np.sin(np.pi * np.clip(local / length, 0, 1)) ** 1.6
    for voice, note in enumerate(chord):
        f = hz(note + 12)
        detune = 1 + (rng.random() - 0.5) * 0.004
        phase = rng.random() * 2 * np.pi
        tone = np.sin(2 * np.pi * f * detune * t[a:b] + phase) + 0.18 * np.sin(4 * np.pi * f * t[a:b] + phase)
        tremolo = 0.85 + 0.15 * np.sin(2 * np.pi * (0.07 + voice * 0.013) * t[a:b])
        pan = 0.25 + 0.5 * (voice / (len(chord) - 1))
        signal = tone * envelope * tremolo * 0.07
        left[a:b] += signal * (1 - pan)
        right[a:b] += signal * pan
    root = hz(chord[0] - 12)
    bass = np.sin(2 * np.pi * root * t[a:b]) * envelope * 0.09
    left[a:b] += bass
    right[a:b] += bass

beat = 60 / 72
for step in range(int(SECONDS / beat)):
    if rng.random() > 0.42:
        continue
    at = step * beat
    chord = CHORDS[int(at // CHORD_SECONDS) % len(CHORDS)]
    note = chord[rng.integers(1, len(chord))] + 24
    a = int(at * SR)
    b = min(n, a + int(2.4 * SR))
    local = np.arange(b - a) / SR
    pluck = np.sin(2 * np.pi * hz(note) * local) * np.exp(-local * 2.6) * (1 - np.exp(-local * 180)) * 0.05
    pan = rng.random()
    left[a:b] += pluck * (1 - pan)
    right[a:b] += pluck * pan

fade = np.clip(t / 3.0, 0, 1) * np.clip((SECONDS - t) / 5.0, 0, 1)
stereo = np.stack([left * fade, right * fade], axis=1)
stereo /= np.max(np.abs(stereo)) + 1e-9
stereo *= 0.5

OUT.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(OUT), "wb") as file:
    file.setnchannels(2)
    file.setsampwidth(2)
    file.setframerate(SR)
    file.writeframes((stereo * 32767).astype(np.int16).tobytes())
print(f"wrote {OUT} ({SECONDS:.0f}s)")
