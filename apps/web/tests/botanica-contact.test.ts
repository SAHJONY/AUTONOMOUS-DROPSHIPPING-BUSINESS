import { describe, expect, it } from "vitest";
import { BOTANICA_CONTACT_EMAILS } from "../lib/botanica-contact";

describe("BOTANICA department email routing", () => {
  it("delivers every department to the official Gmail account", () => {
    expect(Object.keys(BOTANICA_CONTACT_EMAILS)).toEqual([
      "general",
      "orders",
      "support",
      "privacy",
      "wholesale",
      "suppliers",
    ]);
    for (const address of Object.values(BOTANICA_CONTACT_EMAILS)) {
      expect(address).toMatch(/^botanicaochosi\+[a-z]+@gmail\.com$/);
    }
  });

  it("keeps each department address distinct for Gmail filtering", () => {
    expect(new Set(Object.values(BOTANICA_CONTACT_EMAILS)).size).toBe(6);
  });
});
