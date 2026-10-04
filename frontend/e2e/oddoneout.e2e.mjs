import { launch, newPage, api, ok, assert, noPageErrors, run, BASE } from './lib.mjs';

// Odd One Out in the public build (no CSW21/NWL2023 shipped): the words come from the installed lists at run time.
// Every category must give a puzzle of 5 words in which exactly one word is not in the ENABLE list.
const CATEGORIES = [
  ['2-Letter Words', 2],
  ['High Score 3-Letter', 3],
  ['3-Letter Extensions', 3],
  ['4-Letter Words', 4],
  ['5-Letter Words', 5],
  ['V Words', null],
  ['Q without U', null],
  ['High Value (J,X,Z)', null],
];

run(async () => {
  const browser = await launch();
  const { page } = await newPage(browser);
  const requested = [];
  page.on('request', (request) => requested.push(request.url()));
  const startButton = page.locator('.start-button');
  const cards = page.locator('.puzzle-container .words-grid .word-card');
  const cardTexts = async () => (await cards.allInnerTexts()).map((t) => t.trim());
  const isRealWord = async (word) => (await api(page, '/api/action', { type: 'validate-word', word: word.toLowerCase() })).valid;

  console.log('1. The home screen offers Odd One Out without a laptop host');
  await page.goto(BASE + '/?debug#/');
  await page.getByRole('heading', { name: 'Odd One Out' }).waitFor();
  ok('the Odd One Out card is on the home screen of the standalone build');

  console.log('2. Setup: only the installed lists are offered, ENABLE is the default, no multiplayer');
  await page.goto(BASE + '/?debug#/odd-one-out');
  await page.waitForFunction(() => window.__oxy);
  await page.evaluate(() => window.__oxy.backend.ready);
  await page.locator('input[data-list]').first().waitFor();
  const ids = await page.locator('input[data-list]').evaluateAll((inputs) => inputs.map((i) => i.dataset.list));
  assert.deepEqual(ids, ['enable', 'slovenian']); ok(`lists offered: ${ids.join(', ')}`);
  const labels = (await page.locator('.checkbox-label').allInnerTexts()).map((t) => t.trim());
  assert.deepEqual(labels, ['ENABLE (open list)', 'Slovenian']); ok(`labels: ${labels.join(' | ')}`);
  const body = await page.locator('body').innerText();
  assert.ok(!/CSW21|NWL2023/.test(body), 'CSW21/NWL2023 must not be mentioned'); ok('CSW21 and NWL2023 are not offered');
  assert.equal(await page.locator('input[data-list="enable"]').isChecked(), true);
  assert.equal(await page.locator('input[data-list="slovenian"]').isChecked(), false); ok('the list of the current game (ENABLE) is pre-selected');
  assert.equal(await page.getByText(/multiplayer/i).count(), 0);
  assert.equal(await page.getByText('Create Room').count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Single Player' }).count(), 1); ok('no multiplayer toggle; only Single Player');
  assert.equal(await startButton.isDisabled(), true); ok('Start is disabled until a category is chosen');

  console.log('3. Every category starts a single-player game with 5 words');
  for (const [name, length] of CATEGORIES) {
    await page.locator('.category-btn', { hasText: name }).click();
    await page.locator('.start-button:not([disabled])').waitFor();
    await startButton.click();
    await cards.first().waitFor();
    const words = await cardTexts();
    assert.equal(words.length, 5, `${name}: 5 words`);
    assert.ok(words.every((w) => /^[A-Z]+$/.test(w)), `${name}: uppercase words, got ${words}`);
    if (length) assert.ok(words.every((w) => w.length === length), `${name}: all ${length} letters, got ${words}`);
    // the independent check: exactly one of the five is not a word of the ENABLE list the game plays by
    const real = await Promise.all(words.map(isRealWord));
    assert.equal(real.filter((v) => !v).length, 1, `${name}: exactly one invalid word in ${words} (${real})`);
    ok(`${name}: ${words.join(' ')}  (odd one: ${words[real.indexOf(false)]})`);
    await page.getByRole('button', { name: 'Exit' }).click();
    await page.locator('.category-btn').first().waitFor();
  }

  console.log('4. Answer one puzzle correctly and one wrongly');
  await page.locator('.category-btn', { hasText: '4-Letter Words' }).click();
  await page.locator('.start-button:not([disabled])').waitFor();
  await startButton.click();
  await cards.first().waitFor();
  assert.equal((await page.locator('.score').innerText()).trim(), 'Score: 0');
  let words = await cardTexts();
  let odd = (await Promise.all(words.map(isRealWord))).indexOf(false);
  assert.ok(odd >= 0);
  await cards.nth(odd).click();
  await page.locator('.feedback.success').waitFor();
  assert.equal((await page.locator('.feedback').innerText()).trim(), 'Correct!');
  assert.equal((await page.locator('.score').innerText()).trim(), 'Score: 10');
  assert.match(await cards.nth(odd).getAttribute('class'), /correct/);
  assert.equal(await cards.evaluateAll((all) => all.every((c) => c.disabled)), true);
  const explanation = (await page.locator('.explanation').innerText()).trim();
  assert.ok(explanation.includes(`'${words[odd]}' is not a valid word.`), explanation);
  ok(`correct answer: "Correct!", score 10, explanation "${explanation}", cards locked`);

  await page.getByRole('button', { name: /Next Puzzle/ }).click();
  await page.locator('.feedback').waitFor({ state: 'detached' });
  words = await cardTexts();
  assert.equal(words.length, 5);
  odd = (await Promise.all(words.map(isRealWord))).indexOf(false);
  const wrong = odd === 0 ? 1 : 0;
  await cards.nth(wrong).click();
  await page.locator('.feedback.error').waitFor();
  assert.equal((await page.locator('.feedback').innerText()).trim(), 'Oops!');
  assert.equal((await page.locator('.score').innerText()).trim(), 'Score: 10'); // unchanged
  assert.match(await cards.nth(wrong).getAttribute('class'), /wrong/);
  assert.match(await cards.nth(odd).getAttribute('class'), /correct/);
  ok('wrong answer: "Oops!", score stays 10, the chosen card is marked wrong and the real odd one is revealed');
  await page.getByRole('button', { name: 'Exit' }).click();

  console.log('5. Choices that cannot make a puzzle are refused with a friendly message');
  await page.locator('input[data-list="enable"]').uncheck();
  await page.locator('[data-testid="setup-message"]').waitFor();
  assert.match(await page.locator('[data-testid="setup-message"]').innerText(), /at least one word list/);
  assert.equal(await startButton.isDisabled(), true); ok('no list selected: Start disabled, message shown');
  await page.locator('input[data-list="slovenian"]').check();
  await page.locator('.category-btn', { hasText: 'Q without U' }).click();
  await page.locator('[data-testid="setup-message"]').filter({ hasText: /only 0 words/ }).waitFor();
  assert.equal(await startButton.isDisabled(), true); ok('Slovenian has no Q words: Start disabled, message "' + (await page.locator('[data-testid="setup-message"]').innerText()) + '"');
  await page.locator('.category-btn', { hasText: '2-Letter Words' }).click();
  await page.locator('.start-button:not([disabled])').waitFor();
  assert.equal(await page.locator('[data-testid="setup-message"]').count(), 0);
  await startButton.click();
  await cards.first().waitFor();
  assert.equal((await cardTexts()).length, 5); ok('Slovenian 2-letter words: a puzzle appears');

  console.log('6. No corpus files are requested');
  assert.deepEqual(requested.filter((url) => /corpus/i.test(url)), []);
  assert.ok(requested.some((url) => /ENABLE\.txt/.test(url)), 'the ENABLE list itself was loaded');
  ok(`${requested.length} requests, none for a corpus file`);

  noPageErrors(page);
  await browser.close();
});
