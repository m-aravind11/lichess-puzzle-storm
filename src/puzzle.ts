import { Chess, normalizeMove } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import { makeUci, parseUci } from 'chessops/util';
import type { Color, Move } from 'chessops/types';

export interface PuzzleData {
  id: string;
  fen: string;
  moves: string[];
  rating: number;
}

export interface PuzzleSet {
  id: string;
  seed: number;
  puzzles: PuzzleData[];
}

export type MoveResult = 'wrong' | 'solved' | 'continue';

export class Puzzle {
  readonly data: PuzzleData;
  readonly playerColor: Color;
  pos: Chess;
  private ply = 0;

  constructor(data: PuzzleData) {
    this.data = data;
    this.pos = Chess.fromSetup(parseFen(data.fen).unwrap()).unwrap();
    this.playerColor = this.pos.turn === 'white' ? 'black' : 'white';
  }

  /** Opponent move that sets up the puzzle; must be played before the player's first move. */
  playSetupMove(): Move {
    return this.playExpected();
  }

  tryMove(move: Move): MoveResult {
    const expected = parseUci(this.data.moves[this.ply])!;
    const same = makeUci(normalizeMove(this.pos, move)) === makeUci(normalizeMove(this.pos, expected));
    const after = this.pos.clone();
    after.play(move);
    // Lichess accepts any mating move, not only the stored one.
    if (!same && !after.isCheckmate()) return 'wrong';

    this.pos = after;
    this.ply++;
    if (after.isCheckmate() || this.ply >= this.data.moves.length) return 'solved';
    return 'continue';
  }

  playReply(): Move {
    return this.playExpected();
  }

  /** Promotion role from the stored solution when it matches orig/dest, so underpromotions work without a picker. */
  expectedPromotion(from: number, to: number): Move | undefined {
    const expected = parseUci(this.data.moves[this.ply]);
    if (expected && 'from' in expected && expected.from === from && expected.to === to) return expected;
    return undefined;
  }

  private playExpected(): Move {
    const move = parseUci(this.data.moves[this.ply])!;
    this.pos.play(move);
    this.ply++;
    return move;
  }
}
