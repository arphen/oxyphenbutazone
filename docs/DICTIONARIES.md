# Dictionaries

## Format & Setup

Place dictionary files in `public/` with one word per line. Each line is either:

```
WORD
WORD definition [metadata]
```

Examples:
```
AA
AA rough, cindery lava [n AAS]
QUIZ to test the knowledge of by asking questions [v QUIZZED, QUIZZING, QUIZZES]
```

The definition and metadata are optional but recommended for the word definition tooltip feature.

## Available Dictionaries

| List | File (in `public/`) | Words | Ships with the public site? | Notes |
|------|------|-------|---|-------|
| **ENABLE** | `ENABLE.txt` | 168,551 | yes | Open English list (widely described as public domain; verify before relying on that). Entries over 15 letters are removed: they cannot fit the board. No definitions. |
| **Slovenian** | `SLOVENIAN.txt` | 187,169 | yes | Cleaned general-language word list (see [Slovenian dictionary](#slovenian-dictionary)); includes Č, Š, Ž. Licence checked by the maintainer: fine to redistribute |
| **CSW21** | `CSW21.txt` | 279,078 | **no** | Collins word list 2021, with definitions. Copyrighted. |
| **NWL2023** | `NWL2023.txt` | 196,601 | **no** | NASPA Word List 2023, with definitions. Copyrighted. |

Lists are optional: the app uses whichever it has. A build lists what it ships in `wordlists.json`, and the default English
list is the first available of CSW21, NWL2023, ENABLE. If a chosen list turns out not to be installed (or a host answers
for it with its HTML fallback page) the app switches to one that is and says so in the game message.

## Installing Lists

- **Standalone app (phones, GitHub Pages):** open *Word lists* (link on the home screen) and import a `.txt` file for CSW21,
  NWL2023 or any other list. It is validated (2–15 letters per entry, junk and HTML refused, 40 MB limit), stored in the
  browser's IndexedDB, and remembered; it never leaves the device. Remove it again from the same screen.
- **Laptop host:** put the file in `frontend/public/` with the exact name from the table and restart the dev server.
- **Who needs a list:** in a phone-to-phone game only the **host** needs one, because every word is checked on the host's
  phone (a guest's word checks are answered by the host). Importing CSW21 or NWL2023 on the host is enough.
- **Using it:** importing CSW21 or NWL2023 switches an English game that is on the open list to the imported one (and says
  so); new games keep using it. Slovenian games are not affected.
- **Publishing:** `OXY_EXCLUDE_LISTS=csw21,nwl2023` leaves those two out of a build (the GitHub Pages workflow does this
  unless the repository variable `PUBLISH_WORD_LISTS` is `true`). See [DEPLOY.md](DEPLOY.md).

## Testing Dictionary Changes

1. Start dev server: `cd frontend && npm run dev`
2. Check console for dictionary load messages:
   ```
   [Game API] CSW21.txt loaded: 279078 words
   [Game API] ENABLE.txt loaded: 168551 words
   [Game API] Active dictionary updated: 279078 words (CSW21)
   ```
3. Click the 📚 button in game controls to toggle dictionaries
4. Play a word and hover over it in Game History to see its definition
5. Test invalid words (they show "Not in dictionary")

## In-Game Dictionary Selection

Players can switch active dictionaries via the 📚 button (lists that are not installed are shown disabled):

- **Single list**: only its words are valid
- **Several lists**: a word is valid if it is in any of them
- Definitions come from the first selected list that has one (CSW21, then NWL2023, ENABLE has none, then Slovenian)

A dictionary change takes effect immediately for word validation. The **tile language** (English or Slovenian) is chosen on
the home screen when a game starts and never changes mid-game. Starting a new Slovenian game selects the Slovenian list
only; starting a new English game keeps your English choices (default: the best available of CSW21, NWL2023, ENABLE).
A plain restart keeps the game's language and your selection (resetting it if it cannot suit the language).

## Slovenian dictionary

`SLOVENIAN.txt` comes from [unjica/slovenske-besede](https://github.com/unjica/slovenske-besede) and is a general-language word-form list, **not** an official tournament word list. The version first committed to this repo had the wrong text encoding (every word with č, š, ž was corrupted, e.g. `Ajdi¹ek`), so those words could never be played. `scripts/clean_slovenian.py` repairs the encoding and keeps only playable words (2–15 letters from the Slovenian tile alphabet; proper nouns, unit abbreviations and foreign letters q/w/x/y removed). It is idempotent: `python3 scripts/clean_slovenian.py` can be re-run on the cleaned file. Tests in `src/shared/slovenian.test.js` fail if the file is corrupted again.

Known gaps: the list may still contain words or abbreviations a tournament list would reject, and may omit valid forms.

## Implementation

- `src/shared/dictionary.js`: the list store (parse, union of selected lists, definition lookup, word queries for the
  practice modes) and the selection rules. Pure code, used everywhere.
- `src/shared/wordlist.js`: validation of a list a player imports.
- `src/net/localBackend.js`: standalone app: loads lists from IndexedDB (imported) or the shipped files, picks the default,
  falls back when a list is missing, imports/removes lists.
- `src/net/wordStore.js`: IndexedDB storage for imported lists (in-memory fallback in private mode, which the screen warns about).
- `vite-plugin-game-api-v2.js`: laptop-host mode: loads whichever `public/*.txt` files exist and serves `GET /api/words`
  with the same filters (`?dictionary=`, `?length=`, `?contains=`, `?startsWith=`, `?endsWith=`, `?excludes=`).
- `vite-plugin-offline.js`: at build time writes `wordlists.json` and removes lists named in `OXY_EXCLUDE_LISTS`.

## Troubleshooting

**Definitions not showing?**
- Definitions only exist in CSW21 and NWL2023 (ENABLE has none); make sure one of them is installed and selected
- Ensure format is `WORD definition [metadata]`
- Hard refresh browser cache

**Words not validating?**
- Ensure at least one dictionary is selected (📚 button) and that it is installed (*Word lists* screen)
- Check that the word exists in the selected dictionary
- Look at console for validation messages

**Dictionary load fails silently?**
- Check that files are named exactly `CSW21.txt`, `NWL2023.txt`, `SLOVENIAN.txt`
- Verify file paths: `public/CSW21.txt` (relative to frontend root)
- Check server console for error messages

## Word Definition Examples

When hovering over a played word in Game History:

**Valid word (CSW21):**
```
CAT
a carnivorous mammal [n CATS]
```

**Invalid word (not in any dictionary):**
```
XYZABC
Not in dictionary
```

**Word with alternate forms:**
```
QUIZ
to test the knowledge of by asking questions [v QUIZZED, QUIZZING, QUIZZES]
```
