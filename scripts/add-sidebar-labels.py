#!/usr/bin/env python3
"""Inject `sidebar_label: "<part>.<chapter> <title>"` into every chapter's
frontmatter so that Docusaurus shows part/chapter numbers in the sidebar.

Quarto ignores the `sidebar_label` key, so the print pipeline is unaffected.

Idempotent: re-running the script overwrites any prior `sidebar_label` line in
each frontmatter block to keep the numbering in sync if files are renumbered
later.

Conventions:

* Part directories are named `<NN>-<slug>` where `NN` is the part number.
* Chapter files are named `<NN>-<slug>.md` where `NN` is the chapter number.
* Part index files are `index.md` and receive `sidebar_label: "<part>. <title>"`.
"""

from __future__ import annotations

import re
from pathlib import Path

CONTENT = Path(__file__).resolve().parent.parent / "content"

PART_DIR_RE = re.compile(r"^(\d{1,2})-(.+)$")
CHAPTER_FILE_RE = re.compile(r"^(\d{1,2})-(.+)\.md$")
TITLE_RE = re.compile(r'^title:\s*"(?P<value>.+)"\s*$', re.MULTILINE)
SIDEBAR_LABEL_RE = re.compile(r'^sidebar_label:.*\n', re.MULTILINE)


def update_file(path: Path, label: str) -> bool:
    text = path.read_text()
    if not text.startswith("---\n"):
        return False

    end = text.find("\n---", 4)
    if end == -1:
        return False
    frontmatter = text[4:end]
    body = text[end:]

    frontmatter = SIDEBAR_LABEL_RE.sub("", frontmatter)
    new_label_line = f'sidebar_label: "{label}"\n'

    if "title:" in frontmatter:
        frontmatter = re.sub(
            r'(^title:.*\n)',
            r'\1' + new_label_line,
            frontmatter,
            count=1,
            flags=re.MULTILINE,
        )
    else:
        frontmatter = new_label_line + frontmatter

    new_text = "---\n" + frontmatter + body
    if new_text == text:
        return False
    path.write_text(new_text)
    return True


def main() -> None:
    changed = 0
    for part_dir in sorted(CONTENT.iterdir()):
        if not part_dir.is_dir():
            continue
        part_match = PART_DIR_RE.match(part_dir.name)
        if not part_match:
            continue
        part_num = int(part_match.group(1))

        for md in sorted(part_dir.glob("*.md")):
            text = md.read_text()
            title_match = TITLE_RE.search(text)
            if not title_match:
                continue
            title = title_match.group("value")

            if md.name == "index.md":
                label = f"{part_num}. {title}"
            else:
                ch_match = CHAPTER_FILE_RE.match(md.name)
                if not ch_match:
                    continue
                ch_num = int(ch_match.group(1))
                label = f"{part_num}.{ch_num} {title}"

            if update_file(md, label):
                changed += 1

    print(f"Updated {changed} files.")


if __name__ == "__main__":
    main()
