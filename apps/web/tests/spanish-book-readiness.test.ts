import { describe,expect,it } from "vitest";
import { spanishBookReadiness } from "../lib/spanish-book-readiness";
describe("Spanish book publication readiness",()=>{
 it("accepts a verified commercial Spanish edition",()=>expect(spanishBookReadiness({materialType:"BOOK",spanishEditionClass:"SPANISH_ORIGINAL",isbn:"978-1",publisher:"Editorial",publicationCountry:"Cuba",authorizedReseller:"Distribuidor",commercialEditionStatus:"VERIFIED",rightsReference:"Carta 10"}).ready).toBe(true));
 it("does not confuse a translated description with a Spanish edition",()=>expect(spanishBookReadiness({materialType:"BOOK",spanishEditionClass:"BOTANICA_DESCRIPTION_ONLY",isbn:"978-1",publisher:"Editorial",publicationCountry:"US",authorizedReseller:"R",commercialEditionStatus:"VERIFIED",rightsReference:"Carta"}).ready).toBe(false));
 it("does not apply book gates to ordinary products",()=>expect(spanishBookReadiness({materialType:"PRODUCT"}).ready).toBe(true));
});
