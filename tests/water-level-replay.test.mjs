import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/water-level-replay.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
});
const { waterLevelReplay } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const now = Date.parse("2026-11-04T06:00:00+08:00");
const host = "neovision.iotnect.com";
const reading = (timestamp, smoothed_y = 331, camera_id = "MBS-KDN-C1") => ({ timestamp, smoothed_y, camera_id });
const old = [reading("2026-10-28T08:00:00+08:00", 282), reading("2026-10-29T09:00:00+08:00", 310), reading("2026-10-29T10:00:00+08:00")];

test("only the exact NeoVision domain can replay", () => {
  for (const hostname of [null, "mbs.iotnect.com", "localhost", "neovision.iotnect.com.example.com"]) {
    assert.equal(waterLevelReplay(hostname, old, undefined, now, 0), undefined);
  }
  assert.ok(waterLevelReplay(host.toUpperCase(), old, undefined, now, 0));
});
test("cycles original values within the latest historical day without rewriting timestamps", () => {
  const first = waterLevelReplay(host, old, undefined, now, 0);
  assert.deepEqual(first.events, old.slice(1));
  assert.equal(first.current, old[1]);
  assert.equal(waterLevelReplay(host, old, undefined, now, 1).current, old[2]);
  assert.equal(waterLevelReplay(host, old, undefined, now, 2).current, old[1]);
});
test("fresh live or persisted data ends replay; stale data does not", () => {
  const fresh = reading(new Date(now - 60_000).toISOString());
  assert.equal(waterLevelReplay(host, old, fresh, now, 0), undefined);
  assert.equal(waterLevelReplay(host, [...old, fresh], undefined, now, 0), undefined);
  assert.ok(waterLevelReplay(host, old, old[2], now, 0));
});
test("missing, invalid, future-only and other-camera data cannot produce replay", () => {
  assert.equal(waterLevelReplay(host, [], undefined, now, 0), undefined);
  assert.equal(waterLevelReplay(host, [reading("invalid"), reading(old[0].timestamp, NaN), reading(old[0].timestamp, 331, "MBS-KDN-C2"), reading(new Date(now + 60_000).toISOString())], undefined, now, 0), undefined);
});
