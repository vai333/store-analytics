# PRD: Store Analytics Assistant (v1)

| | |
|---|---|
| Status | Draft |
| Owner | Vaibhav Tiwari |
| Last updated | 2026-11-25 |
| Data source | `retail.db` (SQLite): `stores` (12), `products` (60), `sales` (223,702) |

## 1. Problem in one line
"Leaders ask a question in plain English, by voice or text, and get a trusted number from the data they are allowed to see."

## 2. Users and jobs
Access is by role. A role sees only the tables listed. Everything else is blocked before any query runs.

| Role | Table access | Job they do today | How they do it today | What it costs them |
|---|---|---|---|---|
| CEO | `stores`, `products`, `sales` (all) | Checks company-wide performance and compares stores, products and channels | Asks an analyst, waits for a report or spreadsheet | A day or more per question; numbers differ between reports |
| Sales head | `sales` only | Tracks revenue, units, discounts, returns and online vs in-store mix | Exports sales lines and builds pivots by hand | Hours of manual work per question |
| Product head | `products` only | Reviews the catalogue, pricing (MRP) and unit cost and margin | Asks for product sheets and checks them by hand | Slow, and each answer is a one-off |
| Store head | `stores` only | Reviews store list, cities, regions, opening dates and notes | Looks them up in files or asks the head office | Slow lookups, stale information |

## 3. User flow
1. **Login.** The user opens the dashboard and logs in by picking one of the four role profiles (CEO, Sales head, Product head, Store head). The role fixes which tables the user may query for the whole session.
2. **Ask.** The user types a requirement in plain English in a chat window.
3. **Scope check.** The planner decides whether the requirement is a question about the data in `retail.db` (stores, products, sales). If it is not, the assistant politely declines with a fixed message, for example "I can only answer questions about store, product and sales data", runs no query, and logs the request as `out_of_scope`. Nothing else is answered, such as general knowledge, chit-chat, advice, coding help or questions about the assistant itself.
4. **Understand.** The backend sends the requirement to the LLM along with the glossary (`glossary.md`) and only the schema the role may access. The LLM converts it into a SQL query.
5. **Clarify (if unclear).** If the requirement is ambiguous (for example, no time period or an unclear metric), the LLM asks a follow-up question in the chat. The user answers, and the loop repeats until the requirement is clear.
6. **Review (checker agent).** A second agent checks the generated SQL before it runs. It checks that:
   - the query answers the question;
   - it uses only tables the role may access;
   - it is read-only (`SELECT` only, one statement);
   - it has correct joins, filters and date logic.

   If the checker rejects the query, it goes back to the LLM to be rewritten, up to 2 retries. After that the user is told the question could not be answered safely.
7. **Execute.** The approved query runs against the database on a read-only connection with a 5 second timeout and a 50-row cap.
8. **Cross-check.** A sample of the returned figures is re-computed straight from the database with an independent query. The answer is shown only if they match. A mismatch is flagged to the user and logged.
9. **Show.** The dashboard shows the answer as a number, table or chart, with a two-sentence summary and the assumption used (for example "sales means net sales"). Users can also see the SQL that ran. The role's scope is checked again before the answer is returned.
10. **Log.** Every request, whatever its outcome, is written to the **Log tab** (see section 6).

```
Login (role) -> Speak/Type -> Data question? -> no: decline + log -> yes: LLM writes SQL -> unclear? -> clarifying question -> (loop)
   -> Checker agent reviews SQL -> rejected? -> rewrite (max 2) -> Run on retail.db
   -> Cross-check sample vs db -> Show on dashboard -> Write to Log tab
```

## 4. Success metrics (write the number, not the adjective)
Targets are first proposals. Confirm them with the team before build.

| Metric | Today | Target | How we measure |
|---|---|---|---|
| Answer correctness on the golden set | No tool | 90% or higher (28 questions, 6 held back) | `eval_sql.py` |
| Role-access violations (a role reads a table it should not) | n/a | 0 | Test set of out-of-role questions per role |
| Cross-check pass rate | n/a | 98% or higher | Share of answers where the sample matches the db |
| Time to answer | A day or more | p95 under 10 s (excluding clarifying turns) | `load_test.py` |
| Cost per question (Rs) | Analyst time | Under Rs 2 | Token counts times price |
| Questions a leader can self-serve | 0% | 80% or higher without an analyst | Share of golden-set topics answered with no analyst help |
| Queries logged | n/a | 100% | Compare log rows with request count |
| Out-of-scope refusal rate | n/a | 100% of non-data questions declined, 0 of data questions wrongly declined | Test set of non-data and data questions |

## 5. Scale target
Users: 4 role profiles (roughly 10–20 real people)  Questions per day: about 200  Stores: 12  Rows: about 224k sales lines (growing)  p95 latency: 10 s  Budget per month (Rs): to be set (see open questions)

## 6. In scope for v1
- Role-based login with four profiles: CEO, Sales head, Product head, Store head.
- Table-level access control per role:

| Role | `stores` | `products` | `sales` |
|---|---|---|---|
| CEO | Yes | Yes | Yes |
| Sales head | No | No | Yes |
| Product head | No | Yes | No |
| Store head | Yes | No | No |

- Chat-style text input of a requirement in plain English. Clarifying questions and answers happen in the same chat.
- A scope guard: only questions about the data in `retail.db` are answered. Everything else is declined with a fixed message.
- LLM converts the requirement into SQL, using the glossary as the semantic layer.
- Clarifying questions through voice or text when the requirement is unclear.
- A checker agent that reviews the SQL before it runs.
- Read-only execution with a 5 second timeout and a 50-row cap.
- Cross-check of a sample of the returned figures against the db before display.
- Dashboard output: number, table or chart, plus a two-sentence summary, the assumption used and the SQL.
- **Log tab** on the site. It keeps every query with:
  - timestamp, user and role;
  - original requirement, clarifying turns, generated SQL and checker verdict (approved or rejected, and why);
  - cross-check result, number of rows returned (never the rows themselves), assumption used, latency and cost;
  - final status (answered, out_of_scope, blocked, rejected or failed).

  Each role sees its own log. The CEO sees all logs.

## 7. Not in v1 (and why)
- Voice input and voice replies. v1 is a text chat only; voice comes later.
- **Any question that is not about the data.** The assistant answers only data questions about stores, products and sales. It declines general knowledge, chit-chat, opinions and advice, coding or writing help, questions about other companies or data not in `retail.db`, and questions about the assistant itself. This keeps answers trustworthy and cost low, and the product focused on one job.
- Writing, editing or deleting data. The assistant is read-only to keep the data safe.
- Real authentication (passwords, SSO). v1 uses profile pick-up login, which is enough for the build; real auth is a later step.
- Row-level restrictions (for example, a store head seeing only one store). v1 restricts by table only, as specified.
- Live data feeds. v1 uses the generated `retail.db`.
- Forecasting and predictions. v1 answers questions about what has already happened.
- Languages other than English.

## 8. Risks (what is the worst wrong answer, and who gets hurt)
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A role sees data outside its tables | Medium | High: confidential data leaks | The checker rejects any query touching a table outside the role; the db connection is read-only; a test set of out-of-role questions per role |
| A wrong number is acted on | Medium | High: bad business decisions | Checker agent, cross-check against the db, SQL shown to the user, golden-set scoring |
| A non-data question gets answered (off-topic or made-up answer) | Medium | Medium: trust and cost | Scope check before SQL generation; fixed refusal message; test set of non-data questions |
| A valid data question is wrongly declined | Low | Medium: user frustration | Include borderline data questions in the test set; the user can rephrase |
| The LLM guesses when the question is unclear | Medium | Medium | Clarifying-question step; never run a query on an ambiguous requirement |
| Cost runs away | Low | Medium | Cache repeated questions for 2 hours, use a small model first, cap tokens and clarifying turns, track cost per question in the Log tab |
| The model is deprecated or the price changes | Medium | Medium | Keep the model name in config; re-run the golden set on any change |
| Log tab shows sensitive queries to the wrong people | Low | Medium | Each role sees only its own log; the CEO sees all |

## 9. Build, buy or configure
Options considered: (a) buy a BI tool with a natural-language feature, (b) configure an LLM through an agent framework such as ADK over `retail.db`, (c) build everything from scratch.  Chosen: (b), an LLM SQL writer and a separate checker agent configured over `retail.db`, with a thin custom dashboard and log tab.  Because: it keeps the access rules and the checker under our control, and `eval_sql.py` and `load_test.py` already exist to prove it works.

## 10. Open questions
1. **Sales head with `sales` only.** `sales` holds only `store_id` and `product_id` codes. The Sales head cannot see store names, regions, product names or categories. Should we allow a limited join (names only), or keep codes only?
2. **Store head with `stores` only.** The `stores` table has no sales data, so the Store head can answer questions about stores but not performance. Is that intended?
3. **Product head** can see MRP and unit cost, but not sales volume per product. Is that intended?
4. **Existing `users.json`** is built around store managers and stores. Should it be replaced with the four roles above?
5. Which LLM and speech-to-text/text-to-speech service do we use, and what is the monthly budget?
6. How long are logs kept, and can a user export them?
7. What should the cross-check sample size be (for example, 3 figures or 10% of rows)?
