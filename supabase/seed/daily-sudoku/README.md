# Number Nook (daily sudoku) puzzles

`generate-sudoku-puzzles.mjs` builds puzzles from scratch (random full grid, then numbers removed while the puzzle
keeps exactly one solution). It needs only Node, no packages:

    node supabase/seed/daily-sudoku/generate-sudoku-puzzles.mjs 400 > puzzles.tsv   # count, optional seed

Today it only makes Easy puzzles (singles-only solvable, 40 to 46 given numbers). `0057_daily_sudoku_puzzles.sql` loads 400.
To change the difficulty for all days: `update daily.sudoku_settings set difficulty = 'medium';` once Medium puzzles are loaded.
A puzzle that was already shown on a day is never changed; the setting only affects days not yet picked.
