-- Family Feud — real face-off rebuttal mechanic
--
-- Previously, ANY correct match during face-off immediately decided
-- control, even if it wasn't the top answer. On the real show, a
-- correct-but-not-top answer gives the other rep a shot to beat it, and
-- whichever matched answer is worth more wins control (a miss/timeout on
-- either side just means the other rep's match stands). Top-answer matches
-- still resolve immediately, since nothing can beat them.
--
-- These three columns hold the first rep's match (if it wasn't the top
-- answer) while the second rep gets their turn, so it can be compared
-- against.
alter table public.feud_rounds
  add column face_off_provisional_user_id uuid references public.profiles (id),
  add column face_off_provisional_index int,
  add column face_off_provisional_points int;
