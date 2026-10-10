import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/map-flood-status.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
});
const { findMapFloodDetection, mapFloodStatus } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);
const detection = (status, overrides = {}) => ({
  camera_id: "MBS-KDN-C1", status, timestamp: "2026-10-10T01:00:00Z", ...overrides,
});

test("rising and legacy warning trigger yellow; danger triggers red", () => {
  assert.equal(mapFloodStatus(detection("RISING")), "rising");
  assert.equal(mapFloodStatus(detection(" warning ")), "rising");
  assert.equal(mapFloodStatus(detection("DANGER")), "danger");
});

test("missing or unrecognised readings never imply normal water levels", () => {
  assert.equal(mapFloodStatus(), "unknown");
  assert.equal(mapFloodStatus(detection("unavailable")), "unknown");
  assert.equal(mapFloodStatus(detection("NORMAL")), "normal");
});

test("newer normal clears earlier danger regardless of array order", () => {
  const danger = detection("DANGER");
  const normal = detection("NORMAL", { timestamp: "2026-10-10T01:01:00Z" });
  for (const readings of [[danger, normal], [normal, danger]]) {
    assert.equal(mapFloodStatus(findMapFloodDetection(readings, "MBS-KDN-C1")), "normal");
  }
});

test("alerts stay with their exact camera and ignore invalid timestamps", () => {
  const readings = [detection("DANGER"), detection("RISING", { camera_id: "MBS-KDN-C10" }),
    detection("NORMAL", { timestamp: "invalid" })];
  assert.equal(mapFloodStatus(findMapFloodDetection(readings, " mbs-kdn-c1 ")), "danger");
  assert.equal(findMapFloodDetection(readings, "MBS-KDN-C2"), undefined);
});
