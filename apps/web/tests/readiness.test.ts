import { describe, expect, it } from "vitest";
import { assessAutonomySafety, assessReadiness, type ReadinessFacts } from "@/lib/readiness";

/** A fully configured, connected, locked-down deployment. */
const healthy: ReadinessFacts = {
  storageMode: "upstash",
  jwtSecretIsDefault: false,
  ownerPasswordSet: true,
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

  /**
   * Found by walking a fresh deployment: registration refuses the owner email
   * ("provisioned through the secured owner bootstrap"), and the bootstrap only
   * runs when OWNER_PASSWORD is set. Without it there is no way into the
   * console at all — and readiness used to report that deployment as fine.
   */
  it("blocks when OWNER_PASSWORD is unset, because nobody can sign in at all", () => {
    const owner = check({ ownerPasswordSet: false }, "owner");
    expect(owner.level).toBe("blocker");
    expect(owner.detail).toMatch(/registration deliberately refuses the owner email/i);
    expect(owner.fix).toMatch(/OWNER_PASSWORD/);
    expect(assessReadiness({ ...healthy, ownerPasswordSet: false }).ready).toBe(false);
  });

  it("counts several blockers at once rather than stopping at the first", () => {
    const result = assessReadiness({
      ...healthy,
      storageMode: "memory",
      jwtSecretIsDefault: true,
      ownerPasswordSet: false,
    });
    expect(result.blockers).toBe(3);
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

describe("autonomy safety gate", () => {
  const fit = { storageMode: "upstash" as const, jwtSecretIsDefault: false, ownerPasswordSet: true };

  it("lets unattended money-moving work run on a fit deployment", () => {
    const safety = assessAutonomySafety(fit);
    expect(safety.safe).toBe(true);
    expect(safety.blockers).toEqual([]);
  });

  it("holds money-moving work when the books would reset on a cold start", () => {
    const safety = assessAutonomySafety({ ...fit, storageMode: "memory" });
    expect(safety.safe).toBe(false);
    expect(safety.blockers).toHaveLength(1);
  });

  it("holds money-moving work when anyone could sign in as the owner", () => {
    const safety = assessAutonomySafety({ ...fit, jwtSecretIsDefault: true });
    expect(safety.safe).toBe(false);
  });

  it("holds money-moving work when no owner can sign in to stop it", () => {
    const safety = assessAutonomySafety({ ...fit, ownerPasswordSet: false });
    expect(safety.safe).toBe(false);
    expect(safety.blockers[0]).toMatch(/OWNER_PASSWORD/);
  });

  it("names every reason at once rather than only the first", () => {
    const safety = assessAutonomySafety({ storageMode: "memory", jwtSecretIsDefault: true, ownerPasswordSet: false });
    expect(safety.safe).toBe(false);
    expect(safety.blockers).toHaveLength(3);
  });

  it("gates on exactly the checks assessReadiness calls blockers", () => {
    // The two gates must not drift apart: anything that makes a deployment
    // unfit for a human to trade on must also stop the cron from trading.
    const unfit = {
      storageMode: "memory" as const, jwtSecretIsDefault: true, ownerPasswordSet: false, cronSecretSet: true, engineKeySet: true,
      webhookSecretSet: true, publicBaseUrlSet: true, shopifyConnected: true, cjConnected: true,
      autonomyEnabled: true, commerceReleaseEnabled: true, autoFulfillEnabled: true,
    };
    const readiness = assessReadiness(unfit);
    expect(readiness.blockers).toBe(assessAutonomySafety(unfit).blockers.length);
  });
});
