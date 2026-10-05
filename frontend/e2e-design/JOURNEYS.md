# User journeys

The complete inventory of what a user can do in the Afterglow pass. **Every row has a Playwright test titled
`[<ID>] ...` that ends in at least one `toHaveScreenshot`.** The static audit
(`ui/audit-static.mjs`) fails if a row has no test, and fails if a test has no row.

How the inventory was built (guide §17.3): every route that carries the game
(home, desktop board, phone rack), every modal on those routes (View panel,
game-over finale), the data states that occur (empty board, seeded mid-game,
verdict, finished), every setting that persists (View tiers across reload),
and the success, abandon (pass) and failure (invalid play) paths of a move.

| ID  | Journey                        | Starts at, ends at                             | States that are screenshotted                             |
| --- | ------------------------------ | ---------------------------------------------- | --------------------------------------------------------- |
| J1  | First view                     | open home, rest state                          | salon headline, mode cards                                |
| J2  | Tap to place and Play          | phone rack, tap tile + square, Play scores     | staged tile, played word with latest hues                 |
| J3  | Dim the screen                 | open View panel, choose Dim, reload            | panel open with Dim pressed, dimmed board, persisted tier |
| J4  | Reset the view                 | choose Veil, press Reset                       | defaults restored                                         |
| J5  | Play moves the territory light | one word, then a second word in the other pole | corner ranks shifted, both poles lit                      |
| J6  | Invalid play is a verdict      | play non-words, refusal, verdict row           | verdict row with no hue                                   |
| J7  | The finish                     | two clean moves, both players pass, finale     | finale card, grade, sparks, honest note                   |
| J8  | Help costs                     | a pass drains the published charge             | dimmed charge after help                                  |

Design contracts (viewport x theme x view tier, keyboard focus, reduced motion) live in
`design.spec.mjs` with ids `D1` to `D3`; they are not journeys.
