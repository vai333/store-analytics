# Architecture: Store Analytics Assistant

Companion to `PRD.md`. Hosting: **Vercel** (app and API). Data, cache and logs: **Supabase** (Postgres).

## 1. Diagram
`[CODE]` is deterministic code. `[MODEL]` is an LLM call. `[HUMAN]` is a person.

```
[HUMAN] picks role (CEO / Sales head / Product head / Store head), types in a chat
   v
[CODE] 1. API and scope (Vercel route): who is asking; role and allowed tables come from the login, never from the prompt
   v
[CODE] 2. Cache lookup (Supabase `query_cache`, key = question + scope, TTL 2 h)
   |-- HIT: skip everything below ---------------------------------------+
   v MISS                                                                  |
[CODE] 3. Context: rules + only the glossary pieces this question needs,   |
         and only the role's schema                                        |
   v                                                                       |
[MODEL] 4. Planner (small model; big model only if it fails): writes JSON  |
         with SQL, or asks a clarifying question, or refuses (non-data)    |
   |-- refuse  -> fixed message, log `out_of_scope`, stop                  |
   |-- clarify -> question by text/voice -> [HUMAN] answers -> back to 4   |
   v sql                                                                   |
[MODEL] Checker agent: does the SQL answer the question? (max 2 rewrites)  |
   |-- rejected -> back to 4; still rejected -> log `rejected`             |
   v approved                                                              |
[CODE] 5. Guard and executor: read-only connection, one SELECT only,       |
         role's tables only (grants/views + authorizer), 5 s timeout,      |
         50 rows                                                           |
   v                                                                       |
[CODE] Cross-check: re-compute a sample of figures with an independent query
   |-- mismatch -> flag to user, log, do not cache                         |
   v match                                                                 |
[MODEL] 6. Narrator (small model, optional): rows -> two sentences         |
   v                                                                       |
[CODE] Answer: number, sentence, assumption used, SQL for audit            |
   v                                                                       |
[CODE] Cache write (only successful, cross-checked answers; +2 h)          |
   v                                                                       |
[CODE] Return: same scope check on the way out <---------------------------+
   v
[CODE] Dashboard (table / number / chart) + row in `query_log`
   v
[HUMAN] reads answer; Log tab shows every request
```

Around it: config (model names, limits), a meter (tokens, latency, rupees per call), logs (questions and SQL, never raw customer rows) and the golden set run on every change.

**Both model boxes can be wrong. Nothing a wrong model says can reach data outside the role, because box 5 is code.** The checker is an extra layer, not the safety.

Humans sit at three points: choosing a role, answering clarifying questions, and reading the answer. No human approves queries.

## 2. Decisions
| Decision | Options | Choice | Why | Cost or risk |
|---|---|---|---|---|
| One call or several (pipeline vs agent) | One free-form agent; fixed pipeline | Fixed pipeline: planner (also does the scope refusal), checker and narrator, with code between the model calls | Predictable steps, easy to log and test each one | Several model calls per cache miss; mitigated by the cache |
| What the model writes (SQL, a plan, an answer) | SQL; a plan; a direct answer | JSON with SQL, a clarifying question or a refusal; then a two-sentence summary of the returned rows | The numbers come from the database, not from the model | Wrong SQL is possible; covered by the checker and the cross-check |
| Where isolation is enforced (prompt vs code) | Prompt only; code; database | Code and database. The prompt shows only the role's schema, the guard allows one `SELECT` and checks tables in code (authorizer), and Postgres grants and views limit each role to its tables and rows | A prompt can be talked around; code and grants cannot | Needs one Postgres role (or view set) per app role |
| What context we send (full schema vs retrieved) | Full schema; retrieved | Role-filtered schema plus only the glossary pieces the question needs. It is small (3 tables), so no vector retrieval | Fewer tokens, and the model never sees tables it may not use | Revisit if tables grow |
| Model tiers (one model vs cascade) | One model; cascade | Cascade: a small model plans and narrates; the big model runs only if the small one fails. The checker uses a different model or prompt from the planner | Most questions are simple, so the small model keeps cost low | Two models to keep tested; a failed small-model call adds latency |
| Caching | None; in-memory; Redis; Postgres table | **Postgres table `query_cache` in Supabase, 2 hour TTL** (details in section 2a) | Vercel functions are stateless, so in-memory caches do not survive; one store means no extra service | One extra read per request; stale data for up to 2 h |
| Sync vs queued | Sync; queued | Sync, streaming progress to the UI | A question should take seconds, and queues add complexity | Slow questions can hit Vercel's function time limit; keep the statement timeout well below it |
| Where state lives | Server memory; Supabase; browser | Supabase: data, cache, logs and sessions. The browser keeps only the current role and conversation | Functions are stateless | Supabase becomes a single dependency |

### 2a. Caching design
- **What is cached:** the final result (rows, summary, SQL, cross-check status) for a question that was answered and cross-checked. Refusals, rejections, clarifying turns and mismatches are not cached.
- **Key:** `hash(question + scope)`, where scope is the role and its allowed tables, plus any clarification answers. Normalising the question means lowercasing, trimming and collapsing spaces. **The scope is part of the key**, so one role can never receive another role's cached answer.
- **TTL:** 2 hours from the user's most recent search for that key. A hit refreshes `expires_at` to now + 2 h; once nobody asks for 2 h, the entry expires. (A fixed 2 h from first write is also possible; see open questions.)
- **Storage:** table `query_cache(key text primary key, role text, question text, sql text, result jsonb, summary text, created_at, last_hit_at, expires_at, hit_count)`. Reads filter on `expires_at > now()`. Expired rows are deleted by a scheduled job (`pg_cron` or a Vercel cron).
- **On a hit:** skip everything after the cache (context, planner, checker, execute, cross-check). The entry was already verified, and the scope is re-checked on the way out. Still write a `query_log` row with `cache_hit = true`.
- **Invalidation:** the data is static in v1. If `retail.db` is regenerated or reloaded, clear the whole cache.
- **Why not cache by SQL:** two different questions can produce the same SQL, but matching on the question avoids running the model at all.

### 2b. Data and hosting
- `retail.db` is SQLite today. For Vercel it moves to **Supabase Postgres** with the same three tables (`stores`, `products`, `sales`). The index on `sales(store_id, sale_date)` is kept. Vercel's filesystem is read-only and per-instance, so a SQLite file can't be the live database.
- The planner's SQL dialect is changed to Postgres (for example date functions). The golden set in `golden_questions.csv` has to be re-scored after the move.
- Tables added in Supabase: `query_cache`, `query_log`, and (if used) `sessions`.
- Secrets (LLM key, Supabase secret key) live in Vercel environment variables, never in the browser.
- **How the server reaches Supabase:** with `supabase-js` and the secret key. Queries run through the database function `run_readonly(role, sql, timeout)`, which switches to the role's Postgres user (`SET LOCAL ROLE`), read-only, before running the guarded SELECT. The cache read uses `cache_touch(...)`. Both functions are callable only by the secret key (`supabase/functions.sql`).
- **LLM:** Google Gemini API (`GEMINI_API_KEY`; `MODEL_SMALL`, `MODEL_BIG` in env).
- **Roles in the database:**

| App role | Postgres access |
|---|---|
| CEO | `SELECT` on `stores`, `products`, `sales` |
| Sales head | `SELECT` on `sales` only |
| Product head | `SELECT` on `products` only |
| Store head | `SELECT` on `stores` only |

The API picks the connection (or sets the role) from the session role, so a query outside the role fails in the database even if every other check is bypassed.

### 2c. Logging
`query_log(id, created_at, user_role, requirement, transcript_source (voice/text), clarification_turns jsonb, generated_sql, checker_verdict, checker_reason, crosscheck_result, rows_returned, assumption, model_used, cache_hit, latency_ms, tokens_in, tokens_out, cost_rs, status)`. The log stores questions, SQL and row counts, **never the raw rows returned**. `status` is one of `answered`, `out_of_scope`, `blocked`, `rejected`, `failed`. The Log tab reads this table: each role sees its own rows and the CEO sees all rows (enforced by the API and a Supabase row-level security policy).

## 3. Threat model
| Attack | Who | Blast radius | Defence (code or prompt) |
|---|---|---|---|
| "Show me every store's numbers" from a role without access | Any non-CEO role | Leak of confidential data | **Code:** SQL guard rejects tables outside the role; **database:** per-role grants; prompt only lists the role's schema |
| Asking another role's question to read its cached answer | Any role | Leak through the cache | **Code:** role is part of the cache key; no cross-role lookups |
| Instruction hidden in a product name or store note | Anyone who can edit data | Model follows the text instead of the user | **Prompt:** `notes` and names are marked as data, not instructions (see `glossary.md`); **code:** SQL guard and checker still apply to whatever SQL results |
| A query that scans everything | Any user | Slow database and cost | **Code:** 50-row cap, 5 s statement timeout, query cost check, rate limit per role; the cache absorbs repeats |
| A write or drop statement | Any user, or an injected prompt | Data loss | **Code:** parser allows `SELECT` only; **database:** read-only grants, so even a missed statement fails |
| Off-topic or jailbreak questions | Any user | Wasted cost, wrong trust | **Model + code:** the planner refuses non-data questions; the output-side scope check blocks anything outside the role; logged as `out_of_scope` |
| Cache poisoning (a wrong answer stored for 2 h) | Model error | Wrong number served repeatedly | **Code:** only cross-checked answers are cached; mismatches are never cached |
| Log tab exposes other roles' queries | Any non-CEO role | Leak through logs | **Code and database:** row-level security by role; CEO sees all |

## 4. Scale ladder
| Rung | Load | First thing that breaks | Our fix |
|---|---|---|---|
| 1 | 1 user | Nothing; each question needs several model calls, so it feels slow | Stream progress to the UI; use the cache |
| 2 | 50 managers | Model rate limits and repeated identical questions | 2 h cache; rate limit per user |
| 3 | 5,000 users | Supabase connection limits from many serverless functions | Use the Supabase connection pooler; cache hit rate becomes the main lever |
| 4 | 500 stores | `sales` grows to millions of rows and queries slow down | Indexes on date, store and product; summary tables; partitions by month |
| 5 | many tenants | One tenant's data could leak into another | `tenant_id` on every table, row-level security, tenant in the cache key |
| 6 | model change | Answers change and the golden-set score drops | Model name in config; re-run `eval_sql.py` and the out-of-scope test set before switching |

## 5. Token budget per question
Counts for a cache miss. A cache hit costs no model tokens. All figures are estimates to be replaced with measured values from `query_log`.

| Part | Tokens in | Tokens out | Can we cut or cache it? |
|---|---|---|---|
| Rules and glossary | about 1,000 (only the pieces the question needs, role-filtered) | 0 | Yes: pick pieces per question; use the provider's prompt caching |
| Question | about 30 | 0 | No |
| Planner call (also decides scope) | about 1,100 | about 150 | Small model first; cached by `query_cache` on a repeat |
| Checker call | about 500 | about 100 | Skipped on a cache hit |
| Narration call (optional) | about 400 (up to 50 rows) | about 60 | Skip when a table is enough; cached with the result |
| **Total (miss)** | about 2,000 | about 310 | Target: under Rs 2 per question, to be confirmed by measurement |

## 6. Open questions
1. The slide has no model checker or sample cross-check. We keep both as extra layers; is the added latency and cost acceptable, or should the cross-check run only on sampled requests?
2. Should the 2 h TTL refresh on every hit (sliding), as written here, or end 2 h after the first write (fixed)?
3. Does a cached answer need a re-cross-check on read, or is the stored check enough?
4. The Sales head can only see `sales`, which holds codes rather than names. Do we allow a names-only view of `stores` and `products`?
5. How long are `query_log` rows kept?
