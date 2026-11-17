import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { summarizeConnectivity, applyReportingCorrection } from "../dist/reports/connectivity.js";
import { DssCameraSynchronizer } from "../dist/dss/camera-sync.js";

const camera = { id: "camera-1", code: "MBS-KDN-C1", name: "MBS-KDN-C1", location: "River" };
const sample = (at, status, since = at) => ({ camera_id: camera.id,
  checked_at: `2026-11-17T${at}+08:00`, status,
  status_since_at: `2026-11-17T${since}+08:00`, check_interval_ms: 60_000 });

test("17 November reporting correction is restricted to MBS and preserves C5 recovery", () => {
  const c5 = { ...camera, id: "camera-5", code: "dss-channel-5", name: "MBS-KDN-C5 Hadapan Klinik Kesih" };
  const original = [summarizeConnectivity("2026-11-17", camera, []), summarizeConnectivity("2026-11-17", c5, [])];
  const clientId = "449887e5-019b-46f7-92e5-6d05ae81ea1c";
  const corrected = applyReportingCorrection("2026-11-17", clientId, original, []);
  assert.equal(corrected[0].downtimeMs, 0);
  assert.equal(corrected[0].unverifiedMs, 0);
  assert.equal(corrected[0].endStatus, "online");
  assert.equal(corrected[1].downtimeMs, 86_400_000);
  assert.equal(corrected[1].outages[0].offlineAt, "2026-11-16T16:00:00.000Z");
  assert.equal(corrected[1].endStatus, "offline");
  const recovery = { ...sample("15:00:00", "online"), camera_id: c5.id };
  const recovered = applyReportingCorrection("2026-11-17", clientId, original, [recovery]);
  assert.equal(recovered[1].downtimeMs, 15 * 3_600_000);
  assert.equal(recovered[1].outages[0].onlineAt, recovery.checked_at);
  assert.equal(recovered[1].endStatus, "online");
  const lateRecovery = { ...sample("20:00:00", "online"), camera_id: c5.id };
  const late = applyReportingCorrection("2026-11-17", clientId, original, [lateRecovery]);
  assert.equal(late[1].downtimeMs, 20 * 3_600_000);
  assert.equal(applyReportingCorrection("2026-11-18", clientId, original, []), original);
  assert.equal(applyReportingCorrection("2026-11-16", clientId, original, []), original);
  assert.equal(applyReportingCorrection("2026-11-17", "another-client", original, []), original);
  assert.equal(original[0].endStatus, "unverified");
});

test("downtime accumulates across offline checks and is retained after recovery", () => {
  const result = summarizeConnectivity("2026-11-17", camera, [
    sample("00:00:00", "online"), sample("00:01:00", "offline"),
    sample("00:02:00", "offline", "00:01:00"), sample("00:03:00", "online"),
    sample("00:04:00", "offline"), sample("00:05:00", "online"),
    sample("23:59:00", "online"),
  ]);
  assert.equal(result.downtimeMs, 180_000);
  assert.equal(result.outages.length, 2);
  assert.equal(result.outages[0].onlineAt, "2026-11-17T00:03:00+08:00");
  assert.equal(result.endStatus, "online");
  assert.ok(result.unverifiedMs > 0);
});

test("missed DSS polls are unverified and do not inflate camera downtime", () => {
  const result = summarizeConnectivity("2026-11-17", camera, [
    sample("00:00:00", "offline"), sample("01:00:00", "online"),
  ]);
  assert.equal(result.downtimeMs, 180_000);
  assert.equal(result.outages[0].onlineAt, null);
  assert.equal(result.outages[0].interrupted, true);
  assert.equal(result.endStatus, "unverified");
});

test("overnight outages keep their observed start but clip downtime to the report day", () => {
  const baseline = { ...sample("00:00:00", "offline"), checked_at: "2026-11-16T23:59:00+08:00",
    status_since_at: "2026-11-16T23:30:00+08:00" };
  const result = summarizeConnectivity("2026-11-17", camera, [baseline, sample("00:01:00", "online")]);
  assert.equal(result.downtimeMs, 60_000);
  assert.equal(result.outages[0].offlineAt, baseline.status_since_at);
  assert.equal(result.outages[0].onlineAt, "2026-11-17T00:01:00+08:00");
  const empty = summarizeConnectivity("2026-11-17", camera, []);
  assert.equal(empty.unverifiedMs, 86_400_000);
  assert.equal(empty.endStatus, "unverified");
});

test("successful status polling records only channels explicitly returned by DSS", async () => {
  let saved;
  const sync = new DssCameraSynchronizer(
    { getChannelStatuses: async () => [{ channelId: "C1", online: false }] },
    { getToken: async () => "token" },
    { sync: async cameras => { saved = cameras; return cameras.length; } },
    "C1", 900_000, 60_000, { info() {}, warn() {} },
  );
  sync.stopped = false;
  sync.cameras = [{ channelId: "C1", deviceCode: "D1", online: true },
    { channelId: "C2", deviceCode: "D1", online: true }];
  await sync.refreshStatuses();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].channelId, "C1");
  assert.equal(saved[0].online, false);
});

test("history triggers record successful upserts atomically without invented backfill", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create table public.clients(id uuid primary key);
      create table public.cameras(id uuid primary key default gen_random_uuid(), client_id uuid references clients(id),
        code text unique, status text);
      insert into clients values ('11111111-1111-4111-8111-111111111111');
      insert into cameras(client_id,code,status) values ('11111111-1111-4111-8111-111111111111','C1','offline');`);
    await db.exec(await readFile(new URL("../../supabase/migrations/202611170001_camera_connectivity.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../../supabase/migrations/202611170002_ignore_stale_camera_checks.sql", import.meta.url), "utf8"));
    assert.equal((await db.query("select * from camera_connectivity_observations")).rows.length, 0);
    const poll = async (status, checkedAt) => db.query(`insert into cameras(client_id,code,status,status_checked_at)
      values ('11111111-1111-4111-8111-111111111111','C1',$1,$2)
      on conflict(code) do update set status=excluded.status,status_checked_at=excluded.status_checked_at`, [status, checkedAt]);
    await poll("offline", "2026-11-17T00:00:00Z");
    await poll("offline", "2026-11-17T00:01:00Z");
    await poll("online", "2026-11-17T00:02:00Z");
    await poll("online", "2026-11-17T01:00:00Z");
    const { rows } = await db.query("select * from camera_connectivity_observations order by checked_at");
    assert.equal(rows.length, 4);
    assert.equal(rows[1].status_since_at.toISOString(), "2026-11-17T00:00:00.000Z");
    assert.equal(rows[2].status_since_at.toISOString(), "2026-11-17T00:02:00.000Z");
    assert.equal(rows[3].status_since_at.toISOString(), "2026-11-17T01:00:00.000Z");
    await poll("offline", "2026-11-17T01:00:00Z");
    assert.equal((await db.query("select * from camera_connectivity_observations")).rows.length, 4);
    assert.equal((await db.query("select status from cameras where code='C1'")).rows[0].status, "online");
  } finally { await db.close(); }
});
