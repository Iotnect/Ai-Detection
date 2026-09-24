import assert from "node:assert/strict";
import test from "node:test";

process.env.AI_SERVICE_SECRET = "test-ai-secret-value";
process.env.DASHBOARD_WS_SECRET = "test-dashboard-secret-value";

const { rewriteHlsManifest } = await import("../dist/routes/streams.js");

test("HLS proxy carries the stream ticket into every nested resource", () => {
  const manifest = [
    "#EXTM3U",
    '#EXT-X-MAP:URI="init.mp4"',
    "segment.mp4?session=abc",
    "",
  ].join("\n");

  assert.equal(
    rewriteHlsManifest(manifest, "signed.ticket"),
    [
      "#EXTM3U",
      '#EXT-X-MAP:URI="init.mp4?ticket=signed.ticket"',
      "segment.mp4?session=abc&ticket=signed.ticket",
      "",
    ].join("\n"),
  );
});
