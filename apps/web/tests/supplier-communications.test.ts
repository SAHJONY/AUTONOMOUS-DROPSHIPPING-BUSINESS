import { describe, expect, it } from "vitest";
import { buildSupplierCommunication, SUPPLIER_COMMUNICATION_KINDS } from "../lib/supplier-communications";
describe("supplier communications",()=>{
  it("provides every workflow in Spanish and English",()=>{for(const kind of SUPPLIER_COMMUNICATION_KINDS){expect(buildSupplierCommunication(kind.value,"es").body).toContain("BOTANICA OCHOSI");expect(buildSupplierCommunication(kind.value,"en").body).toContain("BOTANICA OCHOSI");}});
  it("does not authorize an order in a template",()=>expect(buildSupplierCommunication("CATALOG_QUOTE","es").body).toContain("Ningún pedido quedará autorizado"));
});
