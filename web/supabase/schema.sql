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
