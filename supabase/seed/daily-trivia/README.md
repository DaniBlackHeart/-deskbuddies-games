# Daily Trivia questions

1. Copy `questions-template.csv`, delete the two EXAMPLE rows, add your questions (one per row).
2. Run `node supabase/seed/daily-trivia/questions-to-sql.mjs your-file.csv > supabase/migrations/00NN_daily_trivia_questions.sql`
   (use the next unused migration number). The script stops and names the row if something is wrong.
3. Read the generated SQL, then `npx supabase db push`.

How questions are served: a question with `scheduled_for` is shown on that day; otherwise the next
never-shown question is picked at random, and once all have been shown the one shown longest ago.
To retire a question: `update daily.trivia_questions set is_active = false where id = '...';`

Questions and answers are fact-checked by whoever supplies them. Nothing here is loaded automatically.
