import '@lichess-org/chessground/assets/chessground.base.css';
import '@lichess-org/chessground/assets/chessground.brown.css';
import '@lichess-org/chessground/assets/chessground.cburnett.css';
import './style.css';

import { Chessground } from '@lichess-org/chessground';
import type { Key } from '@lichess-org/chessground/types';
import { chessgroundDests } from 'chessops/compat';
import { makeFen } from 'chessops/fen';
import type { Move } from 'chessops/types';
import { makeSquare, parseSquare } from 'chessops/util';
import { Puzzle, type PuzzleSet } from './puzzle';

const DURATION_MS = 5 * 60 * 1000;
const REPLY_DELAY_MS = 120;
const SET_URL = `${import.meta.env.BASE_URL}sets/default.json`;

const $ = (id: string) => document.getElementById(id)!;
const ui = {
  board: $('board'),
  clock: $('clock'),
  solved: $('solved'),
  mistakes: $('mistakes'),
  skipped: $('skipped'),
  rating: $('rating'),
  turn: $('turn'),
  hint: $('hint'),
  skip: $('skip') as HTMLButtonElement,
  results: $('results'),
  resultsBody: $('results-body'),
  again: $('again') as HTMLButtonElement,
};

let set: PuzzleSet;
let puzzle: Puzzle;
let index = 0;
let lastMove: Move | undefined;
let startedAt: number | null = null;
let over = false;
let stats = { solved: 0, mistakes: 0, skipped: 0, best: 0 };

const cg = Chessground(ui.board, {
  movable: { free: false, showDests: true, events: { after: onUserMove } },
  premovable: { enabled: false },
  highlight: { lastMove: true, check: true },
  animation: { enabled: true, duration: 160 },
});

const moveKeys = (m: Move): Key[] =>
  'from' in m ? [makeSquare(m.from) as Key, makeSquare(m.to) as Key] : [makeSquare(m.to) as Key];

function sync() {
  const pos = puzzle.pos;
  const playerTurn = !over && pos.turn === puzzle.playerColor;
  cg.set({
    fen: makeFen(pos.toSetup()),
    turnColor: pos.turn,
    check: pos.isCheck(),
    lastMove: lastMove && moveKeys(lastMove),
    movable: {
      color: playerTurn ? puzzle.playerColor : undefined,
      dests: playerTurn ? chessgroundDests(pos) : new Map(),
    },
  });
}

function loadPuzzle() {
  if (index >= set.puzzles.length) return endRun();
  puzzle = new Puzzle(set.puzzles[index]);
  lastMove = undefined;
  cg.set({ animation: { enabled: false } });
  cg.set({ orientation: puzzle.playerColor, fen: puzzle.data.fen, lastMove: undefined, check: false });
  cg.set({ animation: { enabled: true } });
  lastMove = puzzle.playSetupMove();
  sync();
  ui.rating.textContent = String(puzzle.data.rating);
  ui.turn.textContent = `${puzzle.playerColor === 'white' ? 'White' : 'Black'} to move`;
  ui.turn.dataset.color = puzzle.playerColor;
}

function onUserMove(orig: Key, dest: Key) {
  if (over || timeLeft() <= 0) return endRun();
  startClock();
  const from = parseSquare(orig)!;
  const to = parseSquare(dest)!;
  const isPromotion = puzzle.pos.board.get(from)?.role === 'pawn' && (to >> 3 === 0 || to >> 3 === 7);
  const move: Move = isPromotion ? puzzle.expectedPromotion(from, to) ?? { from, to, promotion: 'queen' } : { from, to };

  const result = puzzle.tryMove(move);
  if (result === 'wrong') {
    stats.mistakes++;
    flash('bad');
    sync();
  } else if (result === 'solved') {
    stats.solved++;
    stats.best = Math.max(stats.best, puzzle.data.rating);
    flash('good');
    index++;
    loadPuzzle();
  } else {
    lastMove = move;
    sync();
    const current = puzzle;
    setTimeout(() => {
      if (over || puzzle !== current) return;
      lastMove = puzzle.playReply();
      sync();
    }, REPLY_DELAY_MS);
  }
  renderStats();
}

function skip() {
  if (over) return;
  startClock();
  stats.skipped++;
  index++;
  loadPuzzle();
  renderStats();
}

function flash(kind: 'good' | 'bad') {
  ui.board.classList.remove('good', 'bad');
  void ui.board.offsetWidth;
  ui.board.classList.add(kind);
}

function renderStats() {
  ui.solved.textContent = String(stats.solved);
  ui.mistakes.textContent = String(stats.mistakes);
  ui.skipped.textContent = String(stats.skipped);
}

const timeLeft = () => (startedAt === null ? DURATION_MS : DURATION_MS - (performance.now() - startedAt));

function startClock() {
  if (startedAt !== null) return;
  startedAt = performance.now();
  ui.hint.hidden = true;
  requestAnimationFrame(tick);
}

let shownSeconds = -1;
function renderClock(ms: number) {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  if (s === shownSeconds) return;
  shownSeconds = s;
  ui.clock.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  ui.clock.classList.toggle('low', s <= 30);
}

function tick() {
  if (over) return;
  const left = timeLeft();
  renderClock(left);
  if (left <= 0) return endRun();
  requestAnimationFrame(tick);
}

function endRun() {
  if (over) return;
  over = true;
  renderClock(timeLeft());
  if (puzzle) sync();
  const attempted = stats.solved + stats.skipped;
  ui.resultsBody.innerHTML = `
    <div class="big">${stats.solved}<span>solved</span></div>
    <dl>
      <dt>Mistakes</dt><dd>${stats.mistakes}</dd>
      <dt>Skipped</dt><dd>${stats.skipped}</dd>
      <dt>Highest solved</dt><dd>${stats.best || '–'}</dd>
      <dt>Reached puzzle</dt><dd>#${attempted + 1}</dd>
    </dl>`;
  ui.results.hidden = false;
  ui.again.focus();
}

function reset() {
  index = 0;
  startedAt = null;
  over = false;
  shownSeconds = -1;
  stats = { solved: 0, mistakes: 0, skipped: 0, best: 0 };
  ui.results.hidden = true;
  ui.hint.hidden = false;
  renderClock(DURATION_MS);
  renderStats();
  loadPuzzle();
}

ui.skip.addEventListener('click', skip);
ui.again.addEventListener('click', reset);

set = await fetch(SET_URL).then((r) => r.json());
reset();
