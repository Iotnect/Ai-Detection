import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { umEventRoutes } from "../dist/routes/um-events.js";
import { publicUmReading } from "../dist/domain/um-event.js";
import { SupabaseUmEventStore } from "../dist/db/um-event-store.js";

const secret = "dedicated-um-key-".repeat(3);
const payload = {
  device_id: "um-flood-edge-01", timestamp: "2026-11-12T05:17:00.123456+00:00",
  level_code: 1, status: "NORMAL", waterline_y_px: 685, trigger: "STATE_CHANGE",
  streams: { raw_rtsp: "rtsp://user:private@100.64.0.1:8554/channel_0", ai_rtsp: "rtsp://100.64.0.1:8554/channel_1" },
};

test("24-hour UM trend paginates beyond 1000 rows within the device and time scope", async () => {
  const calls = [];
  let page = 0;
  const row = { id: "reading", device_id: payload.device_id, timestamp: payload.timestamp,
    received_at: payload.timestamp, status: "NORMAL", level_code: 1, waterline_y_px: 685, trigger: "HEARTBEAT" };
  const database = { from(table) {
    assert.equal(table, "um_events");
    const query = {};
    for (const method of ["select", "eq", "gte", "order"]) query[method] = (...args) => { calls.push([method, ...args]); return query; };
    query.range = async (start, end) => { calls.push(["range", start, end]); return { data: page++ === 0 ? Array(1000).fill(row) : [row], error: null }; };
    return query;
  } };
  const store = new SupabaseUmEventStore(database);
  const since = "2026-11-11T05:00:00Z";
  assert.equal((await store.history(payload.device_id, Number.MAX_SAFE_INTEGER, since)).length, 1001);
  for (const expected of [["eq", "device_id", payload.device_id], ["gte", "timestamp", since], ["range", 1000, 1999]]) {
    assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(expected)));
  }
});

test("UM ingress accepts firmware payload, persists retries once and returns sanitized history", async () => {
  const db = new PGlite();
  const app = Fastify();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role;");
    await db.exec(await readFile(new URL("../../supabase/migrations/202611120001_um_events.sql", import.meta.url), "utf8"));
    const store = {
      async save(event) {
        const args = [event.device_id, event.timestamp, event.level_code, event.status, event.waterline_y_px, event.trigger, event.streams?.raw_rtsp, event.streams?.ai_rtsp];
        const inserted = await db.query("insert into um_events(device_id,timestamp,level_code,status,waterline_y_px,trigger,raw_rtsp,ai_rtsp) values ($1,$2,$3,$4,$5,$6,$7,$8) on conflict(device_id,timestamp,trigger) do nothing returning *", args);
        const duplicate = !inserted.rows.length;
        const row = inserted.rows[0] ?? (await db.query("select * from um_events where device_id=$1 and timestamp=$2 and trigger=$3", [event.device_id, event.timestamp, event.trigger])).rows[0];
        return { reading: publicUmReading({ ...row, timestamp: row.timestamp.toISOString(), received_at: row.received_at.toISOString() }), duplicate };
      },
      async history(device, limit, since) {
        const { rows } = await db.query("select * from um_events where device_id=$1 and ($3::timestamptz is null or timestamp >= $3::timestamptz) order by timestamp desc, received_at desc limit $2", [device, limit, since ?? null]);
        return rows.map(row => publicUmReading({ ...row, timestamp: row.timestamp.toISOString(), received_at: row.received_at.toISOString() }));
      },
    };
    await app.register(umEventRoutes, { prefix: "/api/v1", secret, deviceId: payload.device_id, store });
    const post = body => app.inject({ method: "POST", url: "/api/v1/um/events", headers: { authorization: `Bearer ${secret}` }, payload: body });
    const first = await post(payload);
    assert.equal(first.statusCode, 201);
    assert.equal(first.json().persisted, true);
    const repeated = await post(payload);
    assert.equal(repeated.statusCode, 200);
    assert.equal(repeated.json().duplicate, true);
    assert.equal(repeated.json().id, first.json().id);
    assert.equal(repeated.json().received_at, first.json().received_at);
    assert.equal((await post({ ...payload, timestamp: "2026-11-12T05:18:00Z", status: "WARNING", trigger: "HEARTBEAT" })).statusCode, 201);
    assert.equal((await post({ ...payload, timestamp: "2026-11-11T05:18:00Z" })).statusCode, 201);
    const history = await app.inject({ url: "/api/v1/um/events", headers: { origin: "https://neovision.iotnect.com" } });
    assert.equal(history.statusCode, 200);
    assert.equal(history.json().data.length, 3);
    assert.equal(history.json().latest.status, "WARNING");
    assert.equal(history.json().latest.camera_id, "UM-C1");
    assert.ok(!history.body.includes("rtsp") && !history.body.includes("private") && !history.body.includes(secret));
    assert.equal((await app.inject({ url: "/api/v1/um/events", headers: { origin: "https://mbs.iotnect.com" } })).statusCode, 403);
    assert.equal((await app.inject({ url: "/api/v1/um/events" })).statusCode, 403);
    assert.equal((await app.inject({ method: "POST", url: "/api/v1/um/events", payload })).statusCode, 401);
    assert.equal((await post({ ...payload, device_id: "MBS-KDN-C1" })).statusCode, 403);
    assert.equal((await post({ ...payload, waterline_y_px: -1 })).statusCode, 400);
    assert.equal((await post({ ...payload, streams: { raw_rtsp: "http://localhost/" } })).statusCode, 400);
    assert.equal((await post({ ...payload, timestamp: new Date(Date.now() + 600_000).toISOString() })).statusCode, 400);
  } finally { await app.close(); await db.close(); }
});

test("UM returns 503 when storage fails, and 503 when UM is not configured", async () => {
  const app = Fastify();
  await app.register(umEventRoutes, { secret, deviceId: payload.device_id,
    store: { save: async () => { throw new Error("db unavailable"); }, history: async () => { throw new Error("db unavailable"); } } });
  assert.equal((await app.inject({ method: "POST", url: "/um/events", payload, headers: { authorization: `Bearer ${secret}` } })).statusCode, 503);
  assert.equal((await app.inject({ url: "/um/events", headers: { origin: "https://neovision.iotnect.com" } })).statusCode, 503);
  await app.close();
  const disabled = Fastify();
  await disabled.register(umEventRoutes, { deviceId: payload.device_id });
  assert.equal((await disabled.inject({ method: "POST", url: "/um/events", payload })).statusCode, 503);
  await disabled.close();
});
