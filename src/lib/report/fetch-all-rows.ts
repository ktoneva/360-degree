/**
 * Supabase/PostgREST caps any unpaginated select() at 1000 rows by default --
 * silently, no error, no truncation flag. Any query whose result could
 * plausibly exceed that (anything scoped to a whole organisation, a pooled
 * group like SLT, or even a single cycle with many raters and a large item
 * bank) must page through with .range() rather than trusting one select()
 * to return everything.
 */
export async function fetchAllRows<T>(
  makeQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const results: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await makeQuery(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    results.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return results;
}
