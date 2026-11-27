# Daily Puzzle word lists (draft, for review)

- answers-first-1000.txt: the launch answer set. Needs Dani/Rika review before loading.
- answers-pool.txt: about 3,000 more candidate answers for later (same filters, less common words).
- guesses.txt: every word a member may guess (about 12,700). Contains all answers.
- flagged-for-review.txt: words left out of answers (offensive, sensitive, odd forms). They stay valid as guesses.
- answer-blocklist.txt: words removed from answers by hand. Add words here and rerun to remove them.
- generate-word-lists.mjs: regenerates the files. Needs `npm i wordlist-english an-array-of-english-words naughty-words` in the folder it is run from.
- NOTICE-SCOWL.txt: SCOWL copyright and licence notice. Keep it with the lists.

Sources: SCOWL via the wordlist-english package (MIT package, SCOWL licence in the notice), the dwyl English word list via an-array-of-english-words (Unlicense), and the naughty-words list (CC BY 4.0, used only offline to flag answers, not shipped).
