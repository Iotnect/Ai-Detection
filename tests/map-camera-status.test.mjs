import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

// Exercise the pure frontend resolver without loading React or Supabase.
const source = await readFile(new URL("../src/lib/map-camera-status.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
});
const { findMapCameraStatus, cameraConnectivityMessage } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

function record(number, overrides = {}) {
  return {
    id: `camera-${number}`, code: `client-dss-channel-${number}`,
    name: `MBS-KDN-C${number} Camera location`, location: null,
    status: "online", last_seen_at: "2026-10-09T11:07:15Z", ...overrides,
  };
}

test("all seven online DSS cameras resolve despite generated database codes", () => {
  const inventory = Array.from({ length: 7 }, (_, index) => record(index + 1));
  for (let index = 1; index <= 7; index++) {
    const resolved = findMapCameraStatus(inventory, `MBS-KDN-C${index}`);
    assert.equal(resolved, inventory[index - 1]);
    assert.equal(resolved.status, "online");
  }
});

test("explicit camera codes take precedence over name matches", () => {
  const exact = record(2, { code: "MBS-KDN-C2", status: "offline" });
  assert.equal(findMapCameraStatus([record(2), exact], "MBS-KDN-C2"), exact);
});

test("name matching handles case and surrounding whitespace", () => {
  const camera = record(2, { name: "  mbs-kdn-c2 Hadapan Big Farmasi  " });
  assert.equal(findMapCameraStatus([camera], " MBS-KDN-C2 "), camera);
});

test("C1 never matches C10 or identifiers embedded inside unrelated names", () => {
  assert.equal(findMapCameraStatus([record(10), record(1, { name: "Backup MBS-KDN-C1" })], "MBS-KDN-C1"), undefined);
});

test("ambiguous or missing camera names remain unavailable", () => {
  assert.equal(findMapCameraStatus([record(2), record(2, { id: "duplicate" })], "MBS-KDN-C2"), undefined);
  assert.equal(findMapCameraStatus([], "MBS-KDN-C2"), undefined);
});

test("status changes resolve to the latest inventory without assuming online", () => {
  for (const status of ["online", "offline", "reconnecting", "error"]) {
    assert.equal(findMapCameraStatus([record(3, { status })], "MBS-KDN-C3").status, status);
  }
});

test("selected camera messages preserve online and last-online meaning", () => {
  assert.match(cameraConnectivityMessage(record(1)), /^Online now .*Last checked .*MYT/);
  assert.match(cameraConnectivityMessage(record(1, { status: "offline" })), /^Last online .*MYT/);
  assert.equal(cameraConnectivityMessage(record(1, { last_seen_at: null })), "Online now");
  assert.equal(cameraConnectivityMessage(record(1, { status: "offline", last_seen_at: null })), "No online activity recorded yet");
});
