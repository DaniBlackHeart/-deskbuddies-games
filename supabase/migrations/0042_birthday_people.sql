-- Birthday names that can be opened (Buddy Calendar: tap a birthday name to visit their profile).
-- The names alone cannot say WHO someone is, so the sync now also keeps each person's Discord id.
-- Nothing here is sent to the browser: the calendar function turns an id into a Debbie member id
-- only for people who have signed in to Debbie, and the browser never sees a Discord id.
alter table public.birthday_names
  add column if not exists people jsonb not null default '[]'::jsonb;

-- Make the next calendar visit re-read the birthday roles so the new column fills in.
update public.calendar_settings set birthdays_synced_at = null where id = true;
