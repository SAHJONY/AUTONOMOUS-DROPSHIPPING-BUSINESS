import { describe, expect, it } from "vitest";
import { assessReadiness, type ReadinessFacts } from "@/lib/readiness";

/** A fully configured, connected, locked-down deployment. */
const healthy: ReadinessFacts = {
  storageMode: "upstash",
  jwtSecretIsDefault: false,
  cronSecretSet: true,
  engineKeySet: true,
  webhookSecretSet: true,
  publicBaseUrlSet: true,
  shopifyConnected: true,
  cjConnected: true,
  autonomyEnabled: false,
  commerceReleaseEnabled: false,
  autoFulfillEnabled: false,
};

const check = (facts: Partial<ReadinessFacts>, id: string) =>
  assessReadiness({ ...healthy, ...facts }).checks.find((c) => c.id === id)!;

describe("assessReadiness", () => {
  it("passes a fully configured deployment", () => {
    const result = assessReadiness(healthy);
    expect(result.ready).toBe(true);
    expect(result.blockers).toBe(0);
    expect(result.warnings).toBe(0);
  });

  it("blocks on the in-memory store, because the books would silently reset", () => {
    const result = assessReadiness({ ...healthy, storageMode: "memory" });
    expect(result.ready).toBe(false);
    expect(result.blockers).toBe(1);

    const storage = check({ storageMode: "memory" }, "storage");
    expect(storage.level).toBe("blocker");
    expect(storage.detail).toMatch(/lost on the next cold start/i);
    expect(storage.fix).toMatch(/UPSTASH_REDIS_REST_URL/);
  });

  it("blocks on the default signing key, because tokens would be forgeable", () => {
    const jwt = check({ jwtSecretIsDefault: true }, "jwt");
    expect(jwt.level).toBe("blocker");
    expect(jwt.detail).toMatch(/anyone could mint a valid token/i);
    expect(assessReadiness({ ...healthy, jwtSecretIsDefault: true }).ready).toBe(false);
  });

  it("counts several blockers at once rather than stopping at the first", () => {
    const result = assessReadiness({
      ...healthy,
      storageMode: "memory",
      jwtSecretIsDefault: true,
    });
    expect(result.blockers).toBe(2);
    expect(result.ready).toBe(false);
  });

  it("warns — but does not block — on missing operational config", () => {
    for (const [facts, id] of [
      [{ cronSecretSet: false }, "cron"],
      [{ shopifyConnected: false }, "shopify"],
      [{ cjConnected: false }, "supplier"],
      [{ webhookSecretSet: false }, "webhooks"],
      [{ engineKeySet: false }, "engine"],
    ] as [Partial<ReadinessFacts>, string][]) {
      expect(check(facts, id).level).toBe("warning");
      expect(assessReadiness({ ...healthy, ...facts }).ready).toBe(true);
    }
  });

  it("names which half of the webhook config is missing", () => {
    expect(check({ webhookSecretSet: false }, "webhooks").detail).toMatch(/SHOPIFY_WEBHOOK_SECRET missing/);
    expect(check({ publicBaseUrlSet: false }, "webhooks").detail).toMatch(/PUBLIC_BASE_URL missing/);
  });

  it("says plainly that a missing supplier leaves paid customers waiting", () => {
    expect(check({ cjConnected: false }, "supplier").detail).toMatch(/customer waiting/i);
  });

  it("notes that the loops keep working without an engine key", () => {
    expect(check({ engineKeySet: false }, "engine").detail).toMatch(/loops are unaffected/i);
  });

  it("reports the release gates in whichever direction they are set", () => {
    expect(check({ autonomyEnabled: false }, "gates").detail).toMatch(/OFF/);
    expect(check({ autonomyEnabled: true }, "gates").detail).toMatch(/ON/);
    expect(check({ commerceReleaseEnabled: false }, "publishing").detail).toMatch(/locked/i);
    expect(check({ autoFulfillEnabled: true }, "fulfillment").detail).toMatch(/automatically/i);
  });

  it("treats posture as information, never as a problem to fix", () => {
    // An operator deliberately running locked down should see zero warnings.
    const locked = assessReadiness(healthy);
    expect(locked.warnings).toBe(0);
    for (const id of ["gates", "publishing", "fulfillment"]) {
      expect(locked.checks.find((c) => c.id === id)!.level).toBe("ok");
    }
  });

  it("never emits a fix for something that is already fine", () => {
    for (const c of assessReadiness(healthy).checks) {
      expect(c.level).toBe("ok");
      expect(c.fix).toBeUndefined();
    }
  });
});
