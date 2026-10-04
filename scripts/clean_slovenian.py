#!/usr/bin/env python3
"""Clean frontend/public/SLOVENIAN.txt for use as a Scrabble dictionary.

The upstream list (unjica/slovenske-besede) was originally committed with the wrong text encoding:
ISO-8859-2 bytes had been read as Latin-1, so every word containing č, š or ž was corrupted
(`Ajdišek` stored as `Ajdi¹ek`, `apatičen` as `apatièen`). This script:

  1. repairs that mix-up (lines that are already correct are left alone, so the script is idempotent),
  2. drops proper nouns (capitalised entries) and abbreviations,
  3. keeps only words that can actually be played: 2-15 letters, all in the Slovenian tile alphabet
     (no q, w, x, y, digits or punctuation),
  4. drops vowel-less abbreviations such as cm, km, mg, ml ("r" counts as a vowel: vrt, trg are real words),
  5. lowercases, de-duplicates and sorts.

Usage:  python3 scripts/clean_slovenian.py [input] [output]
Defaults to frontend/public/SLOVENIAN.txt in place.
"""
import sys
from pathlib import Path

ALPHABET = set("abcčdefghijklmnoprsštuvzž")  # keep in sync with ALPHABETS.slovenian in src/shared/rules.js
VOWELS = set("aeiour")
MIN_LEN, MAX_LEN = 2, 15  # board is 15x15; a word needs at least two tiles
DEFAULT = Path(__file__).resolve().parent.parent / "frontend" / "public" / "SLOVENIAN.txt"


def repair_encoding(line: str) -> str:
    """Undo ISO-8859-2-read-as-Latin-1. Lines containing characters Latin-1 cannot hold are already correct."""
    try:
        return line.encode("latin-1").decode("iso-8859-2")
    except UnicodeEncodeError:
        return line


def clean(lines):
    stats = {"input": 0, "repaired": 0, "proper_nouns": 0, "unplayable": 0, "abbreviations": 0}
    words = set()
    for raw in lines:
        raw = raw.strip()
        if not raw:
            continue
        stats["input"] += 1
        line = repair_encoding(raw)
        if line != raw:
            stats["repaired"] += 1
        if line[0].isupper():  # names, places, ALLCAPS abbreviations
            stats["proper_nouns"] += 1
            continue
        if not (MIN_LEN <= len(line) <= MAX_LEN) or any(ch not in ALPHABET for ch in line):
            stats["unplayable"] += 1
            continue
        if not VOWELS & set(line):
            stats["abbreviations"] += 1
            continue
        words.add(line)
    stats["output"] = len(words)
    return sorted(words), stats


def main():
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT
    dst = Path(sys.argv[2]) if len(sys.argv) > 2 else src
    words, stats = clean(src.read_text(encoding="utf-8").splitlines())
    dst.write_text("\n".join(words) + "\n", encoding="utf-8")
    print(", ".join(f"{k}={v}" for k, v in stats.items()))


if __name__ == "__main__":
    main()
