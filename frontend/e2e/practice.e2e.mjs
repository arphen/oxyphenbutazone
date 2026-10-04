import fs from 'node:fs';
import { launch, newPage, api, ok, assert, noPageErrors, run, BASE } from './lib.mjs';
import { practiceScenarios, practiceCategories } from '../src/data/practiceScenarios.js';
import { WORD_CATEGORIES } from '../src/data/wordCategories.js';
import { createDictionaryStore } from '../src/shared/dictionary.js';

// The public build ships only the open ENABLE list (no CSW21/NWL2023). Every practice mode has to work with it, and
// with a list the player imports from a file. Drag and drop is done with real mouse events in Chromium.

const WIDE = { viewport: { width: 1400, height: 1000 } };
const enable = createDictionaryStore();
enable.load('enable', fs.readFileSync(new URL('../public/ENABLE.txt', import.meta.url), 'utf8'));
const expectedCount = (category) => enable.words({ dictionary: 'enable', ...WORD_CATEGORIES[category].apiQuery }).count;

async function open(page, hash) {
  await page.goto(BASE + '/?debug#' + hash);
  await page.waitForFunction(() => window.__oxy);
  await page.evaluate(() => window.__oxy.backend.ready);
}
const go = (page, hash) => page.evaluate((h) => { location.hash = h; }, hash); // in-app navigation, no reload

// ---- Free Play ----
const tile = (page, letter) => page.locator('.alphabet-grid .letter-tile', { hasText: new RegExp(`^\\s*${letter}\\s*$`) }).first();
async function placeWord(page, word, row, col) {
  for (let i = 0; i < word.length; i++) await tile(page, word[i].toUpperCase()).dragTo(page.locator('.board .board-cell').nth(row * 15 + col + i));
}
async function boardWords(page) {
  return page.locator('.word-item').evaluateAll((items) =>
    items.map((el) => ({ word: el.querySelector('.word-text').textContent.trim(), valid: el.classList.contains('valid'), invalid: el.classList.contains('invalid') }))
  );
}
async function waitForWord(page, word) {
  await page.locator('.word-item .word-text', { hasText: word }).first().waitFor();
  return (await boardWords(page)).find((w) => w.word === word);
}
async function chooser(page) {
  await page.locator('.dictionary-chooser .icon-button').click();
  const rows = await page.locator('.dropdown-panel .checkbox-item').evaluateAll((labels) =>
    labels.map((label) => ({ text: label.textContent.replace(/\s+/g, ' ').trim(), disabled: label.querySelector('input').disabled, checked: label.querySelector('input').checked }))
  );
  return rows;
}
const closeChooser = (page) => page.locator('.dictionary-chooser .icon-button').click();

// ---- Practice scenarios ----
async function playRackTiles(page, tiles) {
  for (const { letter, row, col } of tiles) {
    await page.locator('.rack .tile:not(.used)', { has: page.locator('.letter', { hasText: new RegExp(`^${letter}$`) }) }).first()
      .dragTo(page.locator('.board .board-cell').nth(row * 15 + col));
  }
}

run(async () => {
  const browser = await launch();
  const { page } = await newPage(browser, WIDE);
  const requested = [];
  page.on('request', (request) => requested.push(request.url()));
  page.on('dialog', (dialog) => dialog.accept());

  console.log('1. Free Play with only ENABLE installed');
  await open(page, '/freeplay');
  await page.locator('.alphabet-grid .letter-tile').first().waitFor();
  assert.equal(await page.locator('[data-testid=list-problem]').count(), 0); ok('no "no list" warning');
  let rows = await chooser(page);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((r) => [r.text.split(' ')[0], r.disabled, r.checked]), [['CSW21', true, false], ['NWL2023', true, false], ['ENABLE', false, true], ['Slovenian', false, false]]);
  assert.match(rows[0].text, /not installed/); assert.match(rows[1].text, /not installed/);
  assert.doesNotMatch(rows[2].text + rows[3].text, /not installed/);
  ok('the chooser offers ENABLE (ticked) and Slovenian; CSW21 and NWL2023 are disabled as "(not installed)"');
  await closeChooser(page);

  await placeWord(page, 'CAT', 3, 5);
  const cat = await waitForWord(page, 'CAT');
  assert.deepEqual([cat.valid, cat.invalid], [true, false]); ok('CAT (an ENABLE word) is recognised as valid');
  await placeWord(page, 'QXZ', 5, 5);
  const junk = await waitForWord(page, 'QXZ');
  assert.deepEqual([junk.valid, junk.invalid], [false, true]); ok('QXZ is shown as not a word');
  await placeWord(page, 'QI', 7, 5);
  assert.equal((await waitForWord(page, 'QI')).invalid, true); ok('QI, which ENABLE does not have, is not valid (the list in use is ENABLE, nothing else)');
  assert.equal((await page.locator('.word-item', { hasText: 'CAT' }).locator('.word-score').innerText()).trim(), '6 pts'); ok('scoring unchanged: CAT on row 3 = 3 + 1 + 1 doubled by the double letter under the T (3,7) = 6 pts');

  // The last list cannot be unticked: the box ticks itself again and the word stays valid
  await chooser(page);
  await page.locator('.dropdown-panel .checkbox-item', { hasText: 'ENABLE' }).locator('input').click();
  await page.waitForFunction(() => [...document.querySelectorAll('.dropdown-panel .checkbox-item input')].map((i) => i.checked).join() === 'false,false,true,false');
  ok('unticking the only list is refused (the box ticks itself again)');
  await closeChooser(page);
  assert.equal((await boardWords(page)).find((w) => w.word === 'CAT').valid, true);
  assert.equal(requested.filter((url) => /CSW21|NWL2023/i.test(url)).length, 0); ok('no request for CSW21.txt or NWL2023.txt');

  console.log('2. Flashcards: every category loads cards from ENABLE');
  await go(page, '/flashcards');
  await page.locator('.category-card').first().waitFor();
  assert.equal(await page.locator('.category-card').count(), Object.keys(WORD_CATEGORIES).length);
  for (const category of Object.values(WORD_CATEGORIES)) {
    await page.locator('.category-card', { hasText: category.name }).first().click();
    await page.locator('.start-btn:not([disabled])').waitFor();
    const total = Number((await page.locator('.progress-text').innerText()).match(/\/ (\d+)/)[1]);
    assert.ok(total > 0, `${category.name} has cards`);
    assert.equal(total, expectedCount(category.id), `${category.name}: cards = the ENABLE words matching the category`);
    assert.equal(await page.locator('[data-testid=empty-category]').count(), 0);
    ok(`${category.name}: ${total} cards`);
    await page.locator('.back-btn').click();
  }
  assert.equal(expectedCount('three-letter-q'), 3); // QAT, QUA, SUQ

  console.log('3. Flashcards: answer a card');
  await page.locator('.category-card', { hasText: WORD_CATEGORIES['three-letter-q'].name }).click();
  await page.locator('.start-btn:not([disabled])').waitFor();
  await page.locator('.start-btn').click();
  await page.locator('.practice-rack').waitFor();
  await page.locator('.hint-btn').click(); // shows the target word
  const target = (await page.locator('.target-word').innerText()).trim();
  assert.ok(['QAT', 'QUA', 'SUQ'].includes(target), `target ${target}`);
  assert.equal(await page.locator('.submit-btn').isDisabled(), true); ok('Check Answer waits for tiles');
  // the target sits on the middle row of the visible 7x7 board, starting at the third column; the shared anchor tile, if any, is already there
  const middle = page.locator('.mini-board .board-row').nth(3);
  for (let i = 0; i < target.length; i++) {
    const cell = middle.locator('.board-cell').nth(3 + i);
    if (await cell.locator('.cell-letter').count()) continue;
    await page.locator('.practice-tile:not(.empty)', { has: page.locator('.tile-letter', { hasText: new RegExp(`^\\s*${target[i]}\\s*$`) }) }).first().dragTo(cell);
  }
  await page.locator('.submit-btn').click();
  await page.locator('.feedback-message.success').waitFor();
  assert.match(await page.locator('.feedback-message').innerText(), new RegExp(`"${target}" is correct`)); ok(`${target} placed from the rack is accepted`);
  assert.equal((await page.locator('.stat-card.learning .stat-value').innerText()).trim(), '1'); ok('the card moved from New to Learning');
  await page.locator('.next-btn').click();
  await page.locator('.target-word').waitFor();
  ok('Next Word brings another card');

  console.log('4. Practice scenarios: all 11 load and are solved by their real answer');
  await go(page, '/practice');
  await page.locator('.category-card').first().waitFor();
  assert.equal(await page.locator('.category-card').count(), Object.keys(practiceCategories).length);
  assert.equal(practiceScenarios.length, 11);
  const solved = new Set();
  for (const [categoryId, category] of Object.entries(practiceCategories)) {
    const scenarios = practiceScenarios.filter((s) => s.category === categoryId);
    const card = page.locator('.category-card', { hasText: category.name }).first();
    assert.match(await card.locator('.scenario-count').innerText(), new RegExp(`^\\s*${scenarios.length} scenarios?`));
    await card.click();
    for (let attempt = 0; attempt < 80 && scenarios.some((s) => !solved.has(s.id)); attempt++) {
      const title = (await page.locator('.scenario-title').innerText()).trim();
      const scenario = scenarios.find((s) => s.title === title);
      assert.ok(scenario, `unknown scenario "${title}"`);
      if (!solved.has(scenario.id)) {
        // loads: the right tiles on the board and in the rack
        const onBoard = scenario.board.flat().filter(Boolean).length;
        assert.equal(await page.locator('.board .board-cell.has-tile').count(), onBoard, `${scenario.id} board tiles`);
        assert.equal(await page.locator('.rack .tile').count(), scenario.rack.length, `${scenario.id} rack`);
        assert.deepEqual(await page.locator('.rack .tile .letter').allInnerTexts(), scenario.rack, `${scenario.id} rack letters`);
        // solve it with its first listed solution
        const solution = scenario.solutions[0];
        await playRackTiles(page, solution.tiles);
        await page.locator('.action-button.primary').click();
        const box = page.locator('.feedback-box.success');
        await box.waitFor();
        assert.match(await box.locator('.feedback-title').innerText(), /Correct/);
        assert.match(await box.locator('.feedback-score').innerText(), new RegExp(`Score: ${solution.score} points`));
        solved.add(scenario.id);
        ok(`${scenario.id} "${scenario.title}": ${solution.word} accepted for ${solution.score}`);
      }
      if (scenarios.every((s) => solved.has(s.id))) break;
      await page.locator('.action-button.success').click(); // Next Scenario (random within the category)
    }
    await page.locator('.sidebar-header .icon-button').click(); // back to the categories
  }
  assert.equal(solved.size, 11); ok('all 11 scenarios loaded and solved');

  // wrong plays are told apart: not a word, not connected, and a real alternative word
  await page.locator('.category-card', { hasText: practiceCategories['v-words'].name }).click();
  for (let attempt = 0; attempt < 80 && (await page.locator('.scenario-title').innerText()).trim() !== 'VAV: The Three-Letter V'; attempt++) {
    await page.locator('.action-button.success').click();
  }
  assert.equal((await page.locator('.scenario-title').innerText()).trim(), 'VAV: The Three-Letter V');
  await playRackTiles(page, [{ letter: 'R', row: 6, col: 8 }, { letter: 'V', row: 8, col: 8 }]); // RAV: not in ENABLE
  await page.locator('.action-button.primary').click();
  assert.match(await page.locator('.feedback-box.error').innerText(), /RAV is not in your word list/); ok('RAV (not a word) is refused with the word named');
  await page.locator('.action-button.secondary', { hasText: 'Reset Board' }).click();
  await playRackTiles(page, [{ letter: 'V', row: 1, col: 1 }]);
  await page.locator('.action-button.primary').click();
  assert.match(await page.locator('.feedback-box.error').innerText(), /connect/); ok('a tile that touches nothing is refused');
  await page.locator('.action-button.secondary', { hasText: 'Reset Board' }).click();
  await playRackTiles(page, [{ letter: 'R', row: 6, col: 8 }, { letter: 'T', row: 8, col: 8 }]); // RAT: a valid word, but not the solution
  await page.locator('.action-button.primary').click();
  const alt = page.locator('.feedback-box.info');
  await alt.waitFor();
  assert.match(await alt.innerText(), /Not the optimal solution/); assert.match(await alt.innerText(), /Score: 5 points/); assert.match(await alt.innerText(), /better move worth 17 points/);
  ok('RAT (a real word, 5 points: R and T on double letter squares) is accepted as a word but judged against the 17 point play');

  console.log('5. Import a CSW21-style file, then Free Play uses it');
  const triples = [];
  for (const a of 'abcdefghij') for (const b of 'aeiou') for (const c of 'rstln') triples.push(`${a}${b}${c} a made-up three-letter word [n ${a}${b}${c}S]`);
  const file = Buffer.from(['# a licence header line that is not a word', ...triples, 'ZZYZX a made-up word for this test [n ZZYZXES]'].join('\n'));
  await go(page, '/words');
  const card = page.locator('[data-list="csw21"].card');
  await card.locator('.status', { hasText: 'Not installed' }).waitFor();
  await card.locator('input[type=file]').setInputFiles({ name: 'csw.txt', mimeType: 'text/plain', buffer: file });
  await card.locator('.status', { hasText: 'Imported' }).waitFor();
  ok('CSW21 imported from a file');

  await go(page, '/freeplay');
  await page.locator('.alphabet-grid .letter-tile').first().waitFor();
  rows = await chooser(page);
  assert.deepEqual(rows.map((r) => [r.text.split(' ')[0], r.disabled, r.checked]), [['CSW21', false, true], ['NWL2023', true, false], ['ENABLE', false, false], ['Slovenian', false, false]]);
  assert.doesNotMatch(rows[0].text, /not installed/); ok('the chooser now offers CSW21, ticked because the game switched to the imported list');
  await closeChooser(page);
  await placeWord(page, 'ZZYZX', 3, 5);
  assert.equal((await waitForWord(page, 'ZZYZX')).valid, true); ok('ZZYZX (only in the imported file) is valid');
  await placeWord(page, 'DOG', 5, 5);
  assert.equal((await waitForWord(page, 'DOG')).invalid, true); ok('DOG (only in ENABLE) is not valid while only CSW21 is ticked');
  await chooser(page);
  await page.locator('.dropdown-panel .checkbox-item', { hasText: 'ENABLE' }).locator('input').click();
  await closeChooser(page);
  await page.locator('.word-item.valid .word-text', { hasText: 'DOG' }).waitFor();
  assert.equal((await boardWords(page)).find((w) => w.word === 'ZZYZX').valid, true); ok('ticking ENABLE as well accepts DOG and still ZZYZX (the union)');
  assert.equal(requested.filter((url) => /CSW21|NWL2023/i.test(url)).length, 0); ok('still no request for CSW21.txt or NWL2023.txt');

  // Flashcards follow the list in use too: the game now plays by the imported file, which has no 3-letter Q word,
  // so that category is empty (earlier ENABLE cards are dropped) and says why instead of offering a dead Start button
  assert.deepEqual(await api(page, '/api/words?length=3&contains=Q'), { words: [], count: 0 });
  await go(page, '/flashcards');
  await page.locator('.back-btn, .category-card').first().waitFor();
  if (await page.locator('.back-btn').count()) await page.locator('.back-btn').click(); // the app reopens on the category last used
  await page.locator('.category-card', { hasText: WORD_CATEGORIES['three-letter-q'].name }).click();
  await page.locator('[data-testid=empty-category]').waitFor();
  assert.equal(await page.locator('.start-btn').isDisabled(), true); ok('flashcards use the list in play: an empty category explains itself');
  noPageErrors(page, 'practice');

  console.log('6. No list at all: Free Play says so instead of failing silently');
  const { page: empty } = await newPage(browser, { ...WIDE, serviceWorkers: 'block' });
  await empty.route('**/wordlists.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ lists: {} }) }));
  await open(empty, '/freeplay');
  const problem = empty.locator('[data-testid=list-problem]');
  await problem.waitFor();
  assert.match(await problem.innerText(), /No word list is installed/); ok(`message: "${(await problem.innerText()).replace(/\s+/g, ' ')}"`);
  rows = await chooser(empty);
  assert.ok(rows.every((r) => r.disabled && /not installed/.test(r.text))); ok('every list shows "(not installed)"');
  noPageErrors(empty, 'empty');

  await browser.close();
});
