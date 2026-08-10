import { NextRequest, NextResponse } from "next/server";

const CANONICAL_HOST = "www.botanicaochosi.com";
const APEX_HOST = "botanicaochosi.com";

export function middleware(req: NextRequest) {
  const host = req.headers.get("host")?.toLowerCase() ?? "";

  if (host === APEX_HOST) {
    const url = req.nextUrl.clone();
    url.protocol = "https:";
    url.host = CANONICAL_HOST;
    return NextResponse.redirect(url, 308);
  }

  let response: NextResponse;

  // Public traffic always enters the BOTANICA OCHOSI storefront.
  // Administrative operations live exclusively under /owner.
  // The inherited SAHJONY Commerce landing is intentionally unreachable
  // from public routing so legacy branding cannot leak into the customer app.
  if (req.nextUrl.pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = "/shop";
    url.search = "";
    response = NextResponse.rewrite(url);
  } else if (req.nextUrl.pathname === "/store") {
    const url = req.nextUrl.clone();
    url.pathname = "/shop";
    url.search = "";
    response = NextResponse.rewrite(url);
  } else {
    response = NextResponse.next();
  }

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), browsing-topics=()");

  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }

  if (req.nextUrl.pathname.startsWith("/api/")) {
    response.headers.set("Cache-Control", "no-store, max-age=0");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|hero.jpg).*)"],
};
