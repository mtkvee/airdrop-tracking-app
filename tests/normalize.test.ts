import assert from "node:assert/strict";
import test from "node:test";
import { normalizeProjects } from "../app/legacy/normalize";

test("normalizeProjects normalizes side links and note", () => {
  const input = [
    {
      id: 1,
      name: "Drop A",
      note: "hello note",
      sideLinks: [
        "https://x.com/project",
        { type: "discord", url: "https://discord.gg/project" },
      ],
    },
  ];
  const out = normalizeProjects(input);
  assert.equal(out.length, 1);
  assert.equal(out[0].note, "hello note");
  assert.deepEqual(out[0].sideLinks, [
    { type: "", url: "https://x.com/project" },
    { type: "discord", url: "https://discord.gg/project" },
  ]);
});

test("normalizeProjects supports legacy side link shape", () => {
  const input = [
    {
      id: 2,
      name: "Drop B",
      sideLinks: {
        x: "https://x.com/legacy",
        discord: "https://discord.gg/legacy",
      },
    },
  ];
  const out = normalizeProjects(input);
  assert.deepEqual(out[0].sideLinks, [
    { type: "", url: "https://x.com/legacy" },
    { type: "", url: "https://discord.gg/legacy" },
  ]);
});
