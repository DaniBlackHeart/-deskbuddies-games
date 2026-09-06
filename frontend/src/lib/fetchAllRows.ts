// Supabase/PostgREST caps every response at a fixed row limit (this
// project's is 1000) regardless of how many rows actually match a filter —
// a plain `.select()` past that point doesn't error, it just silently
// hands back the first page and nothing after it. That's invisible right
// up until a table crosses the cap, at which point anything built on "this
// select returns everything" quietly starts working on a truncated slice —
// discovered 2026-09-06 when the Visual Arrangement rebus set passed 1000
// active puzzles and both the set editor and the bulk-delete/renumber
// logic in archiveOrDelete.ts started missing the tail end of the set
// (import order_index collisions, renumbering only the first 1000).
//
// Use this instead of a bare `.select()` for any query whose result count
// isn't already bounded by a small `.limit()`/`.single()`/a known-small
// table. Pass a function that builds the query for a given `.range(from,
// to)` — this pages through with that range until a page comes back
// shorter than the page size, and concatenates every row.
const PAGE_SIZE = 1000;

export async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<{ data: T[]; error: { message: string } | null }> {
  const rows: T[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
    if (error) return { data: rows, error };
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return { data: rows, error: null };
}
