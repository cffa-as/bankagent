import argparse
import json
import os
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate every Vaultline narration segment.")
    parser.add_argument("--config", default=os.environ.get("MINIMAX_CONFIG"))
    parser.add_argument("--content", default=str(ROOT / "content" / "narration.json"))
    parser.add_argument("--output-dir", default=str(ROOT / "public" / "audio"))
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.config:
        raise SystemExit("--config or MINIMAX_CONFIG is required")

    content = json.loads(Path(args.content).read_text())
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    for item in content["items"]:
        output = output_dir / f"{item['id']}.mp3"
        subprocess.run(
            [
                "python3",
                str(ROOT / "scripts" / "minimax-tts.py"),
                "--config",
                args.config,
                "--voice",
                content["voice"],
                "--model",
                content["model"],
                "--text",
                item["text"],
                "--output",
                str(output),
            ],
            check=True,
        )


if __name__ == "__main__":
    main()
