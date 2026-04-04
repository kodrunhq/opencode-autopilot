---
# opencode-autopilot
name: database-patterns
description: Database design, query optimization, migration strategies, indexing, connection pooling, transactions, and data modeling patterns
stacks: []
requires: []
---

# Database Patterns

Practical patterns for database design, query optimization, and operational management. Covers schema design, indexing, query optimization, migrations, connection pooling, transactions, data modeling, and backup/recovery. Apply these when designing schemas, reviewing queries, planning migrations, or troubleshooting performance.

## 1. Schema Design Principles

**DO:** Design schemas that balance normalization with practical query performance.

- Normalize to 3NF by default -- eliminate data duplication and update anomalies
- Denormalize deliberately when read performance justifies it (document the trade-off)
- Use consistent naming conventions:
  ```
  -- Tables: plural snake_case
  users, order_items, payment_methods

  -- Columns: singular snake_case
  user_id, created_at, is_active, total_amount

  -- Foreign keys: referenced_table_singular_id
  user_id, order_id, category_id

  -- Indexes: idx_table_column(s)
  idx_users_email, idx_orders_user_id_created_at
  ```
- Include standard metadata columns: `id`, `created_at`, `updated_at`
- Use UUIDs for public-facing identifiers; auto-increment for internal references
- Add `NOT NULL` constraints by default -- make nullable columns the exception with justification

**DON'T:**

- Over-normalize to 5NF+ (diminishing returns, excessive joins)
- Use reserved words as column names (`order`, `user`, `group`, `select`)
- Create tables without primary keys
- Use floating-point types for monetary values (use `DECIMAL`/`NUMERIC`)
- Store comma-separated values in a single column (normalize into a junction table)

```
-- DO: Junction table for many-to-many
CREATE TABLE user_roles (
  user_id INTEGER NOT NULL REFERENCES users(id),
  role_id INTEGER NOT NULL REFERENCES roles(id),
  PRIMARY KEY (user_id, role_id)
);

-- DON'T: CSV in a column
ALTER TABLE users ADD COLUMN roles TEXT; -- "admin,editor,viewer"
```

## 2. Indexing Strategy

**DO:** Create indexes based on actual query patterns, not guesswork.

- **B-tree indexes** (default): equality and range queries (`WHERE`, `ORDER BY`, `JOIN`)
- **Hash indexes**: exact equality lookups only (faster than B-tree for `=`, no range support)
- **Composite indexes**: order columns by selectivity (most selective first) and match query patterns
  ```sql
  -- Query: WHERE status = 'active' AND created_at > '2024-01-01' ORDER BY created_at
  -- Index: (status, created_at) -- status for equality, created_at for range + sort
  CREATE INDEX idx_orders_status_created ON orders(status, created_at);
  ```
- **Covering indexes**: include all columns needed by the query to avoid table lookups
  ```sql
  -- Query only needs id, email, name -- index covers it entirely
  CREATE INDEX idx_users_email_covering ON users(email) INCLUDE (id, name);
  ```
- Use `EXPLAIN ANALYZE` to verify index usage before and after adding indexes
- Index foreign key columns (required for efficient joins and cascade deletes)

**DON'T:**

- Index every column (indexes slow writes and consume storage)
- Create indexes on low-cardinality columns alone (`is_active` with 2 values -- combine with other columns)
- Ignore index maintenance (rebuild/reindex fragmented indexes periodically)
- Forget that composite index column order matters: `(a, b)` serves `WHERE a = ?` but NOT `WHERE b = ?`
- Add indexes without checking if an existing index already covers the query

## 3. Query Optimization

**DO:** Write efficient queries and use EXPLAIN to verify execution plans.

- **Read EXPLAIN output** to understand:
  - Scan type: Sequential Scan (bad for large tables) vs Index Scan (good)
  - Join strategy: Nested Loop (small datasets), Hash Join (equality), Merge Join (sorted)
  - Estimated vs actual row counts (large discrepancies indicate stale statistics)

- **Avoid N+1 queries** -- the most common ORM performance problem:
  ```
  // DON'T: N+1 -- 1 query for users + N queries for orders
  users = await User.findAll()
  for (user of users) {
    user.orders = await Order.findAll({ where: { userId: user.id } })
  }

  // DO: Eager loading -- 1 or 2 queries total
  users = await User.findAll({ include: [Order] })

  // DO: Batch loading
  users = await User.findAll()
  userIds = users.map(u => u.id)
  orders = await Order.findAll({ where: { userId: { in: userIds } } })
  ```

- Use `LIMIT` on all queries that don't need full result sets
- Use `EXISTS` instead of `COUNT(*)` when checking for existence
- Avoid `SELECT *` -- request only needed columns
- Use batch operations for bulk inserts/updates (not individual queries in a loop)

**DON'T:**

- Use `OFFSET` for deep pagination (use cursor-based pagination instead)
- Wrap queries in unnecessary subqueries
- Use functions on indexed columns in WHERE clauses (`WHERE LOWER(email) = ?` -- use a functional index or store normalized)
- Ignore slow query logs -- review them regularly

## 4. Migration Strategies

**DO:** Use versioned, incremental migrations with rollback plans.

- Number migrations sequentially or by timestamp: `001_create_users.sql`, `20240115_add_email_index.sql`
- Each migration must be idempotent or have a corresponding down migration
- Test migrations against a copy of production data volume (not just empty schemas)
- Plan zero-downtime migrations for production:
  ```
  -- Step 1: Add nullable column (no downtime)
  ALTER TABLE users ADD COLUMN phone TEXT;

  -- Step 2: Backfill data (background job)
  UPDATE users SET phone = 'unknown' WHERE phone IS NULL;

  -- Step 3: Add NOT NULL constraint (after backfill completes)
  ALTER TABLE users ALTER COLUMN phone SET NOT NULL;
  ```

- For column renames or type changes, use the expand-contract pattern:
  1. Add new column
  2. Deploy code that writes to both old and new columns
  3. Backfill new column from old
  4. Deploy code that reads from new column
  5. Drop old column

**DON'T:**

- Run destructive migrations without a rollback plan (`DROP TABLE`, `DROP COLUMN`)
- Apply schema changes and code changes in the same deployment (deploy schema first)
- Lock large tables with `ALTER TABLE` during peak traffic
- Skip testing migrations on production-like data (row counts, constraints, FK relationships)
- Use ORM auto-migration in production (unpredictable, no rollback)

## 5. Connection Pooling

**DO:** Use connection pools to manage database connections efficiently.

- Size the pool based on: `pool_size = (core_count * 2) + disk_spindles` (start with this, tune under load)
- Set connection timeouts (acquisition: 5s, idle: 60s, max lifetime: 30min)
- Use a connection pool per service instance, not a global shared pool
- Monitor pool metrics: active connections, waiting requests, timeout rate
- Close connections gracefully on application shutdown

**DON'T:**

- Create a new connection per query (connection setup is expensive: TCP + TLS + auth)
- Set pool size equal to `max_connections` on the database (leave room for admin, monitoring, other services)
- Use unbounded pools (set a maximum to prevent connection exhaustion)
- Ignore idle connection cleanup (stale connections waste database resources)
- Share connection pools across unrelated services

## 6. Transactions and Locking

**DO:** Use transactions to maintain data integrity for multi-step operations.

- Choose the appropriate isolation level:

| Level | Dirty Read | Non-repeatable Read | Phantom Read | Use Case |
|-------|-----------|-------------------|-------------|---------|
| READ COMMITTED | No | Yes | Yes | Default for most apps |
| REPEATABLE READ | No | No | Yes | Financial reports |
| SERIALIZABLE | No | No | No | Critical financial ops |

- Use optimistic locking for low-contention updates:
  ```sql
  -- Add version column
  UPDATE orders SET status = 'shipped', version = version + 1
  WHERE id = 123 AND version = 5;
  -- If 0 rows affected: someone else updated first (retry or error)
  ```

- Use pessimistic locking (`SELECT ... FOR UPDATE`) only when contention is high and retries are expensive
- Keep transactions as short as possible -- do computation outside the transaction
- Always handle deadlocks: retry with exponential backoff (2-3 attempts max)

**DON'T:**

- Hold transactions open during user input or external API calls
- Use `SERIALIZABLE` as the default isolation level (performance impact)
- Nest transactions without understanding savepoint semantics
- Ignore deadlock errors -- they are expected in concurrent systems; handle them
- Lock entire tables when row-level locks suffice

## 7. Data Modeling Patterns

**DO:** Use established patterns for common data modeling challenges.

- **Soft deletes:** Add `deleted_at TIMESTAMP NULL` instead of removing rows. Filter with `WHERE deleted_at IS NULL` by default. Use a partial index for performance:
  ```sql
  CREATE INDEX idx_users_active ON users(email) WHERE deleted_at IS NULL;
  ```

- **Temporal data (audit history):** Use a separate history table or event sourcing:
  ```sql
  CREATE TABLE order_events (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    event_type TEXT NOT NULL,  -- 'created', 'updated', 'shipped'
    payload JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  );
  ```

- **Polymorphic associations:** Use a discriminator column or separate tables per type:
  ```sql
  -- DO: Separate tables (type-safe, indexable)
  CREATE TABLE comment_on_post (comment_id INT, post_id INT);
  CREATE TABLE comment_on_photo (comment_id INT, photo_id INT);

  -- Acceptable: Discriminator column (simpler, less type-safe)
  CREATE TABLE comments (
    id SERIAL, body TEXT,
    commentable_type TEXT NOT NULL,  -- 'post', 'photo'
    commentable_id INTEGER NOT NULL
  );
  ```

- **JSON columns:** Use for semi-structured data that doesn't need relational queries. Index with GIN for JSONB queries:
  ```sql
  ALTER TABLE products ADD COLUMN metadata JSONB;
  CREATE INDEX idx_products_metadata ON products USING GIN(metadata);
  ```

**DON'T:**

- Use soft deletes without filtering them by default (data leaks)
- Store structured, queryable data in JSON columns (normalize instead)
- Create polymorphic foreign keys without application-level integrity checks
- Use EAV (Entity-Attribute-Value) pattern when a proper schema is feasible

## 8. Backup and Recovery

**DO:** Plan for data loss scenarios before they happen.

- Implement automated daily backups with point-in-time recovery (PITR) capability
- Store backups in a different region/account than the database
- Test backup restoration quarterly -- an untested backup is not a backup
- Document the recovery procedure: who, what, where, how long (RTO/RPO targets)
- Use logical backups (pg_dump, mysqldump) for portability and physical backups (WAL archiving, snapshots) for speed

**DON'T:**

- Keep backups on the same server/disk as the database
- Skip backup verification (restore to a test environment periodically)
- Rely solely on database replication as a backup strategy (replication propagates corruption)
- Store backup credentials in the same place as database credentials
- Assume cloud provider handles backup without verifying configuration and retention policy
