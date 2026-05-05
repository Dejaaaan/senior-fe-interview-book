---
title: "DynamoDB"
sidebar_label: "12.6 DynamoDB"
description: "Single-table design intro, GSIs, query vs scan, and the patterns a frontend lead must know."
sidebar_position: 6
---

DynamoDB is a managed NoSQL key-value and document store. It offers substantial scale, predictable single-digit-millisecond latency, and pay-per-use pricing. Senior opinion is divided in roughly equal measure between those who consider it the best operational primitive on Amazon Web Services and those who consider it an anti-pattern outside very specific use cases; the truth depends on whether the application's access patterns fit the model.

**Acronyms used in this chapter.** ACID (Atomicity, Consistency, Isolation, Durability), Application Programming Interface (API), Amazon Web Services (AWS), DynamoDB (DDB), Global Secondary Index (GSI), JavaScript (JS), Local Secondary Index (LSI), Network Operations Center (NoSQL), Online Analytical Processing (OLAP), Online Transaction Processing (OLTP), Partition Key (PK), Primary Key (PK), Read Capacity Unit (RCU), Relational Database Management System (RDBMS), Relational Database Service (RDS), Sort Key (SK), Stock Keeping Unit (SKU), Time-Series Database (TSDB), Time-to-Live (TTL), Write Capacity Unit (WCU).

## Mental model

- **Table**: a collection of items.
- **Item**: a row, identified by a primary key, with arbitrary attributes.
- **Primary key**: either Partition Key only, or Partition Key + Sort Key.
- **Partition (PK)**: shards distribute by hash of PK; items with the same PK live together.
- **Sort key (SK)**: order within a PK; enables range queries.

```text
Table: users
PK: USER#alice    SK: PROFILE              email=alice@x.com
PK: USER#alice    SK: ORDER#2026-01-01     total=49.99
PK: USER#alice    SK: ORDER#2026-02-15     total=12.00
```

A `Query` against `PK = USER#alice` returns the profile + all orders. A `Query` with `PK = USER#alice AND SK begins_with ORDER#` returns just orders.

## Query vs Scan

- **Query**: equality on PK (required) + optional condition on SK. O(1) by partition. Cheap and fast. **Use this.**
- **Scan**: read every item; filter in memory. Linear in table size. Slow and expensive. **Avoid in production paths.**

If you find yourself reaching for Scan, you've modelled wrong. Add an index.

## Secondary indexes

- **LSI (Local Secondary Index)**: same PK, different SK. Created at table creation only. 5 per table.
- **GSI (Global Secondary Index)**: different PK and/or SK. Created/dropped anytime. 20 per table.

GSIs are how you support multiple access patterns. Each GSI is a copy of (a subset of) the table sorted differently.

```text
Table: orders
PK: order_id
GSI: by_customer
  PK: customer_id   SK: created_at
GSI: by_status
  PK: status         SK: created_at
```

`Query orders by_customer where customer_id = 123 AND created_at >= 2026-01-01` — fast.
`Query orders by_status where status = "pending"` — fast.

## Single-table design

The DynamoDB-native pattern: instead of one table per entity (RDBMS-style), one table holding **all** your entities, distinguished by PK/SK conventions.

```text
PK                         SK                         entity   payload...
USER#alice                 PROFILE                    user     email=...
USER#alice                 ORDER#2026-01-01           order    total=...
ORG#acme                   USER#alice                 member   role=admin
PRODUCT#widget             METADATA                   product  name=...
PRODUCT#widget             REVIEW#2026-02-15#bob      review   rating=5
```

Trade-offs:

- **Pro**: a single Query can fetch heterogeneous related data (user + their orders) in one round trip.
- **Pro**: lower cost, fewer table operations.
- **Con**: tooling and validation are weaker (a single table holds many shapes).
- **Con**: the schema lives in your code, not the DB. Need rigorous typing.

For senior interviews: explain that single-table is the "DynamoDB way" but multi-table is fine for simpler apps and easier for team comprehension.

## Access patterns first

The cardinal rule: **list every access pattern before designing the table**. NoSQL is the inverse of RDBMS — you can't just join later.

```text
1. Get a user by id.
2. List a user's orders, newest first.
3. List orders by status, paginated.
4. Get an order by id.
5. List members of an org.
```

For each, decide: PK, SK, which index. The table design falls out.

## Capacity modes

- **On-demand**: pay per request. No capacity planning. Recommended default.
- **Provisioned**: reserve RCU/WCU. Cheaper at steady-state. Use auto-scaling. Pick if you have predictable load and want a 70%+ saving.

Switch between them once per 24 hours.

## Item structure

Items are JSON-like; max 400 KB per item. Top-level attributes have types: `S` (string), `N` (number), `B` (binary), `BOOL`, `NULL`, `M` (map), `L` (list), `SS`/`NS`/`BS` (sets).

```ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

await ddb.send(
  new PutCommand({
    TableName: "app",
    Item: {
      PK: `USER#${userId}`,
      SK: "PROFILE",
      email: "alice@example.com",
      createdAt: new Date().toISOString(),
    },
    ConditionExpression: "attribute_not_exists(PK)",
  })
);

const r = await ddb.send(
  new QueryCommand({
    TableName: "app",
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: {
      ":pk": `USER#${userId}`,
      ":prefix": "ORDER#",
    },
    ScanIndexForward: false,
    Limit: 20,
  })
);
```

`DocumentClient` marshals JS objects ↔ DDB AttributeValues. Always use it.

## Conditional writes (the secret weapon)

```ts
await ddb.send(
  new UpdateCommand({
    TableName: "app",
    Key: { PK: `USER#${userId}`, SK: "PROFILE" },
    UpdateExpression: "SET email = :e, version = version + :one",
    ConditionExpression: "version = :expected",
    ExpressionAttributeValues: {
      ":e": newEmail,
      ":one": 1,
      ":expected": currentVersion,
    },
  })
);
```

Optimistic concurrency in one round trip. The condition is evaluated atomically with the write; if it fails, AWS returns `ConditionalCheckFailedException` and the write is rolled back.

## Transactions

`TransactWriteItems` and `TransactGetItems` give multi-item ACID. Up to 100 items per transaction; 2x the cost of regular writes. Use sparingly.

```ts
await ddb.send(
  new TransactWriteCommand({
    TransactItems: [
      {
        Update: {
          TableName: "app",
          Key: { PK: `INVENTORY#${sku}`, SK: "STOCK" },
          UpdateExpression: "SET available = available - :q",
          ConditionExpression: "available >= :q",
          ExpressionAttributeValues: { ":q": qty },
        },
      },
      {
        Put: {
          TableName: "app",
          Item: { PK: `ORDER#${orderId}`, SK: "ORDER", sku, qty },
        },
      },
    ],
  })
);
```

## Streams

A change feed for the table. Lambda consumes; useful for materialised views, denormalisation, audit logs.

```ts
const fn = new NodejsFunction(stack, "MaterialiseFn", { ... });
fn.addEventSource(new DynamoEventSource(table, {
  startingPosition: StartingPosition.LATEST,
  batchSize: 100,
  retryAttempts: 3,
  bisectBatchOnError: true,
}));
```

Streams + Lambda is the canonical way to keep a search index (OpenSearch) or a cache fresh.

## TTL

Set an attribute (e.g. `expiresAt`, a Unix timestamp) and DDB will delete the item at that time (within hours, not real-time). Free.

```ts
await ddb.send(new PutCommand({
  TableName: "sessions",
  Item: { PK: sessionId, expiresAt: Math.floor(Date.now() / 1000) + 3600 },
}));
```

Great for sessions, idempotency keys, ephemeral data.

## Pagination

DDB returns results in pages with a `LastEvaluatedKey`. Pass it back as `ExclusiveStartKey` for the next page. Encode as opaque cursor (base64 JSON) for the client — see [Part 9 chapter 2 (Pagination & filtering)](../09-rest-and-networking/02-pagination-filtering.md).

## Anti-patterns

- **Storing everything in one item** (you'll hit 400 KB).
- **PK with low cardinality** (e.g. `status` as PK with values "active"/"inactive"): hot partition.
- **Scan in production** — almost always wrong.
- **No GSI; doing client-side filtering** — fix the model.
- **Mixing transactional and analytical workloads** — DDB is for OLTP. For analytics, stream to S3/Athena.

## When to pick something else

- Need joins / ad-hoc queries → Aurora Postgres or RDS.
- Time-series data with complex aggregations → Timestream, Redshift, or open-source TSDBs.
- Full-text search → OpenSearch (with DDB as system of record).

## Key takeaways

The senior framing for DynamoDB: design from access patterns; the Partition Key and Sort Key fall out. Query, never Scan, in hot paths. Use Global Secondary Indexes for additional access patterns. Use conditional writes for optimistic concurrency. Use streams plus Lambda for derived views and materialised projections. Default to on-demand capacity; switch to provisioned plus auto-scaling once the load is well understood.

## Common interview questions

1. Query vs Scan?
2. What is a GSI and when do you add one?
3. Walk through single-table design.
4. How do you implement optimistic concurrency in DDB?
5. When would you NOT use DynamoDB?

## Answers

### 1. Query vs Scan?

A `Query` performs equality on the Partition Key (required) and an optional condition on the Sort Key. The operation is O(1) per partition because DynamoDB hashes the Partition Key to find the partition and then walks the items sharing it. Cost and latency are proportional to the items returned, not the table size.

A `Scan` reads every item in the table and applies a filter expression in memory. The operation is linear in the table size and consumes read capacity for every item read, even those filtered out. A Scan is appropriate for one-off reports and analytics; it is almost always wrong on a hot read path.

```ts
// Query — fast, scoped to one partition
new QueryCommand({
  TableName: "app",
  KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
  ExpressionAttributeValues: { ":pk": `USER#${userId}`, ":prefix": "ORDER#" },
});

// Scan — slow, reads everything
new ScanCommand({ TableName: "app", FilterExpression: "status = :s" });
```

**Trade-offs / when this fails.** If the team finds itself reaching for Scan, the table is modelled wrong for the access pattern; add a Global Secondary Index that supports the query directly. Scans on small reference tables (less than a few thousand items) can be acceptable; scans on production tables with millions of items are operational hazards.

### 2. What is a GSI and when do you add one?

A Global Secondary Index is a copy of a subset of the table's data, sorted by a different Partition Key and optional Sort Key. The team adds a Global Secondary Index when an access pattern cannot be served by querying the base table — typically when items must be retrieved by an attribute other than the table's Partition Key.

```text
Table: orders
PK: order_id
GSI: by_customer
  PK: customer_id   SK: created_at
GSI: by_status
  PK: status         SK: created_at
```

The `by_customer` index supports "list this customer's orders newest first" without scanning the table. The `by_status` index supports "list pending orders" without scanning. Each Global Secondary Index has its own provisioned capacity (or shares the table's on-demand capacity) and its own cost, because writes to the table propagate to every index that includes the affected attributes.

**Trade-offs / when this fails.** Each Global Secondary Index doubles the write cost for items that include indexed attributes. The team should add a Global Secondary Index per genuine access pattern, not preemptively. The DynamoDB limit is twenty Global Secondary Indexes per table; in practice, well-modelled applications use three to five.

### 3. Walk through single-table design.

Single-table design holds all of the application's entities in one DynamoDB table, distinguished by Partition Key and Sort Key conventions. Instead of separate `users`, `orders`, and `products` tables, one table holds items with composite keys such as `PK=USER#alice, SK=PROFILE` and `PK=USER#alice, SK=ORDER#2026-01-01`.

```text
PK                         SK                         entity   payload
USER#alice                 PROFILE                    user     email=...
USER#alice                 ORDER#2026-01-01           order    total=...
ORG#acme                   USER#alice                 member   role=admin
```

The benefit is that a single Query can fetch heterogeneous related data — `Query PK=USER#alice` returns the user's profile and all their orders in one round trip. Single-table is the DynamoDB-native pattern that minimises round trips and per-table operational overhead.

The cost is that the schema lives in the application code rather than in the database. The table's typing is permissive (every column is optional, types vary by row), and validation must be enforced in the application. Tooling is weaker because the table holds many shapes.

**Trade-offs / when this fails.** Single-table design rewards rigorous up-front modelling of access patterns; it punishes mid-flight discovery of new access patterns because the keys are baked in. For applications with simple, well-understood access patterns, single-table is the right choice. For applications that genuinely need ad-hoc queries or joins, a relational database is the better fit; DynamoDB is not the universal answer.

### 4. How do you implement optimistic concurrency in DDB?

Optimistic concurrency uses a version attribute on the item and a `ConditionExpression` on the update that requires the version to match the value the client read. If another writer has incremented the version in the interim, the update fails with `ConditionalCheckFailedException` and the client retries (typically by re-reading and re-applying the change).

```ts
await ddb.send(new UpdateCommand({
  TableName: "app",
  Key: { PK: `USER#${userId}`, SK: "PROFILE" },
  UpdateExpression: "SET email = :e, version = version + :one",
  ConditionExpression: "version = :expected",
  ExpressionAttributeValues: {
    ":e": newEmail,
    ":one": 1,
    ":expected": currentVersion,
  },
}));
```

The condition is evaluated atomically with the write — DynamoDB guarantees that two concurrent updates with the same expected version cannot both succeed. The pattern is one round trip in the success case and `N + 1` in the conflict case (where `N` is the retry count).

**Trade-offs / when this fails.** High-contention items (many writers, same item) suffer from retry storms because each writer reads, computes, and tries to update, only to lose the race. For high-contention scenarios, prefer atomic counters (`SET counter = counter + :one` without a version condition) or move to a transactional pattern with a queue serialising writes. The version-and-retry pattern works well for low-to-moderate contention.

### 5. When would you NOT use DynamoDB?

DynamoDB is the wrong choice when the application requires ad-hoc queries the team did not anticipate at design time, joins across entities, complex aggregations and analytics, full-text search, or transactional patterns spanning many items. Each of these has a better-fit primitive on Amazon Web Services.

For ad-hoc queries and joins, use Aurora PostgreSQL or another managed relational database — the relational model is the right tool when query patterns are open-ended. For analytics and aggregations, stream DynamoDB to Simple Storage Service via DynamoDB Streams plus Firehose, then query with Athena or Redshift; DynamoDB is for Online Transaction Processing, not Online Analytical Processing. For full-text search, use OpenSearch with DynamoDB as the system of record and stream changes to keep the search index in sync. For transactional patterns spanning many entities, evaluate whether the relational model's `BEGIN/COMMIT` semantics are a better fit than DynamoDB's `TransactWriteItems` (which has a hundred-item limit and double the cost).

```text
Use DynamoDB when: known access patterns, single-digit-ms latency, scale-to-zero billing.
Use RDS/Aurora when: ad-hoc queries, joins, complex aggregations.
Use OpenSearch when: full-text search, faceted filtering.
Use Timestream when: high-volume time-series with aggregations.
```

**Trade-offs / when this fails.** Selecting DynamoDB for a workload that does not fit results in painful operational discoveries — Scans where Queries should be, Global Secondary Indexes added defensively, and a model that resists product changes. The senior pattern is to validate that the access patterns fit DynamoDB before committing; if the team cannot enumerate the access patterns up front, the project is probably not ready for single-table DynamoDB.

## Further reading

- Alex DeBrie, *The DynamoDB Book*.
- [AWS DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html).
- [Single-table design with Rick Houlihan](https://www.youtube.com/watch?v=HaEPXoXVf2k).
