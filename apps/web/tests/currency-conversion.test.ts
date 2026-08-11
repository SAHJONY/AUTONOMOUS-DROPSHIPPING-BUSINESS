import { describe, expect, it } from "vitest";
import { convertToUsd } from "../lib/currency-conversion";

describe("supplier currency conversion", () => {
  it("keeps USD at parity", () => expect(convertToUsd(15, "USD", 99)).toBe(15));
  it("converts foreign currency using an explicit USD-per-unit rate", () => expect(convertToUsd(1000, "NGN", 0.00065)).toBe(0.65));
  it("fails closed to zero when a foreign exchange rate is unknown", () => expect(convertToUsd(1000, "NGN")).toBe(0));
});
