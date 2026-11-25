-- Run in the Supabase SQL editor, then run roles.sql, then `npm run seed`.
create table if not exists stores(
  store_id text primary key, store_name text, city text, region text, opened_on date, notes text);
create table if not exists products(
  product_id text primary key, product_name text, category text, mrp numeric, unit_cost numeric);
create table if not exists sales(
  line_id integer primary key, order_id text, store_id text, product_id text, sale_date date,
  qty integer, unit_price numeric, discount_pct numeric, is_return integer, channel text);
create index if not exists ix_sales_store_date on sales(store_id, sale_date);

create table if not exists query_cache(
  key text primary key, role text not null, question text, sql text, result jsonb, summary text,
  assumption text, columns jsonb, created_at timestamptz default now(),
  last_hit_at timestamptz default now(), expires_at timestamptz not null, hit_count integer default 0);
create index if not exists ix_cache_expires on query_cache(expires_at);

create table if not exists query_log(
  id bigserial primary key, created_at timestamptz default now(), user_role text not null,
  requirement text, input_mode text, clarification_turns jsonb default '[]', generated_sql text,
  checker_verdict text, checker_reason text, crosscheck_result text, rows_returned integer,
  assumption text, model_used text, cache_hit boolean default false, latency_ms integer,
  tokens_in integer default 0, tokens_out integer default 0, cost_rs numeric default 0,
  status text not null check (status in ('answered','out_of_scope','blocked','rejected','failed','clarifying')));
create index if not exists ix_log_role_time on query_log(user_role, created_at desc);

-- Nothing here is meant to be reached through the Supabase REST API.
alter table stores enable row level security;
alter table products enable row level security;
alter table sales enable row level security;
alter table query_cache enable row level security;
alter table query_log enable row level security;
-- One database role per app role. The app connects as `postgres` and switches with SET LOCAL ROLE,
-- so a query outside the role's tables fails in the database even if every code check is bypassed.
do $$ begin
  create role ceo_ro nologin; create role sales_ro nologin; create role product_ro nologin; create role store_ro nologin;
exception when duplicate_object then null; end $$;

grant ceo_ro, sales_ro, product_ro, store_ro to postgres;
grant usage on schema public to ceo_ro, sales_ro, product_ro, store_ro;

revoke all on stores, products, sales, query_cache, query_log from ceo_ro, sales_ro, product_ro, store_ro;
grant select on stores, products, sales to ceo_ro;
grant select on sales    to sales_ro;
grant select on products to product_ro;
grant select on stores   to store_ro;

-- RLS is on for every table; these policies let each role read what it was granted.
drop policy if exists p_ceo_stores on stores;    create policy p_ceo_stores on stores for select to ceo_ro, store_ro using (true);
drop policy if exists p_ceo_products on products; create policy p_ceo_products on products for select to ceo_ro, product_ro using (true);
drop policy if exists p_ceo_sales on sales;      create policy p_ceo_sales on sales for select to ceo_ro, sales_ro using (true);

-- Defence in depth: a runaway query is stopped by the database too.
alter role ceo_ro set statement_timeout = '5s';
alter role sales_ro set statement_timeout = '5s';
alter role product_ro set statement_timeout = '5s';
alter role store_ro set statement_timeout = '5s';
-- Run after schema.sql and roles.sql. These are called by the app with the Supabase secret key.

-- Lets the server's role switch to each app role (needed for SET LOCAL ROLE below).
grant ceo_ro, sales_ro, product_ro, store_ro to service_role;

-- Runs one SELECT as an app role: read-only, with a timeout. SECURITY INVOKER on purpose:
-- SET ROLE is not allowed inside a SECURITY DEFINER function.
create or replace function run_readonly(p_role text, p_sql text, p_timeout_ms int default 5000)
returns json language plpgsql security invoker as $$
declare result json;
begin
  if p_role not in ('ceo_ro','sales_ro','product_ro','store_ro') then
    raise exception 'unknown role %', p_role;
  end if;
  perform set_config('statement_timeout', p_timeout_ms::text, true);
  perform set_config('transaction_read_only', 'on', true);
  execute format('set local role %I', p_role);
  execute format('select coalesce(json_agg(row_to_json(q)), ''[]''::json) from (%s) q', p_sql) into result;
  return result;
end $$;

-- Returns the live cache row and pushes its expiry out by the TTL (the 2 hours run from the latest search).
create or replace function cache_touch(p_key text, p_role text, p_ttl_seconds int)
returns setof query_cache language sql as $$
  update query_cache set last_hit_at = now(), hit_count = hit_count + 1,
    expires_at = now() + make_interval(secs => p_ttl_seconds)
  where key = p_key and role = p_role and expires_at > now()
  returning *;
$$;

-- Only the server (secret key) may call these.
revoke execute on function run_readonly(text, text, int) from public, anon, authenticated;
revoke execute on function cache_touch(text, text, int) from public, anon, authenticated;
grant execute on function run_readonly(text, text, int) to service_role;
grant execute on function cache_touch(text, text, int) to service_role;

-- The server (secret key = service_role) reads and writes the app tables.
grant usage on schema public to service_role;
grant all on stores, products, sales, query_cache, query_log to service_role;
grant usage, select on all sequences in schema public to service_role;
notify pgrst, 'reload schema';
