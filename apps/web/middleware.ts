import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  let response: NextResponse;

  // BOTANICA OCHOSI is now the canonical application surface.
  // - /              -> public storefront
  // - /?command=1    -> Owner OS (compatibility for old bookmarks)
  // - /?legacy=1     -> inherited SAHJONY Commerce console, retained only as a
  //                     technical fallback while remaining workflows migrate.
  if (req.nextUrl.pathname === "/") {
    const legacy = req.nextUrl.searchParams.get("legacy") === "1";
    const ownerCommand = req.nextUrl.searchParams.get("command") === "1";

    if (!legacy) {
      const url = req.nextUrl.clone();
      url.pathname = ownerCommand ? "/owner" : "/store";
      url.search = "";
      response = NextResponse.rewrite(url);
    } else {
      response = NextResponse.next();
    }
  } else {
    response = NextResponse.next();
  }

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  );

  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
  }

  if (req.nextUrl.pathname.startsWith("/api/")) {
    response.headers.set("Cache-Control", "no-store, max-age=0");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|hero.jpg).*)"],
};
