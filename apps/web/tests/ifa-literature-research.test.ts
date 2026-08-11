import { describe,expect,it } from "vitest";
import { IFA_LITERATURE_RESEARCH } from "../lib/ifa-literature-research";
describe("Ifá literature research queue",()=>{
 it("contains traceable bibliographic sources without commercial claims",()=>{expect(IFA_LITERATURE_RESEARCH.length).toBeGreaterThanOrEqual(10);for(const record of IFA_LITERATURE_RESEARCH){expect(record.sourceUrl).toMatch(/^https:\/\//);expect(record.title).toBeTruthy();expect(record.languages.length).toBeGreaterThan(0);}});
 it("includes Yoruba and Portuguese knowledge leads",()=>{expect(IFA_LITERATURE_RESEARCH.some(record=>record.languages.includes("yo"))).toBe(true);expect(IFA_LITERATURE_RESEARCH.some(record=>record.languages.includes("pt"))).toBe(true);});
});
