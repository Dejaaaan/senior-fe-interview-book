---
title: "Pagination, filtering, sorting"
sidebar_label: "9.2 Pagination, filtering, sorting"
description: "Cursor vs. offset, the cursor-encoding patterns that scale, and the senior way to design list endpoints."
sidebar_position: 2
---

This chapter covers the practical mechanics of paginating, filtering, and sorting list endpoints — the patterns that survive contact with real-world data volumes and concurrent writes, rather than the textbook offset/limit that fails at the first sign of scale.

> **Acronyms used in this chapter.** API: Application Programming Interface. BI: Business Intelligence. DB: Database. DoS: Denial of Service. HTTP: Hypertext Transfer Protocol. JSON: JavaScript Object Notation. REST: Representational State Transfer. SQL: Structured Query Language. URL: Uniform Resource Locator.

## Offset pagination

The intuitive choice that works well for small, stable lists.

```h
ttpGET /tasks?page=2&pageSize=20

-> 200 OK
  { "items": [...], "page": 2, "pageSize": 20, "total": 137 }
```

The trade-offs are straightforward. The benefit is that offset pagination is simple to implement, easy for clients to reason about, and supports random-access navigation ("page 5 of 12") that cursor pagination cannot easily express. The first cost is performance at depth — at deep offsets, the database still scans the skipped rows because `OFFSET 10000 LIMIT 20` cannot be answered without identifying the first ten thousand rows; the cost grows linearly with depth. The second cost is instability under concurrent writes — inserting an item before page 2 shifts every subsequent row, so the user sees an item twice or skips one when paginating, which is unacceptable for any user-facing feed.

## Cursor pagination

The framing senior candidates typically present as the default for feeds, timelines, and any endpoint where stability and depth performance matter.

```h
ttpGET /tasks?cursor=eyJpZCI6ImFiYyIsInRzIjoxNzAwfQ&limit=20

-> 200 OK
  {
    "items": [...],
    "next_cursor": "eyJpZCI6ImRlZiIsInRzIjoxNzIwfQ"
  }
```

The cursor encodes "where to start from" — typically the sort key of the last item in the previous page. The server uses an indexed predicate (`WHERE created_at < $cursor.ts OR (created_at = $cursor.ts AND id < $cursor.id)`), which scales to billions of rows.

### Encoding the cursor

Do not expose the database schema in the cursor. Encode the cursor as an opaque base64 string so clients cannot infer the underlying sort key, the database column names, or the table structure from the cursor value. The opacity also gives the team room to change the cursor encoding in future without breaking clients that have stored cursors.

```ts
function encodeCursor(item: { id: string; createdAt: string }): string {
  return Buffer.from(JSON.stringify({ id: item.id, ts: item.createdAt })).toString("base64url");
}

function decodeCursor(s: string): { id: string; ts: string } {
  return JSON.parse(Buffer.from(s, "base64url").toString());
}
```

Treat malformed cursors as 400 (Bad Request) — a corrupted cursor is a client error that the team should reject explicitly rather than silently returning the first page or an empty list, both of which obscure the underlying problem.

### Bidirectional cursors

For feeds that support both "load older" and "load newer" navigation (chat applications, social media timelines, log readers), expose both `next_cursor` and `prev_cursor` on each response. Some Application Programming Interfaces return both cursors whenever they are applicable; others return only the cursor relevant to the current navigation direction. The bidirectional pattern is more flexible but doubles the cursor-handling logic on the client.

## Keyset pagination — what cursor is, formally

The "cursor pagination" pattern described above is usually [keyset pagination](https://use-the-index-luke.com/no-offset) under a friendlier name. The implementation pattern:

```sql
SELECT *
FROM tasks
WHERE (created_at, id) < ($cursor_ts, $cursor_id)   -- composite key for stability
ORDER BY created_at DESC, id DESC
LIMIT $limit + 1;                                    -- one extra to know if there's a next page
```

The `+ 1` is a small but important trick: fetch one more row than the requested page size so the server can determine whether `next_cursor` should be present in the response. If the query returns the requested number of rows, there is more data and the response includes `next_cursor`; if the query returns fewer rows, the client has reached the end and `next_cursor` is omitted. The extra row is dropped before the response is serialised.

## Filtering

Document the supported filters explicitly so consumers know what is available. The two common patterns differ in expressiveness and complexity. *Flat* filtering uses repeated query parameters that combine via logical AND (`?status=open&priority=high`); the model is simple to implement and clients can compose query strings without a library. *Structured* filtering uses bracket notation to express operators (`?filter[status][in]=open,blocked&filter[priority][gte]=2`); the model is more expressive and can support OR, IN, range, and other operators, but the parsing is more complex and clients typically need a helper to build the query strings.

For most Application Programming Interfaces, flat filtering is sufficient. Reach for structured filtering when consumers genuinely need OR, IN, range, or other relational operators that flat filtering cannot express.

If the team is designing for a heavy query workload — Business Intelligence tools, dashboards, search experiences — consider a separate search endpoint with a JavaScript Object Notation body. The body-based approach allows arbitrary query expression without the constraints of Uniform Resource Locator query parameter encoding.

```h
ttpPOST /tasks/search
Content-Type: application/json

{
  "filters": { "status": { "in": ["open", "blocked"] }, "priority": { "gte": 2 } },
  "sort": [{ "field": "createdAt", "dir": "desc" }],
  "page": { "cursor": "...", "limit": 50 }
}
```

This is the JSON:API or Elasticsearch-style query model. It is heavier to design and implement, but more flexible than the Uniform Resource Locator query string approach.

## Sorting

```h
ttpGET /tasks?sort=-createdAt,title
```

The conventions are simple. Comma-separated values express multi-key sort, with the precedence determined by order. A leading minus sign on a field expresses descending order. The team must whitelist sortable fields server-side and never allow the client to sort by arbitrary columns; an unrestricted sort is a Denial-of-Service vector (sorting by a non-indexed column on a large table can take seconds and exhaust connections) and an information-disclosure vector (sorting by `password_hash` would let an attacker enumerate password hashes by their lexical ordering).

```ts
const sortable = new Set(["createdAt", "updatedAt", "title", "priority"]);
const sortFields = (req.query.sort ?? "")
  .split(",")
  .map((s) => ({ field: s.replace(/^-/, ""), dir: s.startsWith("-") ? "desc" : "asc" }))
  .filter((s) => sortable.has(s.field));
```

## Sparse fieldsets

Sparse fieldsets let the client request only the specific fields it needs (`?fields=id,title,status`). The pattern is useful when responses are heavy (many fields, many of them large strings or nested objects) and the client only needs a small subset for its current view. The server reads the requested field list, validates it against a whitelist of known fields, and projects the result accordingly.

```ts
function project<T extends object>(item: T, fields: (keyof T)[]): Partial<T> {
  const out: Partial<T> = {};
  for (const f of fields) out[f] = item[f];
  return out;
}
```

GraphQL solves the over-fetching problem natively (each query specifies the exact fields it needs), which is one of the structural reasons teams adopt it.

## Total counts: when to skip them

Returning a total row count (`"total": 137`) requires a second query (`COUNT(*)`) on every page request, and at scale that count is often more expensive than the page itself because it scans the entire filtered set rather than just the page-sized window. The senior alternatives reduce or eliminate the cost.

Skip the total entirely; return only `next_cursor` and the items, and let the client display "you've reached the end" when `next_cursor` is absent. Use an approximate count derived from database statistics (Postgres exposes `pg_stat_user_tables.n_live_tup` for approximate row counts) when the total is genuinely useful for the user but a precise count is not required. Cache an approximate total separately and return it as a `Last-Page-Hint` value, refreshed asynchronously rather than on every request.

Twitter, Instagram, and similar platforms do not display "page 47 of 1,200" because the cost of computing the total at scale is prohibitive and the user-facing benefit is small.

## Aggregations and search

List endpoints are typically paginated; aggregations (totals, sums, distinct counts) and full-text search rarely follow the same pagination pattern. Aggregations usually return the entire result because the result set is small relative to the underlying data; pagination of an aggregation is rarely useful. Search endpoints are typically a separate endpoint, sorted by relevance rather than by a stable key, and use cursor-style pagination with a "more available" approximation rather than the precise cursor model.

The team should not conflate aggregation, search, and list endpoints — their implementation patterns and trade-offs are sufficiently different that a single endpoint trying to serve all three is rarely well-suited to any of them.

## Key takeaways

Cursor pagination scales to billions of rows; offset/limit pagination is fine for small bounded lists. Encode cursors as opaque base64 to avoid leaking the database schema and reject malformed cursors with a 400 response. Use composite keys (typically timestamp plus identifier) for cursor pagination so the order is stable across ties on the primary sort key. Whitelist sortable and filterable fields server-side to avoid Denial-of-Service and information-disclosure risks. Skip the total count at scale; cursor pagination plus "more available" is sufficient for most user experiences. Sparse fieldsets are the pre-GraphQL solution to over-fetching and remain useful when the team does not want the operational complexity of GraphQL.

## Common interview questions

1. Walk me through a cursor pagination implementation for a Twitter-like feed.
2. Why is offset pagination slow at deep offsets?
3. How do you make pagination stable when items are inserted while paginating?
4. Why might you NOT return a total count?
5. What stops a client from sorting by `password_hash`?

## Answers

### 1. Walk me through a cursor pagination implementation for a Twitter-like feed.

The implementation has four layers. The cursor encodes the last item's sort key (typically a composite of `created_at` and `id` to handle ties) as an opaque base64 string. The query uses a keyset predicate — `WHERE (created_at, id) < (?, ?)` — so the database can use an index on `(created_at, id)` to seek directly to the cursor's position without scanning earlier rows. The query selects one more row than the requested page size to determine whether more data exists. The response includes the page items, omitting the extra row, and includes `next_cursor` only if the extra row was present.

**How it works.** The keyset predicate translates "give me the next twenty items after this cursor" into an indexed seek. Without the keyset predicate, the database must scan from the beginning of the sort order to the cursor's position, which is what offset/limit does. With the keyset predicate, the database uses the index to jump to the cursor's position and read forward, which is constant-cost regardless of how deep the cursor points.

```ts
async function getFeedPage(cursor: string | undefined, limit: number) {
  const cursorValues = cursor ? parseCursor(cursor) : null;
  const items = await db.query(
    `SELECT * FROM tweets
     WHERE author_id = $1
       AND ($2::timestamptz IS NULL
            OR (created_at, id) < ($2, $3))
     ORDER BY created_at DESC, id DESC
     LIMIT $4`,
    [userId, cursorValues?.createdAt ?? null, cursorValues?.id ?? null, limit + 1],
  );
  const hasMore = items.length > limit;
  const pageItems = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? buildCursor(pageItems[pageItems.length - 1]) : undefined;
  return { items: pageItems, nextCursor };
}
```

**Trade-offs / when this fails.** The pattern requires a stable sort order; if an item's `created_at` changes (which is rare for tweets but possible for editable resources), the cursor may point at a position that has moved and the client may see duplicates or skipped items. The cure is to pick sort keys that do not change frequently and to document the consistency guarantees the Application Programming Interface provides. The pattern also requires a covering index on the sort columns; without the index, the keyset predicate degrades to a scan and the performance benefit is lost. The cure is to ensure the index exists and to monitor query plans in production.

### 2. Why is offset pagination slow at deep offsets?

Offset pagination is slow at depth because the database cannot answer "skip the first ten thousand rows" without identifying them — there is no Structured Query Language operator that means "skip N rows" without traversing them. The query plan for `OFFSET 10000 LIMIT 20` reads ten thousand and twenty rows from the index, discards the first ten thousand, and returns the last twenty; the cost grows linearly with the offset. In contrast, the keyset query `WHERE (created_at, id) < (?, ?) LIMIT 20` uses the index to seek directly to the cursor's position and reads only the twenty rows the page needs.

**How it works.** The database engine processes `OFFSET N` by reading rows in the requested order and decrementing a counter; once the counter reaches zero, it starts returning rows. The work to read and discard the first N rows is unavoidable because the engine cannot know which rows to discard without examining them. For small offsets the cost is invisible; for deep offsets the cost dominates the response time.

```sql
-- Offset: scans 10,020 rows.
SELECT * FROM tweets ORDER BY created_at DESC LIMIT 20 OFFSET 10000;

-- Keyset: scans 20 rows.
SELECT * FROM tweets
WHERE (created_at, id) < ($cursor_ts, $cursor_id)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

**Trade-offs / when this fails.** The performance difference is invisible for shallow offsets (the first few pages) and only becomes significant at depth. The cure is to use offset for shallow access patterns (an admin table where the user rarely reaches page 5) and cursor for deep access patterns (an infinite feed that may scroll thousands of pages). The keyset approach also cannot easily express "go to page 47", which is sometimes a user requirement; the cure for that case is to fall back to offset pagination with the understanding that it is slow at depth.

### 3. How do you make pagination stable when items are inserted while paginating?

Use cursor pagination with a stable composite sort key (typically `created_at` plus `id` as a tiebreaker). The cursor encodes the position in terms of the sort key, not the offset, so an insertion or deletion before the cursor's position does not shift the cursor — the next page returns the items immediately after the cursor in sort order, regardless of what has been inserted or deleted earlier. With offset pagination, an insertion before page 2 shifts every subsequent row, causing the user to see an item twice or skip one when paginating.

**How it works.** The cursor's invariant is "give me the items whose sort key is less than this cursor's sort key". Inserting an item with a sort key earlier than the cursor's position does not change the set of items returned by the next page query; the new item simply does not appear (because its sort key is not less than the cursor's). Inserting an item later than the cursor's position is irrelevant to subsequent pages; the new item will eventually appear when pagination reaches its sort-key position.

```ts
const cursor = encodeCursor({
  createdAt: lastItem.createdAt,
  id: lastItem.id,
});
```

**Trade-offs / when this fails.** The pattern fails when the sort key changes for items in the paginated set; if an item's `created_at` is updated, the cursor may now point at a position that has moved, and the client may see duplicates or skipped items. The cure is to pick sort keys that do not change. The pattern also fails if the team uses a single non-unique sort key (just `created_at` with no tiebreaker); the cure is to add the unique identifier as a tiebreaker so the order is stable across rows with identical `created_at` values.

### 4. Why might you NOT return a total count?

Returning a total count requires a second database query — `COUNT(*)` over the filtered set — that scans every matching row regardless of how few are returned in the page. At scale, the count query is often more expensive than the page itself; on a table with millions of rows and a non-trivial filter, the count may take seconds while the page query takes milliseconds. The total count is also rarely useful for the user; an infinite feed never displays "page 47 of 1,200" because the number conveys little to the reader and the cost of computing it is prohibitive.

**How it works.** The team has three alternatives that avoid the cost. Skip the total entirely and return only `next_cursor`; the client displays "you have reached the end" when `next_cursor` is absent. Use an approximate count derived from database statistics (Postgres exposes `pg_stat_user_tables.n_live_tup` for approximate live row counts); the count is not exact but is often good enough for "approximately ten thousand results". Cache the count separately and return it as an approximate value, refreshed asynchronously rather than computed on every request.

```sql
SELECT n_live_tup
FROM pg_stat_user_tables
WHERE relname = 'tweets';
```

**Trade-offs / when this fails.** Skipping the total fails when the total is genuinely required for the user experience (a search results page that wants to display "1,247 results"); the cure is to use the approximate or cached count and to be honest about its precision in the user interface. Returning the total fails when the team claims it is exact but the underlying count query is approximate (replication lag, deferred indexes); the cure is to label the value as approximate when it is approximate.

### 5. What stops a client from sorting by `password_hash`?

A server-side whitelist of sortable fields. The Application Programming Interface declares which fields can be sorted (`createdAt`, `updatedAt`, `title`, `priority`) and rejects any sort request that references a field outside the whitelist. Without the whitelist, a client could request `?sort=password_hash` and the server would happily order the response by that column, which produces both a Denial-of-Service vector (sorting by a non-indexed column requires a full sort of the result set, which is expensive on large tables) and an information-disclosure vector (the lexical ordering of password hashes leaks information about their values, which an attacker could use to enumerate hashes).

**How it works.** The handler parses the `sort` parameter, splits it into individual sort keys, validates each key against the whitelist, and rejects the request with a 400 response if any key is not in the whitelist. The whitelist also caps the number of sort keys (typically two or three) to bound the cost of the multi-key sort.

```ts
const sortable = new Set(["createdAt", "updatedAt", "title", "priority"]);

function parseSort(input: string | undefined) {
  if (!input) return [{ field: "createdAt", dir: "desc" as const }];
  return input.split(",").slice(0, 3).map((s) => {
    const dir = s.startsWith("-") ? "desc" : "asc";
    const field = s.replace(/^-/, "");
    if (!sortable.has(field)) throw new HttpError(400, `Cannot sort by ${field}`);
    return { field, dir };
  });
}
```

**Trade-offs / when this fails.** The whitelist must be maintained as the schema evolves; a new sortable field is added to the database but forgotten in the whitelist, so clients cannot use it. The cure is to derive the whitelist from a single source of truth (the database column metadata, the OpenAPI specification) so the whitelist stays in sync with the schema. The pattern also fails when the team allows sort by foreign-key references without bounding the join cost; the cure is to either disallow such sorts or to require an index on the join column.

## Further reading

- [Use the Index, Luke! — No Offset](https://use-the-index-luke.com/no-offset).
- [Slack engineering on cursor-based pagination](https://slack.engineering/evolving-api-pagination-at-slack/).
- [JSON:API on filtering, sorting, sparse fieldsets](https://jsonapi.org/format/).
