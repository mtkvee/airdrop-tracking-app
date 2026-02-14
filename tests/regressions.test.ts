import assert from "node:assert/strict";
import test from "node:test";
import { compareProjectValues, parseImportPayload } from "../app/legacy/regressions";

test("parseImportPayload accepts customOptions-only payloads", () => {
  const payload = {
    customOptions: {
      airdropTaskType: [{ value: "quest", text: "Quest" }],
    },
  };
  const out = parseImportPayload(payload);
  assert.equal(out.hasImportedContent, true);
  assert.deepEqual(out.projects, []);
  assert.deepEqual(out.customOptions, payload.customOptions);
});

test("parseImportPayload rejects empty payloads", () => {
  const out = parseImportPayload({});
  assert.equal(out.hasImportedContent, false);
  assert.deepEqual(out.projects, []);
  assert.equal(out.customOptions, null);
  assert.equal(out.lastUpdatedAt, null);
});

test("compareProjectValues sorts multi-value task/connect/reward fields", () => {
  const a = { taskType: ["daily"], connectType: ["evm"], rewardType: ["nft"] };
  const b = { taskType: ["quest"], connectType: ["sol"], rewardType: ["whitelist"] };

  assert.equal(compareProjectValues(a, b, "taskType", "asc") < 0, true);
  assert.equal(compareProjectValues(a, b, "taskType", "desc") > 0, true);
  assert.equal(compareProjectValues(a, b, "connectType", "asc") < 0, true);
  assert.equal(compareProjectValues(a, b, "rewardType", "asc") < 0, true);
});

test("compareProjectValues keeps name/status behavior", () => {
  const a = { name: "alpha", status: "confirmed" };
  const b = { name: "beta", status: "reward" };
  assert.equal(compareProjectValues(a, b, "name", "asc") < 0, true);
  assert.equal(compareProjectValues(a, b, "status", "asc") < 0, true);
});
