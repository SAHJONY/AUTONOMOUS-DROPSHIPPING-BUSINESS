import { afterEach,describe,expect,it,vi } from "vitest";
import { getNbdTradeStatus,nbdFindCompanies } from "../lib/nbd-trade";
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});
describe("NBD trade connector",()=>{
 it("fails closed without a server key",async()=>{vi.stubEnv("NBD_RAPIDAPI_KEY","");expect(getNbdTradeStatus().configured).toBe(false);expect((await nbdFindCompanies("Monzon Brothers")).ok).toBe(false);});
 it("sends the rotated key only in the server-side RapidAPI header",async()=>{vi.stubEnv("NBD_RAPIDAPI_KEY","rotated-test-key");const fetchMock=vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response(JSON.stringify({data:[{company_id:"1"}]}),{status:200,headers:{"content-type":"application/json"}}));const result=await nbdFindCompanies("Monzon Brothers",99);expect(result.ok).toBe(true);const [url,init]=fetchMock.mock.calls[0];expect(String(url)).toContain("/v3/trader/company/find");expect(new Headers(init?.headers).get("x-rapidapi-key")).toBe("rotated-test-key");expect(String(init?.body)).toContain("page=10");});
});
