-- DeskBuddies Games — let a member who is HOSTING Trivia Night read that
-- session's answers.
--
-- 0043 opened hosting to every member, but the trivia host page lists typed
-- answers waiting for grading by reading `answers`, whose only policies were
-- "read own" and "mods read all" (0001). A member host would have seen an empty
-- grading list. Same idea as the other host-reads policies in 0043: the host
-- of THAT session only.

create policy "answers: host reads"
  on public.answers for select
  using (public.is_session_host('trivia', session_id));
