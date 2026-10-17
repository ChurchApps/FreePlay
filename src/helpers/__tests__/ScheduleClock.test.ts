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

describe("ScheduleClock teacher paced", () => {
  const paced = { ...manifest, occurrences: [occ("lesson", "09:00", "10:00", "teacherPaced"), occ("music", "10:00", "11:00")] };
  const lessonKey = "lesson|2026-10-18T09:00:00Z";

  it("holds the last item instead of looping or finishing", () => {
    expect(ScheduleClock.nextStep(0, [true, true], "teacherPaced")).toEqual({ index: 1 });
    expect(ScheduleClock.nextStep(1, [true, true], "teacherPaced")).toEqual({ hold: true });
  });

  const lesson = ScheduleClock.resolve(paced, at("09:10"));

  it("keeps a teacher paced lesson on screen past its end time until the teacher lets it go", () => {
    expect(lesson.key).toBe(lessonKey);
    expect(ScheduleClock.resolve(paced, at("10:15")).occurrence?.id).toBe("music");
    expect(ScheduleClock.resolve(paced, at("10:15"), null, lesson).key).toBe(lessonKey);
    expect(ScheduleClock.resolve(paced, at("12:00"), null, lesson).behavior).toBe("teacherPaced");
  });

  it("keeps the lesson after a refreshed manifest drops the ended occurrence", () => {
    const refreshed = { ...paced, occurrences: [paced.occurrences[1]] };
    const kept = ScheduleClock.resolve(refreshed, at("10:15"), null, lesson);
    expect(kept.key).toBe(lessonKey);
    expect(kept.items.map(i => i.cacheKey)).toEqual(["lesson-a", "lesson-b"]);
  });

  it("only stays on slots that are teacher paced and have started", () => {
    const service = ScheduleClock.resolve(manifest, at("09:10"));
    expect(ScheduleClock.resolve(manifest, at("10:15"), null, service).key).toBe("fallback");
    expect(ScheduleClock.resolve(paced, at("08:30"), null, lesson).key).toBe("fallback");
  });

  it("lets the slot go only once the teacher is on the last item and it is done", () => {
    const slot = ScheduleClock.resolve(paced, at("09:10"));
    expect(ScheduleClock.keepsSlot(slot, 0, [true, true], false)).toBe(true);
    expect(ScheduleClock.keepsSlot(slot, 1, [true, true], false)).toBe(true);
    expect(ScheduleClock.keepsSlot(slot, 1, [true, true], true)).toBe(false);
    expect(ScheduleClock.keepsSlot(slot, 0, [true, false], true)).toBe(false);
    expect(ScheduleClock.keepsSlot(ScheduleClock.resolve(paced, at("10:10")), 0, [true, true], false)).toBe(false);
  });
});

describe("ScheduleClock remote control", () => {
  it("maps the remote the same way the manual player does, with select and up opening the panel", () => {
    expect(ScheduleClock.remoteAction("playPause", false)).toBe("playPause");
    expect(ScheduleClock.remoteAction("right", false)).toBe("next");
    expect(ScheduleClock.remoteAction("left", false)).toBe("previous");
    expect(ScheduleClock.remoteAction("select", false)).toBe("panel");
    expect(ScheduleClock.remoteAction("up", false)).toBe("panel");
    expect(ScheduleClock.remoteAction("down", false)).toBeNull();
  });

  it("leaves the remote to the panel while it is open", () => {
    expect(ScheduleClock.remoteAction("right", true)).toBe("panel");
    expect(ScheduleClock.remoteAction("playPause", true)).toBe("panel");
  });

  it("steps to the next or previous playable item inside the slot", () => {
    expect(ScheduleClock.skip(0, [true, false, true], 1, "teacherPaced")).toBe(2);
    expect(ScheduleClock.skip(2, [true, false, true], -1, "teacherPaced")).toBe(0);
    expect(ScheduleClock.skip(2, [true, false, true], 1, "teacherPaced")).toBe(2);
    expect(ScheduleClock.skip(0, [true, true], -1, "holdLast")).toBe(0);
    expect(ScheduleClock.skip(1, [true, true], 1, "loop")).toBe(0);
    expect(ScheduleClock.skip(0, [true, true], -1, "loop")).toBe(1);
  });
});
