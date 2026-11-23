import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseUci } from 'chessops/util';
import { Puzzle, type PuzzleData } from '../src/puzzle.ts';

const set = JSON.parse(readFileSync(new URL('../public/sets/default.json', import.meta.url), 'utf8'));

function solve(data: PuzzleData) {
  const p = new Puzzle(data);
  p.playSetupMove();
  for (let i = 1; i < data.moves.length; i += 2) {
    const result = p.tryMove(parseUci(data.moves[i])!);
    if (result === 'solved') return true;
    assert.equal(result, 'continue', `${data.id} move ${data.moves[i]}`);
    p.playReply();
  }
  return false;
}

test('every puzzle in the default set solves with its stored line', () => {
  for (const data of set.puzzles) assert.ok(solve(data), data.id);
});

test('wrong move is rejected and position is unchanged', () => {
  const p = new Puzzle({ id: 'x', fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 b - - 0 1', moves: ['h7h6', 'a1a8'], rating: 0 });
  p.playSetupMove();
  const before = p.pos.board.occupied;
  assert.equal(p.tryMove(parseUci('a1a2')!), 'wrong');
  assert.ok(p.pos.board.occupied.equals(before));
  assert.equal(p.tryMove(parseUci('a1a8')!), 'solved');
});

test('any checkmating move is accepted', () => {
  // Both Ra8# and Rb8# mate; the stored line only has Ra8.
  const p = new Puzzle({ id: 'x', fen: '6k1/2p2ppp/8/8/8/8/R4PPP/1R4K1 b - - 0 1', moves: ['c7c6', 'a2a8'], rating: 0 });
  p.playSetupMove();
  assert.equal(p.tryMove(parseUci('b1b8')!), 'solved');
});

test('castling by king-onto-rook matches standard UCI', () => {
  const p = new Puzzle({ id: 'x', fen: '4k3/8/8/8/8/8/8/4K2R b K - 0 1', moves: ['e8d8', 'e1g1', 'd8c8', 'h1h8'], rating: 0 });
  p.playSetupMove();
  assert.equal(p.tryMove(parseUci('e1h1')!), 'continue');
});
