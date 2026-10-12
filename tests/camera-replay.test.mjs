import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/camera-replay.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
});
const { shouldReplayCamera } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("only the exact Neovision hostname can replay C1 during an outage", () => {
  for (const hostname of ["mbs.iotnect.com", "localhost", "", "neovision.iotnect.com.example.com"]) {
    assert.equal(shouldReplayCamera(hostname, "MBS-KDN-C1", "offline", true), false);
  }
  assert.equal(shouldReplayCamera("NEOVISION.IOTNECT.COM", "MBS-KDN-C1", "offline", false), true);
});

test("only C1 replays, including when other camera streams fail", () => {
  for (const code of ["MBS-KDN-C2", "MBS-KDN-C10", "client-dss-channel-1"]) {
    assert.equal(shouldReplayCamera("neovision.iotnect.com", code, "offline", true), false);
  }
});

test("camera outages and playback failure enable replay; healthy or unknown status does not", () => {
  const replay = (status, failed = false) =>
    shouldReplayCamera("neovision.iotnect.com", "MBS-KDN-C1", status, failed);
  for (const status of ["offline", "reconnecting", "error"]) assert.equal(replay(status), true);
  assert.equal(replay("online", true), true);
  assert.equal(replay(undefined, true), true);
  assert.equal(replay(undefined), false);
  assert.equal(replay("online"), false);
  // Once both camera status and playback recover, the replay stops.
  assert.equal(replay("offline", true), true);
  assert.equal(replay("online", false), false);
});
