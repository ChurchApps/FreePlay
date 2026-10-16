import { ScheduleClock } from "../ScheduleClock";
import { ScheduleManifest, ScheduleOccurrence } from "../../interfaces";

const item = (cacheKey: string) => ({ cacheKey, title: cacheKey, mediaType: "image" as const, seconds: 10, loopVideo: false, resolve: "url" as const });
const at = (hhmm: string) => Date.parse(`2026-10-18T${hhmm}:00Z`);
const occ = (id: string, start: string, end: string, endBehavior: ScheduleOccurrence["endBehavior"] = "loop"): ScheduleOccurrence => (
  { id, start: `2026-10-18T${start}:00Z`, end: `2026-10-18T${end}:00Z`, endBehavior, items: [item(id + "-a"), item(id + "-b")] }
);

const manifest: ScheduleManifest = {
  timeZone: "America/Chicago",
  generatedAt: "2026-10-18T00:00:00Z",
  rev: 1,
  validUntil: "2026-10-25T00:00:00Z",
  fallback: [item("fb")],
  occurrences: [occ("service", "09:00", "10:00"), occ("countdown", "08:45", "09:00", "fallback"), occ("late", "09:30", "09:45", "holdLast")]
};

describe("ScheduleClock.resolve", () => {
  it("plays the fallback loop when nothing is scheduled", () => {
    const slot = ScheduleClock.resolve(manifest, at("08:00"));
    expect(slot.key).toBe("fallback");
    expect(slot.items.map(i => i.cacheKey)).toEqual(["fb"]);
  });

  it("treats start as inclusive and end as exclusive", () => {
    expect(ScheduleClock.resolve(manifest, at("08:45")).occurrence?.id).toBe("countdown");
    expect(ScheduleClock.resolve(manifest, at("09:00")).occurrence?.id).toBe("service");
    expect(ScheduleClock.resolve(manifest, at("10:00")).key).toBe("fallback");
  });

  it("lets the latest start win on overlap", () => {
    expect(ScheduleClock.resolve(manifest, at("09:35")).occurrence?.id).toBe("late");
    expect(ScheduleClock.resolve(manifest, at("09:50")).occurrence?.id).toBe("service");
  });

  it("switches a finished fallback-behaviour occurrence to the fallback loop", () => {
    const finished = ScheduleClock.resolve(manifest, at("08:50")).key;
    expect(ScheduleClock.resolve(manifest, at("08:50"), finished).key).toBe("fallback");
    expect(ScheduleClock.resolve(manifest, at("09:10"), finished).occurrence?.id).toBe("service");
  });

  it("uses only the fallback once the manifest is past validUntil", () => {
    expect(ScheduleClock.resolve({ ...manifest, validUntil: "2026-10-18T09:15:00Z" }, at("09:20")).key).toBe("fallback");
  });

  it("finds the next occurrence", () => {
    expect(ScheduleClock.nextOccurrence(manifest, at("08:50"))?.id).toBe("service");
  });
});

describe("ScheduleClock.nextStep", () => {
  it("skips files that are not cached", () => {
    expect(ScheduleClock.nextStep(0, [true, false, true], "loop")).toEqual({ index: 2 });
  });

  it("loops back to the first playable file", () => {
    expect(ScheduleClock.nextStep(2, [false, true, true], "loop")).toEqual({ index: 1 });
    expect(ScheduleClock.nextStep(0, [true], "loop")).toEqual({ index: 0 });
    expect(ScheduleClock.nextStep(-1, [false, false], "loop")).toEqual({ index: -1 });
  });

  it("holds the last file or finishes at the end of a play-once list", () => {
    expect(ScheduleClock.nextStep(1, [true, true], "holdLast")).toEqual({ hold: true });
    expect(ScheduleClock.nextStep(1, [true, true], "fallback")).toEqual({ finished: true });
  });
});

describe("ScheduleClock.readyThrough", () => {
  it("reports the start of the first occurrence with missing files", () => {
    const cached = (key: string) => !key.startsWith("late");
    expect(ScheduleClock.readyThrough(manifest, cached, at("08:00"))).toBe("2026-10-18T09:30:00.000Z");
    expect(ScheduleClock.readyThrough(manifest, key => key !== "fb", at("08:00"))).toBeNull();
    expect(ScheduleClock.readyThrough(manifest, () => true, at("08:00"))).toBe(manifest.validUntil);
  });
});
