import fs from 'fs';
import path from 'path';
import { createEngine } from './src/shared/engine.js';
import { createDictionaryStore, DICTIONARY_IDS } from './src/shared/dictionary.js';
import { safeJsonParse, cleanString, MAX_ACTION_BYTES } from './src/shared/protocol.js';

// Laptop-host mode: a thin HTTP shell around the shared engine. All rules live in src/shared/engine.js, which the
// phones also run in their browsers for peer-to-peer play. Bodies are size-capped and parsed with safeJsonParse.

const DICTIONARY_FILES = { csw21: 'CSW21.txt', nwl2023: 'NWL2023.txt', slovenian: 'SLOVENIAN.txt' };
const MAX_BODY_BYTES = 16 * 1024;

const oddOneOutSessions = new Map(); // sessionId -> sessionState

function loadDictionaries(store) {
    for (const id of DICTIONARY_IDS) {
        const file = path.join(process.cwd(), 'public', DICTIONARY_FILES[id]);
        if (fs.existsSync(file)) {
            console.log(`[Game API] ${DICTIONARY_FILES[id]} loaded: ${store.load(id, fs.readFileSync(file, 'utf-8'))} words`);
        } else {
            console.warn(`[Game API] ${DICTIONARY_FILES[id]} not found`);
        }
    }
    store.setSelection({ csw21: true, nwl2023: false, slovenian: false });
}

/** Read and safely parse a JSON body; responds with 4xx and resolves null when it is too large or invalid. */
function readJson(req, res, maxBytes = MAX_BODY_BYTES) {
    return new Promise((resolve) => {
        let body = '';
        let tooLarge = false;
        req.on('data', (chunk) => {
            if (tooLarge) return;
            body += chunk;
            if (body.length > maxBytes) {
                tooLarge = true;
                res.statusCode = 413;
                res.end(JSON.stringify({ success: false, error: 'Request too large' }));
                req.destroy();
                resolve(null);
            }
        });
        req.on('end', () => {
            if (tooLarge) return;
            try {
                resolve(body ? safeJsonParse(body, maxBytes) : {});
            } catch (error) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: error.message }));
                resolve(null);
            }
        });
        req.on('error', () => resolve(null));
    });
}

const SESSION_ID = /^[A-Z0-9]{6}$/;
const sessionFrom = (id) => (typeof id === 'string' && SESSION_ID.test(id) ? oddOneOutSessions.get(id) : undefined);
const intIn = (v, min, max) => (Number.isInteger(v) && v >= min && v <= max ? v : null);

/** Keep only what the odd-one-out screens use: a few short words and the index of the odd one. */
function sanitizePuzzle(puzzle) {
    if (!puzzle || !Array.isArray(puzzle.words) || puzzle.words.length < 2 || puzzle.words.length > 8) return null;
    const words = puzzle.words.map((w) => cleanString(w, 30));
    const correctIndex = intIn(puzzle.correctIndex, 0, words.length - 1);
    return correctIndex === null ? null : { words, correctIndex };
}

export function gameApiPlugin() {
    return {
        name: 'game-api-v2',
        configureServer(server) {
            const store = createDictionaryStore();
            loadDictionaries(store);
            const engine = createEngine(store);
            console.log('[Game API] Game initialized with', engine.getState().playerCount, 'players, language:', engine.getState().language);

            server.middlewares.use(async (req, res, next) => {
                const url = req.url || '';

                // GET /api/game-state - Returns complete game state
                if (url === '/api/game-state' && req.method === 'GET') {
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(engine.getState()));
                    return;
                }

                // POST /api/action - Handles all player actions (validated inside engine.dispatch)
                if (url === '/api/action' && req.method === 'POST') {
                    res.setHeader('Content-Type', 'application/json');
                    const action = await readJson(req, res, MAX_ACTION_BYTES);
                    if (action === null) return;
                    try {
                        res.end(JSON.stringify(engine.dispatch(action)));
                    } catch (e) {
                        console.error('[Game API] Error handling action:', e);
                        res.statusCode = 400;
                        res.end(JSON.stringify({ success: false, error: 'Action failed' }));
                    }
                    return;
                }

                // Test-only hook (exists only when the server is started with OXY_TEST=1): set a player's rack.
                if (process.env.OXY_TEST === '1' && url === '/api/dev/set-rack' && req.method === 'POST') {
                    const body = await readJson(req, res);
                    if (body === null) return;
                    engine.debugSetRack(body.playerId, body.rack);
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: true }));
                    return;
                }

                // GET /api/words?dictionary=csw21&length=5&... - Word queries for the practice modes
                if (url.startsWith('/api/words') && req.method === 'GET') {
                    const params = new URL(url, 'http://localhost').searchParams;
                    const query = {};
                    for (const key of ['dictionary', 'length', 'contains', 'containsAny', 'startsWith', 'endsWith', 'excludes']) {
                        const value = params.get(key);
                        if (value) query[key] = value.slice(0, 100);
                    }
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(store.words(query)));
                    return;
                }

                // ODD ONE OUT MULTIPLAYER API (laptop-host mode only)
                if (url === '/api/odd-one-out/create' && req.method === 'POST') {
                    res.setHeader('Content-Type', 'application/json');
                    const body = await readJson(req, res);
                    if (body === null) return;
                    const sessionId = Math.random().toString(36).substring(2, 8).toUpperCase().padEnd(6, '0');
                    oddOneOutSessions.set(sessionId, {
                        id: sessionId,
                        players: {}, // { 1: { connected: true, answer: null }, 2: ... }
                        status: 'waiting', // waiting, playing, review
                        puzzle: null,
                        startTime: null,
                        roundDuration: intIn(body.roundDuration, 1, 60) ?? 5,
                    });
                    res.end(JSON.stringify({ sessionId }));
                    return;
                }

                if (url === '/api/odd-one-out/join' && req.method === 'POST') {
                    res.setHeader('Content-Type', 'application/json');
                    const body = await readJson(req, res);
                    if (body === null) return;
                    const session = sessionFrom(body.sessionId);
                    const playerId = intIn(body.playerId, 1, 8);
                    if (session && playerId) {
                        session.players[playerId] = { connected: true, answer: null };
                        res.end(JSON.stringify({ success: true }));
                    } else {
                        res.statusCode = 404;
                        res.end(JSON.stringify({ error: 'Session not found' }));
                    }
                    return;
                }

                if (url.startsWith('/api/odd-one-out/state') && req.method === 'GET') {
                    const session = sessionFrom(new URL(url, 'http://localhost').searchParams.get('sessionId'));
                    res.setHeader('Content-Type', 'application/json');
                    if (session) {
                        res.end(JSON.stringify(session));
                    } else {
                        res.statusCode = 404;
                        res.end(JSON.stringify({ error: 'Session not found' }));
                    }
                    return;
                }

                // POST /api/odd-one-out/update (Host updates state)
                if (url === '/api/odd-one-out/update' && req.method === 'POST') {
                    res.setHeader('Content-Type', 'application/json');
                    const body = await readJson(req, res);
                    if (body === null) return;
                    const session = sessionFrom(body.sessionId);
                    if (!session) {
                        res.statusCode = 404;
                        res.end(JSON.stringify({ error: 'Session not found' }));
                        return;
                    }
                    if (['waiting', 'playing', 'review'].includes(body.status)) session.status = body.status;
                    const puzzle = sanitizePuzzle(body.puzzle);
                    if (puzzle) session.puzzle = puzzle;
                    if (body.status === 'playing') {
                        // Reset answers and start timer
                        Object.values(session.players).forEach((p) => (p.answer = null));
                        session.startTime = Date.now();
                    }
                    res.end(JSON.stringify({ success: true }));
                    return;
                }

                // POST /api/odd-one-out/submit (Player submits answer)
                if (url === '/api/odd-one-out/submit' && req.method === 'POST') {
                    res.setHeader('Content-Type', 'application/json');
                    const body = await readJson(req, res);
                    if (body === null) return;
                    const session = sessionFrom(body.sessionId);
                    const playerId = intIn(body.playerId, 1, 8);
                    const answerIndex = intIn(body.answerIndex, 0, 7);
                    if (session && playerId && answerIndex !== null && session.players[playerId]) {
                        session.players[playerId].answer = answerIndex;
                        res.end(JSON.stringify({ success: true }));
                    } else {
                        res.statusCode = 404;
                        res.end(JSON.stringify({ error: 'Session or player not found' }));
                    }
                    return;
                }

                next();
            });
        },
    };
}
