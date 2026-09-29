import { NextRequest, NextResponse } from "next/server";
export async function middleware(req: NextRequest) {
  const secret = process.env.ADMIN_API_TOKEN;
  const required = Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING) || process.env.NODE_ENV === "production" || Boolean(secret);
  const adminOperation = req.nextUrl.pathname.startsWith("/admin") || (req.nextUrl.pathname === "/api/scenarios" && (req.method !== "GET" || req.nextUrl.searchParams.get("admin") === "1"));
  if (!adminOperation || !required) return NextResponse.next();
  if (req.method !== "GET" && req.method !== "HEAD" && req.headers.get("origin") && req.headers.get("origin") !== req.nextUrl.origin) return new NextResponse("Недопустимый источник запроса", { status:403 });
  const auth = req.headers.get("authorization") ?? "";
  let supplied = auth.replace(/^Bearer\s+/i, "");
  if (auth.startsWith("Basic ")) {
    try { supplied = atob(auth.slice(6)).replace(/^[^:]*:/, ""); } catch { supplied = ""; }
  }
  const cookie = req.cookies.get("arena-admin")?.value;
  const hash = secret ? Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)))).map((b) => b.toString(16).padStart(2,"0")).join("") : "";
  if (!secret || (supplied !== secret && (!cookie || cookie !== hash))) return new NextResponse("Требуется доступ администратора", { status:401, headers:{"WWW-Authenticate":'Basic realm="Arena admin", charset="UTF-8"',"Cache-Control":"no-store"} });
  const response = NextResponse.next();
  response.cookies.set("arena-admin", hash, { httpOnly:true, sameSite:"strict", secure:req.nextUrl.protocol === "https:", maxAge:28800, path:"/" });
  return response;
}
export const config = { matcher: ["/admin/:path*", "/api/scenarios"] };
