# Word Hunt (daily word search) puzzles

`words.txt` is the word list (cozy desk-life words, a few Filipino ones). Edit it, then rebuild puzzles with Node only:

    node supabase/seed/daily-word-search/generate-word-search-puzzles.mjs 365 2026 > puzzles.tsv   # count, seed

Each grid is 10 x 10 with 8 words (4 to 8 letters) running right, down or diagonally down-right. Every word occurs
exactly once in the grid (any direction), and the filler letters are checked against a short list of unkind words.
`0059_daily_word_search_puzzles.sql` loads 365 (about a year). To add more later, generate with a different seed and
turn the rows into another insert; a repeated grid is refused by the unique column.
