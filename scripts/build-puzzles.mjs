#!/usr/bin/env node
// Builds a fixed, rating-ramped puzzle set from the Lichess puzzle DB CSV.
// Usage: node scripts/build-puzzles.mjs --in data/puzzles-sample.csv --out public/sets/default.json [--seed 42] [--count 150]

import { createReadStream, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createInterface } from 'node:readline';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);

const cfg = {
  in: args.in ?? 'data/puzzles-sample.csv',
  out: args.out ?? 'public/sets/default.json',
  seed: Number(args.seed ?? 42),
  count: Number(args.count ?? 150),
  minRating: Number(args['min-rating'] ?? 700),
  maxRating: Number(args['max-rating'] ?? 2400),
  maxPlayerMoves: Number(args['max-player-moves'] ?? 3),
  minPopularity: Number(args['min-popularity'] ?? 80),
  minPlays: Number(args['min-plays'] ?? 300),
  maxRd: Number(args['max-rd'] ?? 90),
};

const BUCKET = 25;

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const buckets = new Map();
let header;
let kept = 0;

const rl = createInterface({ input: createReadStream(cfg.in), crlfDelay: Infinity });
for await (const line of rl) {
  if (!header) {
    header = Object.fromEntries(line.split(',').map((h, i) => [h, i]));
    continue;
  }
  const f = line.split(',');
  const rating = Number(f[header.Rating]);
  const moves = f[header.Moves].split(' ');
  const playerMoves = Math.ceil((moves.length - 1) / 2);
  if (
    rating < cfg.minRating - BUCKET ||
    rating > cfg.maxRating + BUCKET ||
    playerMoves > cfg.maxPlayerMoves ||
    Number(f[header.Popularity]) < cfg.minPopularity ||
    Number(f[header.NbPlays]) < cfg.minPlays ||
    Number(f[header.RatingDeviation]) > cfg.maxRd
  )
    continue;
  const b = Math.floor(rating / BUCKET);
  if (!buckets.has(b)) buckets.set(b, []);
  buckets.get(b).push({ id: f[header.PuzzleId], fen: f[header.FEN], moves, rating });
  kept++;
}

// Sort before shuffling so output depends only on the seed, not CSV row order.
const rand = mulberry32(cfg.seed);
for (const list of buckets.values()) {
  list.sort((a, b) => a.id.localeCompare(b.id));
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
}

function take(target) {
  const center = Math.floor(target / BUCKET);
  for (let d = 0; d < 40; d++) {
    for (const b of d === 0 ? [center] : [center + d, center - d]) {
      const list = buckets.get(b);
      if (list?.length) return list.pop();
    }
  }
  throw new Error(`No puzzle left near rating ${target}`);
}

const puzzles = [];
for (let i = 0; i < cfg.count; i++) {
  // sqrt curve: climbs fast early, flattens so late puzzles stay solvable.
  const t = Math.sqrt(i / (cfg.count - 1));
  puzzles.push(take(cfg.minRating + t * (cfg.maxRating - cfg.minRating)));
}

const set = { id: `seed-${cfg.seed}`, seed: cfg.seed, generatedAt: new Date().toISOString(), puzzles };
mkdirSync(dirname(cfg.out), { recursive: true });
writeFileSync(cfg.out, JSON.stringify(set));
console.log(`candidates=${kept} picked=${puzzles.length} ratings=${puzzles[0].rating}..${puzzles.at(-1).rating} -> ${cfg.out}`);
