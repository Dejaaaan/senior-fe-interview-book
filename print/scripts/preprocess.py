#!/usr/bin/env python3
"""Stage Markdown for Quarto, pre-rendering Mermaid diagrams via mmdc.

Replaces the previous bash preprocess.sh with a single-pass Python script that:

  1. Walks ../content/ recursively.
  2. For each .md file, finds ```mermaid``` fenced blocks, computes a stable
     SHA-256 hash of each block's source, and pre-renders the diagram via
     `mmdc` (Mermaid CLI, from @mermaid-js/mermaid-cli) into a PNG under
     print/.mermaid-cache/<hash>.png. Cached: if the PNG already exists with
     the right hash, mmdc is skipped, so re-runs are fast.
  3. Writes the transformed Markdown into print/content/<rel>.qmd, with each
     `mermaid` block replaced by an image reference whose path is computed
     relative to the staged file's directory.
  4. Rewrites internal `](path.md)` links to `](path.qmd)` so cross-references
     resolve under the staged layout.
  5. Copies non-Markdown assets (images etc.) verbatim.

Why pre-render Mermaid?
  Quarto's bundled Chromium harness has a race condition where, for some
  diagrams, the page is captured before Mermaid finishes writing the closing
  </g> tags. The resulting SVG is truncated and rsvg-convert (or the PNG
  raster path) bails out with errors like "Premature end of data in tag g"
  or "Couldn't find an svg element in svg string". `mmdc` is a dedicated,
  single-diagram renderer with explicit waits for Mermaid completion and is
  reliable in both local and CI environments. It is wrapped here so Quarto
  only ever sees plain Markdown image references — no executable Mermaid
  cells, no Chromium dependency on Quarto's side.

Requirements:
  * Python 3.9+ (relies on `pathlib`, f-strings, `subprocess.run(..., text=True)`).
  * `mmdc` invokable via `pnpm exec mmdc` from the repo root, i.e.
    `@mermaid-js/mermaid-cli` installed as a dev dependency by `pnpm install`.

Invocation:
  Called by the root `print:stage` script (see package.json).
"""

from __future__ import annotations

import hashlib
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PRINT_DIR = SCRIPT_DIR.parent
REPO_ROOT = PRINT_DIR.parent
SOURCE_DIR = REPO_ROOT / "content"
STAGE_DIR = PRINT_DIR / "content"
# Cache survives between runs (gitignored). Keeping it outside STAGE_DIR
# means we can safely wipe staging on every invocation without paying to
# re-render unchanged diagrams.
CACHE_DIR = PRINT_DIR / ".mermaid-cache"
PUPPETEER_CONFIG = SCRIPT_DIR / "puppeteer.json"

# Match a top-level fenced Mermaid block in a Markdown file:
#   - opener `````mermaid````` on its own line
#   - any content (possibly multi-line)
#   - closer ``````` on its own line
# Anchored to start-of-line in MULTILINE so we don't accidentally match
# "mermaid" appearing inside a paragraph.
MERMAID_RE = re.compile(
    r"^```mermaid[ \t]*\n(.*?)\n```[ \t]*$",
    re.MULTILINE | re.DOTALL,
)

# Match a Markdown link target ending in `.md` (followed by `)` or `#anchor`)
# so we can rewrite extensions to `.qmd` for the staged layout. Bare URLs and
# code-fence occurrences of the literal string `.md` are not matched because
# they lack the `](` prefix.
LINK_RE = re.compile(r"\]\(([^)#]+)\.md([)#])")


def ensure_cache_dir() -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)


def render_mermaid(source: str, out_path: Path, origin: str) -> None:
    """Render the given Mermaid source to PNG via `pnpm exec mmdc`.

    Cached on `out_path.exists()`; skip the render if the file is already
    present (same SHA-256 of the source ⇒ same diagram). `origin` is a
    human-readable pointer (e.g. `content/10-auth/02-sessions-vs-jwt.md`)
    used in the failure log so a parse error names the chapter to fix.
    """
    if out_path.exists():
        return

    out_path.parent.mkdir(parents=True, exist_ok=True)

    # mmdc reads the diagram source from a file, not stdin, so write it
    # alongside the cached output and remove the .mmd file after rendering.
    mmd_path = out_path.with_suffix(".mmd")
    mmd_path.write_text(source)

    try:
        proc = subprocess.run(
            [
                "pnpm",
                "exec",
                "mmdc",
                "--input",
                str(mmd_path),
                "--output",
                str(out_path),
                "--puppeteerConfigFile",
                str(PUPPETEER_CONFIG),
                # Transparent background so the diagram blends with both
                # light and dark page templates downstream.
                "--backgroundColor",
                "transparent",
                # 1600px wide gives crisp print rendering at the page widths
                # the book uses (LaTeX scales the PNG down via adjustbox to
                # fit the text width without losing fidelity).
                "--width",
                "1600",
            ],
            text=True,
            capture_output=True,
            cwd=REPO_ROOT,
        )
    finally:
        mmd_path.unlink(missing_ok=True)

    if proc.returncode != 0 or not out_path.exists():
        sys.stderr.write(
            f"\npreprocess.py: mmdc failed for diagram in {origin}\n"
            f"  → expected output: {out_path}\n"
            f"--- mmdc stdout ---\n{proc.stdout}\n"
            f"--- mmdc stderr ---\n{proc.stderr}\n"
            f"--- diagram source ---\n{source}\n"
        )
        sys.exit(1)


def transform_markdown(text: str, staged_file: Path, origin: str) -> str:
    """Return the Markdown body with Mermaid blocks replaced by image refs
    (paths relative to `staged_file.parent`) and `.md` links rewritten to
    `.qmd`. `origin` is the source file path, propagated into mmdc error
    messages so a parse error tells you which chapter to edit.
    """

    def replace_mermaid(match: re.Match[str]) -> str:
        diagram = match.group(1)
        digest = hashlib.sha256(diagram.encode("utf-8")).hexdigest()[:16]
        png_path = CACHE_DIR / f"{digest}.png"
        render_mermaid(diagram, png_path, origin)
        # Image path the staged .qmd will reference. Computed relative to
        # the file's directory so Quarto resolves it correctly regardless
        # of where the file sits in the part hierarchy.
        rel = os.path.relpath(png_path, staged_file.parent)
        return f"![]({rel})"

    text = MERMAID_RE.sub(replace_mermaid, text)
    text = LINK_RE.sub(r"](\1.qmd\2)", text)
    return text


def main() -> int:
    if not SOURCE_DIR.is_dir():
        sys.stderr.write(
            f"preprocess.py: source directory not found: {SOURCE_DIR}\n"
        )
        return 1

    ensure_cache_dir()

    # Wipe any prior staging output. The Mermaid cache lives outside this
    # directory, so cached PNGs survive the wipe and re-renders are fast.
    if STAGE_DIR.exists() or STAGE_DIR.is_symlink():
        shutil.rmtree(STAGE_DIR, ignore_errors=True)
        # `rmtree(ignore_errors=True)` skips a dangling symlink without
        # raising; remove it explicitly if rmtree could not.
        if STAGE_DIR.is_symlink():
            STAGE_DIR.unlink()
    STAGE_DIR.mkdir(parents=True)

    files_seen = 0
    for src in sorted(SOURCE_DIR.rglob("*")):
        if src.is_dir():
            continue
        rel = src.relative_to(SOURCE_DIR)
        if src.suffix == ".md":
            dst = STAGE_DIR / rel.with_suffix(".qmd")
            dst.parent.mkdir(parents=True, exist_ok=True)
            origin = str(src.relative_to(REPO_ROOT))
            transformed = transform_markdown(src.read_text(), dst, origin)
            dst.write_text(transformed)
        else:
            dst = STAGE_DIR / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
        files_seen += 1

    print(
        f"preprocess.py: staged {files_seen} files into {STAGE_DIR}; "
        f"Mermaid cache at {CACHE_DIR}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
