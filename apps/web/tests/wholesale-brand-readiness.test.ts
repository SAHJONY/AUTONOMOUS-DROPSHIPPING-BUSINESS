import { describe, expect, it } from "vitest";
import { wholesaleBrandReadiness } from "../lib/wholesale-brand-readiness";

describe("wholesale brand readiness", () => {
  it("allows own-brand wholesale only with verified private-label evidence", () => {
    expect(wholesaleBrandReadiness({ botanicaWholesaleEnabled:true, brandMode:"PRIVATE_LABEL", resaleAuthorizationStatus:"VERIFIED", authorizationReference:"Contrato PL-22" }).ready).toBe(true);
  });
  it("fails closed when evidence is pending", () => {
    expect(wholesaleBrandReadiness({ botanicaWholesaleEnabled:true, brandMode:"PRIVATE_LABEL", resaleAuthorizationStatus:"PENDING", authorizationReference:"" }).ready).toBe(false);
  });
  it("does not represent an original-brand resale as our manufacture", () => {
    const result=wholesaleBrandReadiness({ botanicaWholesaleEnabled:true, brandMode:"ORIGINAL_BRAND", resaleAuthorizationStatus:"VERIFIED", authorizationReference:"Carta 1" });
    expect(result.ready).toBe(false);expect(result.mayPresentAsOwn).toBe(false);
  });
});
