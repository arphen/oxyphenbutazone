# Slovenian Dictionary

## Source
The word list (`SLOVENIAN.txt`) derives from [unjica/slovenske-besede](https://github.com/unjica/slovenske-besede) (listed upstream as MIT-licensed; the project maintainer checked the licence and confirmed the list can be redistributed). MIT asks that the upstream copyright notice travels with the data: keep the upstream LICENSE text alongside this file.

## Cleaning
The original copy committed here had the wrong text encoding (ISO-8859-2 read as Latin-1), which corrupted every word containing č, š or ž. `scripts/clean_slovenian.py` repairs it and keeps only playable words:

- 187,169 words, lowercase, 2-15 letters, alphabet `abcčdefghijklmnoprsštuvzž`
- removed: proper nouns, unit abbreviations (cm, km, mg, ml), words with q/w/x/y/digits/punctuation, words longer than 15 letters

Re-running the script on the cleaned file changes nothing.

## Notes
- This is a general-language list, **not** an official tournament dictionary. It may contain words or abbreviations a tournament list would reject and may omit valid forms.
- Suitable for casual games. Tests in `frontend/src/shared/slovenian.test.js` guard the file's integrity.
