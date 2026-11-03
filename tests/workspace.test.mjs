import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/workspace.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
});
const { isNeoVisionHost, isPublicDemoRoute } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("only the exact NeoVision host gets project selection and public UM routes", () => {
  assert.equal(isNeoVisionHost("NEOVISION.IOTNECT.COM"), true);
  for (const host of ["mbs.iotnect.com", "localhost", "neovision.iotnect.com.example.com", ""]) {
    assert.equal(isNeoVisionHost(host), false);
    assert.equal(isPublicDemoRoute(host, "/"), false);
    assert.equal(isPublicDemoRoute(host, "/um"), false);
  }
});

test("MBS and login routes stay authenticated, UM route matching respects segment boundaries", () => {
  for (const path of ["/", "/um", "/um/ai-detection", "/um/reporting"]) {
    assert.equal(isPublicDemoRoute("neovision.iotnect.com", path), true);
  }
  for (const path of ["/login", "/camera-status", "/ai-detection", "/reporting", "/umbrella"]) {
    assert.equal(isPublicDemoRoute("neovision.iotnect.com", path), false);
  }
});
