import { ScheduleEndBehavior, ScheduleItem, ScheduleManifest, ScheduleOccurrence } from "../interfaces";

export interface ScheduleSlot {
  key: string;
  occurrence: ScheduleOccurrence | null;
  items: ScheduleItem[];
  behavior: ScheduleEndBehavior;
}

export type ScheduleStep = { index: number } | { hold: true } | { finished: true };

const time = (iso: string) => Date.parse(iso);
const NO_ITEMS: ScheduleItem[] = [];

export class ScheduleClock {
  static isExpired(manifest: ScheduleManifest, now: number): boolean {
    return !!manifest.validUntil && now >= time(manifest.validUntil);
  }

  static activeOccurrence(manifest: ScheduleManifest | null, now: number): ScheduleOccurrence | null {
    if (!manifest || this.isExpired(manifest, now)) return null;
    let active: ScheduleOccurrence | null = null;
    for (const occ of manifest.occurrences || []) {
      if (time(occ.start) <= now && now < time(occ.end) && (!active || time(occ.start) >= time(active.start))) active = occ;
    }
    return active;
  }

  static nextOccurrence(manifest: ScheduleManifest | null, now: number): ScheduleOccurrence | null {
    if (!manifest || this.isExpired(manifest, now)) return null;
    const upcoming = (manifest.occurrences || []).filter(o => time(o.start) > now);
    upcoming.sort((a, b) => time(a.start) - time(b.start));
    return upcoming[0] || null;
  }

  // An occurrence whose endBehavior is "fallback" hands over to the fallback loop once it has played through.
  static resolve(manifest: ScheduleManifest | null, now: number, finishedKey: string | null = null): ScheduleSlot {
    const occ = this.activeOccurrence(manifest, now);
    const key = occ ? occ.id + "|" + occ.start : "fallback";
    if (occ && !(occ.endBehavior === "fallback" && finishedKey === key)) {
      return { key, occurrence: occ, items: occ.items || NO_ITEMS, behavior: occ.endBehavior };
    }
    return { key: "fallback", occurrence: null, items: manifest?.fallback || NO_ITEMS, behavior: "loop" };
  }

  static nextStep(index: number, playable: boolean[], behavior: ScheduleEndBehavior): ScheduleStep {
    for (let i = index + 1; i < playable.length; i++) if (playable[i]) return { index: i };
    if (behavior === "loop") {
      for (let i = 0; i <= Math.min(index, playable.length - 1); i++) if (playable[i]) return { index: i };
      return { index: -1 };
    }
    return behavior === "holdLast" ? { hold: true } : { finished: true };
  }

  static readyThrough(manifest: ScheduleManifest | null, isCached: (cacheKey: string) => boolean, now: number): string | null {
    if (!manifest) return null;
    const ready = (items: ScheduleItem[] | null) => (items || []).every(i => isCached(i.cacheKey));
    if (!ready(manifest.fallback)) return null;
    const pending = (manifest.occurrences || []).filter(o => time(o.end) > now).sort((a, b) => time(a.start) - time(b.start));
    const gap = pending.find(o => !ready(o.items));
    if (!gap) return manifest.validUntil;
    return new Date(Math.max(now, time(gap.start))).toISOString();
  }
}
