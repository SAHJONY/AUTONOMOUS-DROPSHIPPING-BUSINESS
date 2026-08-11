import { describe, expect, it } from "vitest";
import { MAX_ORGS_PER_TICK, SHIFTS, shiftFor } from "@/lib/autonomy";
import { ALL_AGENTS } from "@/lib/agents";

describe("the duty roster", () => {
  it("puts every agent in the fleet on duty", () => {
    const roster = SHIFTS.map((s) => s.agent).sort();
    const fleet = ALL_AGENTS.map((a) => a.name).sort();
    expect(roster).toEqual(fleet);
  });

  it("names an agent that actually exists for every shift", () => {
    const fleet = new Set(ALL_AGENTS.map((a) => a.name));
    for (const shift of SHIFTS) expect(fleet.has(shift.agent)).toBe(true);
  });

  it("gives every shift a substantive duty brief", () => {
    for (const shift of SHIFTS) {
      expect(shift.duty.length).toBeGreaterThan(80);
    }
  });

  it("rosters each agent exactly once so the rotation is fair", () => {
    const seen = new Set(SHIFTS.map((s) => s.agent));
    expect(seen.size).toBe(SHIFTS.length);
  });
});

describe("the rotation", () => {
  it("covers the entire fleet within one full day", () => {
    const onDuty = new Set<string>();
    for (let hour = 0; hour < 24; hour++) {
      onDuty.add(shiftFor(new Date(Date.UTC(2026, 0, 1, hour))).agent);
    }
    expect(onDuty.size).toBe(SHIFTS.length);
  });

  it("advances hour by hour and wraps cleanly", () => {
    const first = shiftFor(new Date(Date.UTC(2026, 0, 1, 0)));
    const second = shiftFor(new Date(Date.UTC(2026, 0, 1, 1)));
    const wrapped = shiftFor(new Date(Date.UTC(2026, 0, 1, SHIFTS.length)));

    expect(first.agent).toBe(SHIFTS[0].agent);
    expect(second.agent).toBe(SHIFTS[1].agent);
    expect(wrapped.agent).toBe(first.agent);
  });

  it("starts the day with the CEO so the shift lead sets direction", () => {
    expect(shiftFor(new Date(Date.UTC(2026, 0, 1, 0))).agent).toBe("ceo");
  });

  it("is deterministic — the same hour always yields the same agent", () => {
    const a = shiftFor(new Date(Date.UTC(2026, 5, 9, 13)));
    const b = shiftFor(new Date(Date.UTC(2027, 2, 2, 13)));
    expect(a.agent).toBe(b.agent);
  });
});

describe("cost bounds", () => {
  it("caps how many organizations a single tick advances", () => {
    expect(MAX_ORGS_PER_TICK).toBeGreaterThan(0);
    expect(Number.isFinite(MAX_ORGS_PER_TICK)).toBe(true);
  });
});
