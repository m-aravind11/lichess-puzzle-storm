# lichess-puzzle-storm
A custom web-app implementation of the PuzzleStorm feature with real-time leaderboard tracking

## Run

```sh
npm install
npm run dev        # http://localhost:5173
npm test
```

## Puzzle sets

Puzzles come from the [Lichess puzzle database](https://database.lichess.org/#puzzles) (CC0).
`data/` is gitignored; grab a sample (first 400k rows, no full download needed):

```sh
mkdir -p data
curl -sL https://database.lichess.org/lichess_db_puzzle.csv.zst | zstd -dc | head -n 400001 > data/puzzles-sample.csv
npm run puzzles -- --seed 42 --count 150
```

Same seed → same set, so every player in a competition gets identical puzzles.
Options: `--min-rating`, `--max-rating`, `--max-player-moves`, `--min-popularity`, `--min-plays`, `--max-rd`.
