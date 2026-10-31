import argparse
import json
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate speech with MiniMax T2A V2.")
    parser.add_argument(
        "--config",
        default=os.environ.get("MINIMAX_CONFIG"),
        help="Path to a local JSON file containing tts.api_key.",
    )
    parser.add_argument("--text", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--voice", default="Chinese (Mandarin)_Reliable_Executive")
    parser.add_argument("--model", default="speech-2.8-hd")
    parser.add_argument("--speed", type=float, default=1.0)
    parser.add_argument("--volume", type=float, default=1.0)
    parser.add_argument("--pitch", type=int, default=0)
    parser.add_argument("--emotion", choices=["happy", "sad", "angry", "fearful", "disgusted", "surprised", "calm"])
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.config:
        raise SystemExit("--config or MINIMAX_CONFIG is required")

    config_path = Path(args.config).expanduser()
    config = json.loads(config_path.read_text())
    tts = config["tts"]
    api_key = tts["api_key"]
    base = tts.get("url", "api.minimaxi.com").rstrip("/")
    if not base.startswith(("http://", "https://")):
        base = f"https://{base}"
    endpoint = f"{base}/v1/t2a_v2"
    if tts.get("group_id"):
        endpoint += f"?{urlencode({'GroupId': tts['group_id']})}"

    voice_setting = {
        "voice_id": args.voice,
        "speed": args.speed,
        "vol": args.volume,
        "pitch": args.pitch,
    }
    if args.emotion:
        voice_setting["emotion"] = args.emotion

    payload = {
        "model": args.model,
        "text": args.text,
        "stream": False,
        "language_boost": "Chinese",
        "output_format": "hex",
        "voice_setting": voice_setting,
        "audio_setting": {
            "sample_rate": 44100,
            "bitrate": 128000,
            "format": "mp3",
            "channel": 1,
        },
    }
    request = Request(
        endpoint,
        data=json.dumps(payload, ensure_ascii=False).encode(),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=180) as response:
            body = json.load(response)
    except HTTPError as error:
        raise SystemExit(f"MiniMax HTTP {error.code}: {error.read(500).decode(errors='replace')}") from error
    except URLError as error:
        raise SystemExit(f"MiniMax connection failed: {error.reason}") from error

    base_resp = body.get("base_resp", {})
    if base_resp.get("status_code") not in (None, 0):
        raise SystemExit(
            f"MiniMax rejected the request: {base_resp.get('status_code')} "
            f"{base_resp.get('status_msg', '')}"
        )

    audio_hex = body.get("data", {}).get("audio")
    if not audio_hex:
        raise SystemExit("MiniMax response did not contain audio")

    output = Path(args.output).expanduser()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(bytes.fromhex(audio_hex))
    print(f"wrote {output} ({output.stat().st_size} bytes, voice={args.voice})")


if __name__ == "__main__":
    main()
