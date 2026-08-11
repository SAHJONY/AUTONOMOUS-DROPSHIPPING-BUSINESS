const NBD_HOST = "nbd-global-customs-trade-data-api1.p.rapidapi.com";
const NBD_BASE_URL = `https://${NBD_HOST}`;
const MAX_RESPONSE_BYTES = 1_000_000;

export function getNbdTradeStatus() {
  return { configured:Boolean(process.env.NBD_RAPIDAPI_KEY?.trim()), provider:"NBD Global Customs Trade Data", host:NBD_HOST };
}

export async function nbdFindCompanies(companyName:string,page=1):Promise<{ok:boolean;data?:unknown;error?:string}> {
  const key=process.env.NBD_RAPIDAPI_KEY?.trim();
  if(!key)return {ok:false,error:"NBD_RAPIDAPI_KEY is not configured."};
  const name=companyName.trim().slice(0,200);
  if(name.length<2)return {ok:false,error:"Company name must contain at least two characters."};
  const safePage=Math.min(10,Math.max(1,Math.floor(Number(page)||1)));
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15_000);
  try{
    const response=await fetch(`${NBD_BASE_URL}/v3/trader/company/find`,{method:"POST",signal:controller.signal,headers:{"Content-Type":"application/x-www-form-urlencoded","x-rapidapi-host":NBD_HOST,"x-rapidapi-key":key},body:new URLSearchParams({company_name:name,page:String(safePage)})});
    const declared=Number(response.headers.get("content-length")??0);if(declared>MAX_RESPONSE_BYTES)return {ok:false,error:"NBD response exceeded the allowed size."};
    const raw=(await response.text()).slice(0,MAX_RESPONSE_BYTES+1);if(raw.length>MAX_RESPONSE_BYTES)return {ok:false,error:"NBD response exceeded the allowed size."};
    const data=raw?JSON.parse(raw):{};if(!response.ok)return {ok:false,error:String((data as {message?:unknown})?.message??`NBD request failed (${response.status}).`)};
    return {ok:true,data};
  }catch(error){return {ok:false,error:error instanceof Error?error.message:"NBD request failed."};}finally{clearTimeout(timeout);}
}
