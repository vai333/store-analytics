import test from "node:test";
import assert from "node:assert/strict";
import { guardSql } from "./guard.ts";

const all = ["stores", "products", "sales"] as const;

test("allows a plain select and adds the row cap", () => {
  const r = guardSql("select count(*) from sales;", all, 50);
  assert.equal(r.ok, true);
  assert.match(r.sql!, /limit 50$/);
});
test("blocks writes and drops", () => {
  for (const q of ["delete from sales", "drop table sales", "update stores set city='x'", "insert into sales values (1)"]) {
    assert.equal(guardSql(q, all, 50).ok, false, q);
  }
});
test("blocks stacked statements", () => assert.equal(guardSql("select 1; select 2", all, 50).ok, false));
test("blocks tables outside the role", () => {
  assert.equal(guardSql("select * from stores", ["sales"], 50).ok, false);
  assert.equal(guardSql("select * from sales s join stores t on s.store_id=t.store_id", ["sales"], 50).ok, false);
  assert.equal(guardSql("select * from products", ["products"], 50).ok, true);
});
test("blocks system catalogs and dangerous functions", () => {
  assert.equal(guardSql("select * from pg_catalog.pg_user", all, 50).ok, false);
  assert.equal(guardSql("select pg_sleep(10)", all, 50).ok, false);
  assert.equal(guardSql("select * from information_schema.tables", all, 50).ok, false);
});
test("allows CTEs over permitted tables", () =>
  assert.equal(guardSql("with a as (select store_id from sales) select * from a", ["sales"], 50).ok, true));
