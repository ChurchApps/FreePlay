import { ScheduleEndBehavior, ScheduleItem, ScheduleManifest, ScheduleOccurrence } from "../interfaces";

export interface ScheduleSlot {
  key: string;
  occurrence: ScheduleOccurrence | null;
  items: ScheduleItem[];
  behavior: ScheduleEndBehavior;
}

export type ScheduleStep = { index: number } | { hold: true } | { finished: true };
export type RemoteAction = "panel" | "overview" | "playPause" | "next" | "previous";

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
  // stayOn is a teacher paced slot the teacher has not finished; it stays on screen past its end time,
  // even after a refreshed manifest has dropped the ended occurrence.
  static resolve(manifest: ScheduleManifest | null, now: number, finishedKey: string | null = null, stayOn: ScheduleSlot | null = null): ScheduleSlot {
    if (stayOn?.occurrence && stayOn.behavior === "teacherPaced" && time(stayOn.occurrence.start) <= now) {
      const fresh = (manifest?.occurrences || []).find(o => o.id + "|" + o.start === stayOn.key);
      return fresh ? { key: stayOn.key, occurrence: fresh, items: fresh.items || NO_ITEMS, behavior: fresh.endBehavior } : stayOn;
    }
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
    return behavior === "fallback" ? { finished: true } : { hold: true };
  }

  // A teacher paced slot holds the screen until the teacher is on its last item and that item is done.
  static keepsSlot(slot: ScheduleSlot, index: number, playable: boolean[], lastDone: boolean): boolean {
    if (slot.behavior !== "teacherPaced" || index < 0) return false;
    const onLast = !playable.slice(index + 1).some(Boolean);
    return !(onLast && lastDone);
  }

  // The slide overview handles its own focus, so the player ignores the remote while it is open.
  static remoteAction(eventType: string, panelVisible: boolean, overviewVisible = false): RemoteAction | null {
    if (overviewVisible) return null;
    if (panelVisible) return "panel";
    switch (eventType) {
      case "select": return "panel";
      case "up": return "overview";
      case "playPause": return "playPause";
      case "right": return "next";
      case "left": return "previous";
      default: return null;
    }
  }

  // Manual next/previous stays inside the slot; only a looping slot wraps around.
  static skip(index: number, playable: boolean[], direction: 1 | -1, behavior: ScheduleEndBehavior): number {
    const n = playable.length;
    for (let step = 1; step < n; step++) {
      const i = index + direction * step;
      if (i < 0 || i >= n) {
        if (behavior !== "loop") break;
        const wrapped = (i + n) % n;
        if (playable[wrapped]) return wrapped;
      } else if (playable[i]) return i;
    }
    return index;
  }

  static jumpTo(slot: ScheduleSlot, index: number): number {
    if (slot.items.length === 0) return -1;
    return Math.min(Math.max(index, 0), slot.items.length - 1);
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
