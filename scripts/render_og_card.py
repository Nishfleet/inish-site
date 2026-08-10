#!/usr/bin/env python3
"""Render the raster social share card og-image.png from og-image.svg.

X (Twitter) refuses SVG link cards, so the card the generated head points at
must be raster. og-image.svg stays in the repo as the editable design source
and is deliberately NOT served; this script rasterizes it at 1200x630 with
the repo's self-hosted woff2 faces (embedded as data: URLs, so no fontconfig
install is needed) in a headless Chromium, then writes og-image.png to the
repo root and to daily/ so the next build stages it alongside the other
assets.

The Chromium binary is found from $INISH_CHROME, else a Playwright-cached
build under ~/.cache/ms-playwright, else chrome/chromium/google-chrome on
PATH. Stdlib only; no pip dependencies. Run from anywhere:

    python3 scripts/render_og_card.py
"""

from __future__ import annotations

import base64
import glob
import os
import shutil
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

WIDTH = 1200
HEIGHT = 630

ROOT = Path(__file__).resolve().parents[1]
SVG = ROOT / "og-image.svg"
FONTS = ROOT / "fonts"

# (family, weight, style, filename) — the exact @font-face declarations the
# card needs. Keep in sync with the font-family/weight/style attributes in
# og-image.svg.
FONT_FACES = (
    ("Space Mono", 700, "normal", "space-mono-700.woff2"),
    ("Archivo", 700, "normal", "archivo-700.woff2"),
    ("Archivo", 400, "italic", "archivo-400-italic.woff2"),
)

OUTPUTS = (ROOT / "og-image.png", ROOT / "daily" / "og-image.png")

CHROME_CANDIDATES = (
    os.environ.get("INISH_CHROME", ""),
    *sorted(glob.glob(os.path.expanduser("~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome"))),
    *sorted(glob.glob(os.path.expanduser("~/.cache/ms-playwright/chromium-*/chrome-linux/chrome"))),
    *sorted(glob.glob(os.path.expanduser("~/.cache/ms-playwright/chromium-*/chrome-linux64/headless_shell"))),
)


def find_chrome() -> str:
    for candidate in CHROME_CANDIDATES:
        if candidate and os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return candidate
    for name in ("chrome", "chromium", "chromium-browser", "google-chrome"):
        found = shutil.which(name)
        if found:
            return found
    raise SystemExit(
        "no Chromium found: set INISH_CHROME to a chrome binary, or install one "
        "(e.g. playwright install chromium)"
    )


def font_faces() -> str:
    declarations = []
    for family, weight, style, filename in FONT_FACES:
        encoded = base64.b64encode((FONTS / filename).read_bytes()).decode("ascii")
        declarations.append(
            f"@font-face {{ font-family: '{family}'; font-style: {style}; "
            f"font-weight: {weight}; src: url(data:font/woff2;base64,{encoded}) format('woff2'); }}"
        )
    return "\n".join(declarations)


def page() -> str:
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
html, body {{ margin: 0; padding: 0; overflow: hidden; }}
svg {{ display: block; }}
{font_faces()}
</style>
</head>
<body>
{SVG.read_text(encoding="utf-8")}
</body>
</html>
"""


def verify_png(path: Path) -> None:
    data = path.read_bytes()
    if not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise SystemExit(f"{path}: not a PNG")
    if len(data) < 24:
        raise SystemExit(f"{path}: truncated PNG ({len(data)} bytes)")
    width, height = struct.unpack(">II", data[16:24])
    if (width, height) != (WIDTH, HEIGHT):
        raise SystemExit(f"{path}: expected {WIDTH}x{HEIGHT}, got {width}x{height}")


def main() -> None:
    chrome = find_chrome()
    with tempfile.TemporaryDirectory(prefix="inish-og-card-") as tmp:
        html_path = Path(tmp) / "card.html"
        out_path = Path(tmp) / "og-image.png"
        html_path.write_text(page(), encoding="utf-8")
        subprocess.run(
            [
                chrome,
                "--headless=new",
                "--no-sandbox",
                "--disable-gpu",
                "--disable-dev-shm-usage",
                "--hide-scrollbars",
                "--force-device-scale-factor=1",
                "--force-color-profile=srgb",
                "--run-all-compositor-stages-before-draw",
                f"--window-size={WIDTH},{HEIGHT}",
                f"--screenshot={out_path}",
                html_path.as_uri(),
            ],
            check=True,
            capture_output=True,
        )
        verify_png(out_path)
        for destination in OUTPUTS:
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(out_path, destination)
    print(f"wrote {', '.join(str(path) for path in OUTPUTS)} ({WIDTH}x{HEIGHT})")


if __name__ == "__main__":
    main()
