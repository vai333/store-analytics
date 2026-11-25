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
