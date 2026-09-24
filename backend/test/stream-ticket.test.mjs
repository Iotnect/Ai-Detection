import assert from "node:assert/strict";
import test from "node:test";

process.env.AI_SERVICE_SECRET = "test-ai-secret-value";
process.env.DASHBOARD_WS_SECRET = "test-dashboard-secret-value";

const {
  createStreamTicket,
  DASHBOARD_WEBSOCKET_TICKET_PATH,
  verifyStreamTicket,
} = await import(
  "../dist/auth/stream-ticket.js"
);

test("stream tickets are signed, path-scoped, and tamper-resistant", () => {
  const { token, expiresIn } = createStreamTicket("client-1", "mbs-kdn-c1");

  assert.equal(expiresIn, 300);
  assert.equal(verifyStreamTicket(token, "mbs-kdn-c1")?.clientId, "client-1");
  assert.equal(verifyStreamTicket(token, "another-camera"), undefined);
  assert.equal(verifyStreamTicket(`${token}x`, "mbs-kdn-c1"), undefined);
});

test("dashboard WebSocket tickets cannot authorize camera streams", () => {
  const { token } = createStreamTicket(
    "client-1",
    DASHBOARD_WEBSOCKET_TICKET_PATH,
  );

  assert.equal(
    verifyStreamTicket(token, DASHBOARD_WEBSOCKET_TICKET_PATH)?.clientId,
    "client-1",
  );
  assert.equal(verifyStreamTicket(token, "mbs-kdn-c1"), undefined);
});
