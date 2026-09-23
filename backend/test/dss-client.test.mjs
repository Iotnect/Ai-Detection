import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";
import http from "node:http";
import test from "node:test";

import { DssClient } from "../dist/dss/client.js";

const md5 = (value) => createHash("md5").update(value).digest("hex");

test("DSS authentication and StartVideo use the documented protocol", async () => {
  const username = "test-user";
  const password = "test-password";
  const realm = "test-realm";
  const randomKey = "test-random-key";
  const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const publicKeyBase64 = publicKey
    .export({ type: "spki", format: "der" })
    .toString("base64");
  let authorizeCalls = 0;

  const server = http.createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      response.setHeader("Content-Type", "application/json");

      if (request.url?.endsWith("/accounts/authorize")) {
        authorizeCalls += 1;

        if (authorizeCalls === 1) {
          response.statusCode = 401;
          response.end(JSON.stringify({ realm, randomKey, publickey: publicKeyBase64 }));
          return;
        }

        const expectedSignature = md5(
          `${md5(`${username}:${realm}:${md5(md5(username + md5(password)))}`)}:${randomKey}`,
        );
        assert.equal(body.signature, expectedSignature);
        assert.equal(body.randomKey, randomKey);
        assert.ok(body.secretKey.length > 100);
        assert.ok(body.secretVector.length > 100);
        response.end(
          JSON.stringify({
            code: 1000,
            desc: "Success",
            data: { token: "login-token", credential: "credential" },
          }),
        );
        return;
      }

      if (request.url?.endsWith("/StartVideo")) {
        assert.equal(request.headers["x-subject-token"], "login-token");
        assert.equal(body.data.channelId, "1000001$1$0$0");
        response.end(
          JSON.stringify({
            code: 1000,
            desc: "Success",
            data: {
              url: "rtsp://192.168.0.100:9100/internal|rtsp://example.test:9100/external",
              token: "56",
            },
          }),
        );
        return;
      }

      response.statusCode = 404;
      response.end("{}");
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.notEqual(typeof address, "string");

  try {
    const client = new DssClient(
      `http://127.0.0.1:${address.port}`,
      true,
      username,
      password,
      "00:11:22:33:44:55",
    );
    const session = await client.authenticate();
    const stream = await client.startVideo(session.token, "1000001$1$0$0");

    assert.equal(session.token, "login-token");
    assert.equal(stream.rtspUrl, "rtsp://example.test:9100/external?token=56");
  } finally {
    server.close();
  }
});
