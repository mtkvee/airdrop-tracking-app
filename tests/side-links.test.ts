import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSideLinks, toRenderableSideLinks } from "../app/legacy/sideLinks";

test("normalizeSideLinks keeps typed entries and upgrades plain URL", () => {
  const out = normalizeSideLinks([
    "https://example.com",
    { type: "x", url: "https://x.com/drop" },
  ]);
  assert.deepEqual(out, [
    { type: "", url: "https://example.com" },
    { type: "x", url: "https://x.com/drop" },
  ]);
});

test("toRenderableSideLinks maps known icons", () => {
  const out = toRenderableSideLinks(
    [{ type: "github", url: "https://github.com/org/repo" }],
    (type: string) => type
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].icon, "fa-brands fa-github");
  assert.equal(out[0].href, "https://github.com/org/repo");
});
