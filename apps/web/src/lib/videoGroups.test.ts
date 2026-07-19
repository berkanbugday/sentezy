import assert from "node:assert";
import { groupVideosByDay } from "./videoGroups";
import type { ApiVideo } from "./types";

const video = (id: string, createdAt: string): ApiVideo =>
  ({
    id, title: "t", status: "ready", stage: null, progress: 100, aspectRatio: "r9_16",
    outputKey: null, thumbnailImageId: null, thumbnailUrl: null, durationS: 10, creditsCost: 1,
    createdAt, script: "", options: {},
  }) as unknown as ApiVideo;

// Fixed "now": 2026-07-20, 10:00 local. All fixtures below are built from local Date
// constructors (never raw UTC strings) so the grouping is exercised against local calendar
// days regardless of the timezone this script happens to run in.
const now = new Date(2026, 6, 20, 10, 0, 0);

// Empty input → empty output, not a group with no videos.
assert.deepStrictEqual(groupVideosByDay([], now), []);

// A video created today lands under "Bugün".
{
  const v = video("today", new Date(2026, 6, 20, 8, 0, 0).toISOString());
  const groups = groupVideosByDay([v], now);
  assert.strictEqual(groups.length, 1);
  assert.strictEqual(groups[0].label, "Bugün");
  assert.deepStrictEqual(groups[0].videos, [v]);
}

// A video created yesterday lands under "Dün".
{
  const v = video("yesterday", new Date(2026, 6, 19, 20, 0, 0).toISOString());
  const groups = groupVideosByDay([v], now);
  assert.strictEqual(groups.length, 1);
  assert.strictEqual(groups[0].label, "Dün");
}

// Anything older gets a readable absolute Turkish date.
{
  const v = video("older", new Date(2026, 6, 15, 12, 0, 0).toISOString());
  const groups = groupVideosByDay([v], now);
  assert.strictEqual(groups.length, 1);
  assert.strictEqual(groups[0].label, "15 Temmuz 2026");
}

// Two videos on the same calendar day land in ONE group, newest first within it.
{
  const a = video("a", new Date(2026, 6, 20, 9, 0, 0).toISOString());
  const b = video("b", new Date(2026, 6, 20, 7, 0, 0).toISOString());
  const groups = groupVideosByDay([a, b], now);
  assert.strictEqual(groups.length, 1);
  assert.deepStrictEqual(groups[0].videos, [a, b]);
}

// Groups come out newest-first, following the (already newest-first) input order.
{
  const todayV = video("t", new Date(2026, 6, 20, 8, 0, 0).toISOString());
  const yesterdayV = video("y", new Date(2026, 6, 19, 8, 0, 0).toISOString());
  const olderV = video("o", new Date(2026, 6, 10, 8, 0, 0).toISOString());
  const groups = groupVideosByDay([todayV, yesterdayV, olderV], now);
  assert.deepStrictEqual(groups.map((g) => g.label), ["Bugün", "Dün", "10 Temmuz 2026"]);
}

// Two videos an hour apart that straddle local midnight land in DIFFERENT groups — the
// case a naive Math.floor(ms / 86_400_000) (UTC epoch-day math) gets wrong.
{
  const beforeMidnight = video("before", new Date(2026, 6, 15, 23, 30, 0).toISOString());
  const afterMidnight = video("after", new Date(2026, 6, 16, 0, 30, 0).toISOString());
  const groups = groupVideosByDay([afterMidnight, beforeMidnight], now);
  assert.strictEqual(groups.length, 2);
  assert.notStrictEqual(groups[0].key, groups[1].key);
  assert.strictEqual(groups[0].videos.length, 1);
  assert.strictEqual(groups[1].videos.length, 1);
}

console.log("apps/web/src/lib/videoGroups.test.ts ok");
