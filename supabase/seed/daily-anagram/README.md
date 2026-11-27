# Daily Anagram ("Letter Shuffle") answer words

`answers.txt` holds the answer words (7 to 9 letters). `migrations/0055_daily_anagram_words.sql` loads them.
They are the common words from SCOWL (notice: ../daily-puzzle/NOTICE-SCOWL.txt) that have exactly one anagram in a large
English word list, minus plurals/-ed/-ing/-ly/-er/-est forms and anything flagged. Add words you do not want to
`answer-blocklist.txt` and re-run `generate-anagram-answers.mjs` (same setup as the Daily Puzzle generator: a folder with
`npm i wordlist-english an-array-of-english-words naughty-words`). To pull a word that is already loaded:
`delete from daily.anagram_answers where word = '...' and last_used_on is null;`
