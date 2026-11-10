import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

test("delivery claims prevent duplicate/parallel sends and bound retries per recipient", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role; create table public.clients(id uuid primary key);");
    await db.exec(await readFile(new URL("../../supabase/migrations/202611100001_daily_report_deliveries.sql", import.meta.url), "utf8"));
    const client = randomUUID();
    await db.query("insert into clients values ($1)", [client]);
    const claim = async (recipient = "test@example.com") => {
      const { rows } = await db.query("select public.claim_daily_report($1, '2026-11-09', $2, $3) as claimed", [client, recipient, randomUUID()]);
      return Boolean(rows[0].claimed);
    };
    const first = await Promise.all([claim(), claim()]);
    assert.equal(first.filter(Boolean).length, 1);
    await db.exec("update daily_report_deliveries set status='sent'");
    assert.equal(await claim(), false);
    assert.equal(await claim("another@example.com"), true);
    await db.exec("update daily_report_deliveries set status='failed' where recipient='another@example.com'");
    assert.equal(await claim("another@example.com"), false);
    await db.exec("update daily_report_deliveries set claimed_at=now()-interval '11 minutes' where status='failed'");
    assert.equal(await claim("another@example.com"), true);
    await db.exec("update daily_report_deliveries set status='failed', attempts=3, claimed_at=now()-interval '11 minutes' where recipient='another@example.com'");
    assert.equal(await claim("another@example.com"), false);
    await db.exec("update daily_report_deliveries set status='unknown' where recipient='another@example.com'");
    assert.equal(await claim("another@example.com"), false);
    const { rows } = await db.query("select relrowsecurity from pg_class where relname='daily_report_deliveries'");
    assert.equal(rows[0].relrowsecurity, true);
  } finally { await db.close(); }
});
