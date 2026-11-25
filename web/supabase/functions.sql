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
