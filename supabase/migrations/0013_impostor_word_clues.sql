-- DeskBuddies Games — Impostor WHO?: per-word clues for the Impostor
--
-- Correction from playtesting: the Impostor's card was showing the
-- CATEGORY name as their "clue" (see 0012's reasoning for why that
-- seemed like a clean reading of the spec at the time). That's not
-- actually what was wanted — the Impostor needs a genuine clue about the
-- SPECIFIC secret word, authored by the MOD alongside each word, not
-- merely the category it belongs to.
--
-- impostor_words.clue is nullable on purpose — words created before this
-- migration have no clue yet, and a MOD may still choose to leave one
-- blank for a given word. impostor_cards.clue is where the resolved value
-- actually lands for a given session (written once, at start_game, in
-- impostor-host) — with a category-name fallback baked into that same
-- write so an un-clued word doesn't leave the Impostor with nothing at
-- all. category_name stays on both the session and the card regardless —
-- it's genuinely public info (every crew member's card shows it too), so
-- there's no reason to hide it from the Impostor; the clue is additional
-- information on top of that, not a replacement for it.

alter table public.impostor_words add column clue text;
alter table public.impostor_cards add column clue text;
