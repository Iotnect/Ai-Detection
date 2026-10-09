import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/hold-video-frame.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
});
const { holdVideoFrame } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

function setup({ nativeFallback = false, contextAvailable = true } = {}) {
  const video = Object.assign(new EventTarget(), {
    readyState: 4, videoWidth: 1920, videoHeight: 1080, paused: false,
  });
  let nextId = 0;
  const pending = new Map();
  if (!nativeFallback) {
    video.requestVideoFrameCallback = (callback) => { pending.set(++nextId, callback); return nextId; };
    video.cancelVideoFrameCallback = (id) => pending.delete(id);
  }
  let copies = 0;
  const canvas = { width: 0, height: 0, getContext: () => contextAvailable ? { drawImage: () => copies++ } : null };
  const changes = [];
  const player = holdVideoFrame(video, canvas, (held) => changes.push(held));
  return {
    video, canvas, changes, player, pending,
    event: (name) => video.dispatchEvent(new Event(name)),
    frame() { const [id, callback] = pending.entries().next().value; pending.delete(id); callback(); },
    copies: () => copies,
  };
}

test("buffering retains the last frame and waits for a new displayed frame to resume", () => {
  const s = setup();
  s.frame();
  assert.equal(s.canvas.width, 1280);
  assert.equal(s.canvas.height, 720);
  s.video.readyState = 2;
  s.event("waiting");
  assert.equal(s.changes.at(-1), true);
  s.event("playing"); // This event alone can precede an actual decoded frame.
  assert.equal(s.changes.at(-1), true);
  s.video.readyState = 4;
  s.frame();
  assert.equal(s.changes.at(-1), false);
  s.player.dispose();
});

test("fatal errors and ticket refreshes retain cached pixels after the video resets", () => {
  const s = setup();
  s.frame();
  const copies = s.copies();
  s.video.readyState = 0;
  s.event("error");
  s.player.freeze();
  assert.equal(s.changes.at(-1), true);
  assert.equal(s.copies(), copies);
  assert.equal(s.canvas.width, 1280);
  s.player.dispose();
});

test("buffering before any frame does not show a blank snapshot", () => {
  const s = setup();
  s.video.readyState = 0;
  s.event("waiting");
  assert.deepEqual(s.changes, [false]);
  s.player.dispose();
});

test("stalled requests do not freeze while playable data remains buffered", () => {
  const s = setup();
  s.frame();
  s.event("stalled");
  assert.equal(s.changes.at(-1), false);
  s.video.readyState = 2;
  s.event("stalled");
  assert.equal(s.changes.at(-1), true);
  s.player.dispose();
});

test("manual pause stays paused rather than being automatically resumed", () => {
  const s = setup();
  s.frame();
  s.video.paused = true;
  s.event("pause");
  assert.equal(s.changes.at(-1), false);
  s.player.freeze();
  s.frame();
  assert.equal(s.changes.at(-1), true);
  s.player.dispose();
});

test("older/native players resume using frame progress events", () => {
  const s = setup({ nativeFallback: true });
  s.event("timeupdate");
  s.video.readyState = 0;
  s.event("waiting");
  assert.equal(s.changes.at(-1), true);
  s.video.readyState = 4;
  s.event("timeupdate");
  assert.equal(s.changes.at(-1), false);
  s.player.dispose();
});

test("cleanup cancels frame capture and clears pixels before a different stream", () => {
  const s = setup();
  s.frame();
  s.player.dispose();
  assert.equal(s.pending.size, 0);
  assert.equal(s.canvas.width, 0);
  const changes = [...s.changes];
  s.event("waiting");
  s.player.freeze();
  assert.deepEqual(s.changes, changes);
});

test("unavailable canvas context leaves normal playback intact", () => {
  const s = setup({ contextAvailable: false });
  s.event("waiting");
  s.frame();
  assert.deepEqual(s.changes, [false]);
  s.player.dispose();
});
